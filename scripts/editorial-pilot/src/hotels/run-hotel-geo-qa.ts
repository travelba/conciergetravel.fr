/**
 * CLI — generate the GEO/AEO answer-engine block (`hotels.geo_qa`) grounded on
 * DataForSEO People-Also-Ask, in batch.
 *
 * Modes:
 *   --slug=<slug>            single hotel (debug / pilot)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels
 *   --dry-run                generate + print, do NOT write to Supabase
 *   --refresh                re-generate even if a hotel already has geo_qa
 *   --refresh-grounding      bypass the DFS disk cache (force re-fetch)
 *   --include-drafts         include rows where `is_published = false`
 *   --concurrency=<N>        parallel hotels (default 2, max 4 — DFS rate)
 *
 * Grounding is REQUIRED: geo_qa anchors on real PAA demand. When DFS is off the
 * run aborts; when a single hotel returns no PAA it is skipped (logged).
 *
 * Skill: keyword-grounding-dataforseo, geo-llm-optimization, editorial-pilot.
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import { loadDfsConfig } from '../grounding/env-dfs.js';
import { groundHotel } from '../grounding/hotel-grounding.js';
import {
  listHotels,
  projectHotelForLlm,
  updateHotelGeoQa,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import { generateGeoQa, GeoQaGenerationError, type GeoQaEntry } from './geo-qa-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

interface Args {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly refresh: boolean;
  readonly refreshGrounding: boolean;
  readonly includeDrafts: boolean;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const concRaw = map.get('concurrency');
  const concurrency = typeof concRaw === 'string' ? Math.min(4, Math.max(1, Number(concRaw))) : 2;
  const out: {
    slug?: string;
    slugs?: readonly string[];
    limit?: number;
    dryRun: boolean;
    refresh: boolean;
    refreshGrounding: boolean;
    includeDrafts: boolean;
    concurrency: number;
  } = {
    dryRun: map.has('dry-run'),
    refresh: map.has('refresh'),
    refreshGrounding: map.has('refresh-grounding'),
    includeDrafts: map.has('include-drafts'),
    concurrency,
  };
  const slugRaw = map.get('slug');
  const slugsRaw = map.get('slugs');
  const limitRaw = map.get('limit');
  if (typeof slugRaw === 'string') out.slug = slugRaw;
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) out.slugs = list;
  }
  if (typeof limitRaw === 'string') out.limit = Number(limitRaw);
  return out;
}

/** Set of slugs that already carry a non-null geo_qa (to skip on re-runs). */
async function fetchSlugsWithGeoQa(cfg: SupabaseRestConfig): Promise<Set<string>> {
  const out = new Set<string>();
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', 'slug');
    params.set('geo_qa', 'not.is.null');
    params.set('limit', String(pageSize));
    if (offset > 0) params.set('offset', String(offset));
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) break;
    const json: unknown = await res.json();
    if (!Array.isArray(json)) break;
    for (const r of json) {
      const slug = (r as { slug?: unknown }).slug;
      if (typeof slug === 'string') out.add(slug);
    }
    if (json.length < pageSize) break;
    offset += json.length;
  }
  return out;
}

interface PerHotelResult {
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly status: 'ok' | 'skip_no_paa' | 'fail';
  readonly blocks?: number;
  readonly entries?: readonly GeoQaEntry[];
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly paaCount?: number;
  readonly error?: string;
}

async function runOnHotel(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  dfsCfg: ReturnType<typeof loadDfsConfig>,
  row: HotelRow,
  options: { dryRun: boolean; refreshGrounding: boolean },
): Promise<PerHotelResult> {
  const input = projectHotelForLlm(row);
  try {
    const { grounding, block } = await groundHotel(
      dfsCfg,
      input,
      options.refreshGrounding ? { refresh: true } : {},
    );
    if (!grounding.grounded || grounding.peopleAlsoAsk.length === 0 || block.length === 0) {
      return {
        slug: row.slug,
        name: row.name,
        city: row.city,
        status: 'skip_no_paa',
        paaCount: grounding.peopleAlsoAsk.length,
      };
    }
    const result = await generateGeoQa(client, input, block);
    if (!options.dryRun) {
      await updateHotelGeoQa(supabase, row.id, result.entries);
    }
    return {
      slug: row.slug,
      name: row.name,
      city: row.city,
      status: 'ok',
      blocks: result.entries.length,
      entries: result.entries,
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      paaCount: grounding.peopleAlsoAsk.length,
    };
  } catch (err) {
    return {
      slug: row.slug,
      name: row.name,
      city: row.city,
      status: 'fail',
      error: err instanceof GeoQaGenerationError ? err.message : (err as Error).message,
    };
  }
}

function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  return new Promise((resolveAll, rejectAll) => {
    const launchNext = (): void => {
      const myIndex = cursor++;
      if (myIndex >= total) return;
      const item = items[myIndex];
      if (item === undefined) return;
      fn(item, myIndex)
        .then((res) => {
          results[myIndex] = res;
          done++;
          if (onProgress) onProgress(done, total, res);
          if (done === total) resolveAll(results);
          else launchNext();
        })
        .catch(rejectAll);
    };
    const initial = Math.min(limit, total);
    for (let i = 0; i < initial; i++) launchNext();
    if (total === 0) resolveAll([]);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const dfsCfg = loadDfsConfig();
  if (dfsCfg === null) {
    console.error(
      '[geo-qa] DataForSEO is OFF — geo_qa requires real PAA grounding. Set DATAFORSEO_ENABLED=1 + creds in .env.local. Aborting.',
    );
    process.exit(1);
  }

  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[geo-qa] provider=${provider} model=${client.model}`);
  console.log(
    `[geo-qa] mode dryRun=${args.dryRun} refresh=${args.refresh} concurrency=${args.concurrency} limit=${args.limit ?? '∞'}`,
  );

  const listOpts: {
    onlyPublished: boolean;
    requireDescription: boolean;
    slug?: string;
    slugs?: readonly string[];
  } = {
    onlyPublished: !args.includeDrafts,
    requireDescription: true,
  };
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;
  const allRows = await listHotels(supabase, listOpts);

  let candidates = allRows;
  if (!args.refresh) {
    const existing = await fetchSlugsWithGeoQa(supabase);
    candidates = allRows.filter((r) => !existing.has(r.slug));
  }
  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[geo-qa] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[geo-qa] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) =>
      runOnHotel(client, supabase, dfsCfg, row, {
        dryRun: args.dryRun,
        refreshGrounding: args.refreshGrounding,
      }),
    (doneN, total, last) => {
      const status =
        last.status === 'ok'
          ? `OK (${String(last.blocks)} blocs, ${String(last.attempts)}x, PAA=${String(last.paaCount)})`
          : last.status === 'skip_no_paa'
            ? `SKIP (no PAA)`
            : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[geo-qa] ${doneN}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skip_no_paa').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[geo-qa] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[geo-qa] ok=${ok} skip=${skipped} fail=${failed} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `geo-qa-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        dryRun: args.dryRun,
        ok,
        skipped,
        failed,
        totalInputTokens,
        totalOutputTokens,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[geo-qa] run log → ${logPath}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[geo-qa] FATAL', err);
  process.exit(1);
});
