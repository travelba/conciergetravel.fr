/**
 * enrich-hotel-geo-context.ts — Wave 0 pipeline filling the two GEO
 * blocs the CDC audit flags catalogue-wide:
 *
 *   - `transports` (CDC bloc 7) — derived DETERMINISTICALLY from the
 *     hotel's `points_of_interest[].nearest_transit` (real OSM stations
 *     from `pois:sync`). No LLM, no fabricated distances.
 *   - `highlights` (CDC bloc 4) — 3-6 qualitative bilingual highlights
 *     from the editorial LLM, grounded on the hotel's own brief.
 *
 * Eligibility (default): published hotels where `highlights` has < 3
 * entries OR `transports` is empty. `--force` regenerates regardless.
 *
 * CLI:
 *   --slug=foo                 single hotel
 *   --slugs=a,b,c              explicit list
 *   --slugs-file=path.txt      one slug per line (or comma-separated) — cohort runs
 *   --include-drafts           include is_published=false rows
 *   --concurrency=N            parallel LLM calls (default 4, max 8)
 *   --limit=N                  cap eligible rows
 *   --dry-run                  generate + log, do NOT persist
 *   --force                    regenerate even when both blocs already present
 *   --skip-highlights          only derive transports (free, no LLM)
 *   --skip-transports          only generate highlights
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, llm-output-robustness.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import {
  listHotels,
  projectHotelForLlm,
  updateHotelGeoContext,
  type HotelRow,
  type SupabaseRestConfig,
} from '../hotels/supabase-hotels.js';
import {
  deriveTransportsFromPois,
  generateHighlights,
  HighlightsGenerationError,
  HIGHLIGHTS_MIN,
  type HighlightItem,
  type TransportItem,
} from '../hotels/geo-context-generator.js';

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
  readonly slugsFile?: string;
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeDrafts: boolean;
  readonly force: boolean;
  readonly skipHighlights: boolean;
  readonly skipTransports: boolean;
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
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const slugsFileRaw = map.get('slugs-file');
  const out: Args = {
    dryRun: map.has('dry-run'),
    includeDrafts: map.has('include-drafts'),
    force: map.has('force'),
    skipHighlights: map.has('skip-highlights'),
    skipTransports: map.has('skip-transports'),
    concurrency: typeof concRaw === 'string' ? Math.min(8, Math.max(1, Number(concRaw))) : 4,
    ...(typeof slugRaw === 'string' ? { slug: slugRaw } : {}),
    ...(typeof slugsFileRaw === 'string' ? { slugsFile: slugsFileRaw } : {}),
    ...(typeof limitRaw === 'string' ? { limit: Number(limitRaw) } : {}),
  };
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) return { ...out, slugs: list };
  }
  return out;
}

async function readSlugsFile(path: string): Promise<readonly string[]> {
  const content = await readFile(path, 'utf-8');
  return content
    .split(/[\r\n,]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#'));
}

function highlightCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function transportCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly success: boolean;
  readonly transportsWritten: number;
  readonly highlightsWritten: number;
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly skipped?: string;
  readonly error?: string;
}

async function runOnHotel(
  client: LlmClient,
  supabase: SupabaseRestConfig,
  row: HotelRow,
  args: Args,
): Promise<PerHotelResult> {
  const base = {
    slug: row.slug,
    hotelId: row.id,
    name: row.name,
  };

  const needHighlights = args.force || highlightCount(row.highlights) < HIGHLIGHTS_MIN;
  const needTransports = args.force || transportCount(row.transports) < 1;

  const payload: { highlights?: unknown; transports?: unknown } = {};
  let attempts = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  // 1. Transports — deterministic, free.
  let transports: TransportItem[] = [];
  if (!args.skipTransports && needTransports) {
    transports = deriveTransportsFromPois(row.points_of_interest);
    if (transports.length > 0) payload.transports = transports;
  }

  // 2. Highlights — LLM, only when needed.
  let highlights: readonly HighlightItem[] = [];
  if (!args.skipHighlights && needHighlights) {
    try {
      const result = await generateHighlights(client, projectHotelForLlm(row));
      highlights = result.highlights;
      attempts = result.attempts;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      payload.highlights = highlights.map((h) => ({ label_fr: h.label_fr, label_en: h.label_en }));
    } catch (err) {
      const message =
        err instanceof HighlightsGenerationError ? err.message : (err as Error).message;
      return {
        ...base,
        success: false,
        transportsWritten: 0,
        highlightsWritten: 0,
        error: message,
      };
    }
  }

  if (payload.highlights === undefined && payload.transports === undefined) {
    return {
      ...base,
      success: true,
      transportsWritten: 0,
      highlightsWritten: 0,
      skipped: 'nothing-to-do (or no grounded transit data)',
    };
  }

  if (!args.dryRun) {
    await updateHotelGeoContext(supabase, row.id, payload);
  }

  return {
    ...base,
    success: true,
    transportsWritten: transports.length,
    highlightsWritten: highlights.length,
    attempts,
    inputTokens,
    outputTokens,
  };
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

  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  let slugs = args.slugs;
  if (args.slugsFile !== undefined) {
    if (!existsSync(args.slugsFile)) {
      throw new Error(`[geo-context] slugs-file not found: ${args.slugsFile}`);
    }
    const fileSlugs = await readSlugsFile(args.slugsFile);
    slugs = slugs !== undefined ? [...slugs, ...fileSlugs] : fileSlugs;
  }

  console.log(`[geo-context] provider=${provider} model=${client.model}`);
  console.log(
    `[geo-context] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} force=${args.force} skipHL=${args.skipHighlights} skipTransports=${args.skipTransports}`,
  );

  const listOpts: Parameters<typeof listHotels>[1] = {
    onlyPublished: !args.includeDrafts,
    requireDescription: false,
    ...(args.slug !== undefined ? { slug: args.slug } : {}),
    ...(slugs !== undefined ? { slugs } : {}),
  };
  const allRows = await listHotels(supabase, listOpts);

  const candidates = args.force
    ? allRows
    : allRows.filter(
        (row) =>
          highlightCount(row.highlights) < HIGHLIGHTS_MIN || transportCount(row.transports) < 1,
      );
  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[geo-context] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[geo-context] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(client, supabase, row, args),
    (doneCount, total, last) => {
      const status = last.success
        ? last.skipped
          ? `SKIP (${last.skipped})`
          : `OK (+${last.highlightsWritten}hl +${last.transportsWritten}tr)`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[geo-context] ${doneCount}/${total} ${last.slug} → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalIn = results.reduce((a, r) => a + (r.inputTokens ?? 0), 0);
  const totalOut = results.reduce((a, r) => a + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[geo-context] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[geo-context] success=${okCount} fail=${failCount} tokens=${totalIn} in / ${totalOut} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `geo-context-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        dryRun: args.dryRun,
        totalFetched: allRows.length,
        totalEligible: candidates.length,
        totalProcessed: rows.length,
        success: okCount,
        fail: failCount,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[geo-context] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[geo-context] FATAL', err);
  process.exit(1);
});
