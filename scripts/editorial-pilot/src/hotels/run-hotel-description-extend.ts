/**
 * CLI — extend `description_{fr,en}` for hotels where the current
 * description sits below the CDC §2.4 600-char floor.
 *
 * Modes:
 *   --slug=<slug>            single hotel (debug)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels (PILOT mode)
 *   --dry-run                generate + print, do NOT write to Supabase
 *   --include-all            include hotels already ≥ 600 chars
 *                            (default: skip rows already in band on FR)
 *   --include-drafts         include rows where `is_published = false`
 *   --concurrency=<N>        parallel LLM calls (default 3, max 8)
 *
 * Examples:
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-description-extend.ts --limit=5 --dry-run
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-description-extend.ts --slug=hotel-de-la-paix-bordeaux
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-description-extend.ts --concurrency=5
 *
 * Eligibility (default): published hotels where `description_fr` is
 * non-null AND `< 600 chars`. The length filter runs client-side
 * (PostgREST cannot filter on `char_length`).
 *
 * NOTE: this pipeline preserves the opening — see
 * `description-extend-generator.ts` §gate. Hotels with `description_fr
 * IS NULL` are intentionally skipped (the extension passes need a
 * seed; the future `run-hotel-description-rewrite.ts` will handle
 * empty-seed cases).
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
  listHotelsForDescriptionExtend,
  projectHotelForLlm,
  updateHotelDescription,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generateDescriptionExtend,
  DescriptionExtendGenerationError,
} from './description-extend-generator.js';

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

/** CDC §2.4 — minimum description length on a published hotel page. */
const DESCRIPTION_MIN_CHARS = 600;

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

/** True if `description_fr` is below the CDC §2.4 600-char floor. */
function isBelowFloor(value: string | null): boolean {
  if (value === null) return false; // empty seed — not eligible for extension
  return value.length > 0 && value.length < DESCRIPTION_MIN_CHARS;
}

interface PerHotelResult {
  readonly slug: string;
  readonly hotelId: string;
  readonly name: string;
  readonly city: string | null;
  readonly success: boolean;
  readonly fr?: string;
  readonly en?: string;
  readonly frLengthBefore?: number;
  readonly enLengthBefore?: number;
  readonly frLengthAfter?: number;
  readonly enLengthAfter?: number;
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
    const result = await generateDescriptionExtend(client, input);
    if (!options.dryRun) {
      await updateHotelDescription(supabase, row.id, {
        description_fr: result.output.fr,
        description_en: result.output.en,
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
      frLengthBefore: row.description_fr?.length ?? 0,
      enLengthBefore: row.description_en?.length ?? 0,
      frLengthAfter: result.output.fr.length,
      enLengthAfter: result.output.en.length,
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    if (err instanceof DescriptionExtendGenerationError) {
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

  console.log(`[description-extend] provider=${provider} model=${client.model}`);
  console.log(
    `[description-extend] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} includeAll=${args.includeAll} includeDrafts=${args.includeDrafts}`,
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
  const allRows = await listHotelsForDescriptionExtend(supabase, listOpts);

  const candidates = args.includeAll
    ? allRows
    : allRows.filter((row) => isBelowFloor(row.description_fr));

  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[description-extend] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[description-extend] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(client, supabase, row, { dryRun: args.dryRun }),
    (done, total, last) => {
      const status = last.success
        ? `OK (${last.attempts}x, ${last.frLengthBefore ?? '?'}→${last.frLengthAfter}c FR / ${last.enLengthBefore ?? '?'}→${last.enLengthAfter}c EN)`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(
        `[description-extend] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`,
      );
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[description-extend] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[description-extend] success=${okCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(
    RUNS_DIR,
    `description-extend-${args.dryRun ? 'dry' : 'live'}-${ts}.json`,
  );
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
  console.log(`[description-extend] run log → ${logPath}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[description-extend] FATAL', err);
  process.exit(1);
});
