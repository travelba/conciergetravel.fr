/**
 * CLI — generate `meta_desc_{fr,en}` for hotels in batch.
 *
 * Modes:
 *   --slug=<slug>            single hotel (debug)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels (PILOT mode)
 *   --dry-run                generate + print, do NOT write to Supabase
 *   --include-all            include hotels already in the 140-170 band
 *                            (default: skip rows already in band on BOTH locales)
 *   --include-drafts         include rows where `is_published = false`
 *   --concurrency=<N>        parallel LLM calls (default 3, max 8)
 *
 * Examples:
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-meta-desc.ts --limit=5 --dry-run
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-meta-desc.ts --slug=le-bristol-paris
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-meta-desc.ts --concurrency=5
 *
 * Eligibility (default): published hotels where `meta_desc_fr` OR
 * `meta_desc_en` is NULL, empty, < 140 chars, or > 170 chars. The
 * length filter runs client-side because PostgREST can't express
 * `char_length(col)` in a filter — the script fetches the published
 * set and refines in TypeScript.
 *
 * Skill: editorial-pilot, llm-output-robustness.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import {
  listHotelsForMetaDesc,
  projectHotelForLlm,
  updateHotelMetaDesc,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generateMetaDesc,
  MetaDescGenerationError,
  META_DESC_MIN_CHARS,
  META_DESC_MAX_CHARS,
} from './meta-desc-generator.js';

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

function parseArgs(argv: readonly string[]): {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeAll: boolean;
  readonly includeDrafts: boolean;
  readonly concurrency: number;
} {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const concRaw = map.get('concurrency');
  const concurrency = typeof concRaw === 'string' ? Math.min(8, Math.max(1, Number(concRaw))) : 3;
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const out: {
    slug?: string;
    slugs?: readonly string[];
    limit?: number;
    dryRun: boolean;
    includeAll: boolean;
    includeDrafts: boolean;
    concurrency: number;
  } = {
    dryRun: map.has('dry-run'),
    includeAll: map.has('include-all'),
    includeDrafts: map.has('include-drafts'),
    concurrency,
  };
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

/** True if `value` is outside the 140-170 band (NULL, empty, too short, too long). */
function isOutOfBand(value: string | null): boolean {
  if (value === null) return true;
  const len = value.length;
  if (len === 0) return true;
  return len < META_DESC_MIN_CHARS || len > META_DESC_MAX_CHARS;
}

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly city: string | null;
  readonly success: boolean;
  readonly fr?: string;
  readonly en?: string;
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly error?: string;
  readonly errorAttempts?: ReadonlyArray<{ raw: string; reason: string }>;
}

async function runOnHotel(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  row: HotelRow,
  options: { dryRun: boolean },
): Promise<PerHotelResult> {
  const input = projectHotelForLlm(row);
  try {
    const result = await generateMetaDesc(client, input);
    if (!options.dryRun) {
      await updateHotelMetaDesc(supabase, row.id, {
        meta_desc_fr: result.output.fr,
        meta_desc_en: result.output.en,
      });
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: true,
      fr: result.output.fr,
      en: result.output.en,
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    if (err instanceof MetaDescGenerationError) {
      return {
        slug: row.slug,
        hotelId: row.id,
        name: row.name,
        city: row.city,
        success: false,
        error: err.message,
        errorAttempts: err.attempts,
      };
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: false,
      error: (err as Error).message,
    };
  }
}

/** Simple p-limit replacement (avoid a new dep). */
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

  console.log(`[meta-desc] provider=${provider} model=${client.model}`);
  console.log(
    `[meta-desc] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} includeAll=${args.includeAll} includeDrafts=${args.includeDrafts}`,
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
  const allRows = await listHotelsForMetaDesc(supabase, listOpts);

  // Client-side length filter — see supabase-hotels.ts §onlyOutOfBandMetaDesc.
  const candidates = args.includeAll
    ? allRows
    : allRows.filter((row) => isOutOfBand(row.meta_desc_fr) || isOutOfBand(row.meta_desc_en));

  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[meta-desc] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[meta-desc] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(client, supabase, row, { dryRun: args.dryRun }),
    (done, total, last) => {
      const status = last.success
        ? `OK (${last.attempts}x, ${last.fr?.length}c/${last.en?.length}c)`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[meta-desc] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[meta-desc] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[meta-desc] success=${okCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `meta-desc-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
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
        totalInputTokens,
        totalOutputTokens,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[meta-desc] run log → ${logPath}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[meta-desc] FATAL', err);
  process.exit(1);
});
