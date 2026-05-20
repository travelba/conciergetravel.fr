/**
 * CLI — generate `factual_summary_{fr,en}` for hotels in batch.
 *
 * Modes:
 *   --slug=<slug>            single hotel (debug)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels (PILOT mode)
 *   --dry-run                generate + print, do NOT write to Supabase
 *   --include-all            include hotels even if factual_summary already set (default: skip)
 *   --no-description-filter  include hotels without description (RISKY — may hallucinate)
 *   --concurrency=<N>        parallel LLM calls (default 3, max 8)
 *
 * Examples:
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts --limit=10 --dry-run
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts --slug=le-bristol-paris
 *   pnpm tsx scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts --limit=442 --concurrency=5
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
  listHotelsForFactualSummary,
  projectHotelForLlm,
  updateHotelFactualSummary,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generateFactualSummary,
  FactualSummaryGenerationError,
} from './factual-summary-generator.js';

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
  readonly noDescriptionFilter: boolean;
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
    noDescriptionFilter: boolean;
    concurrency: number;
  } = {
    dryRun: map.has('dry-run'),
    includeAll: map.has('include-all'),
    noDescriptionFilter: map.has('no-description-filter'),
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
    const result = await generateFactualSummary(client, input);
    if (!options.dryRun) {
      await updateHotelFactualSummary(supabase, row.id, {
        factual_summary_fr: result.output.fr,
        factual_summary_en: result.output.en,
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
    if (err instanceof FactualSummaryGenerationError) {
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

  console.log(`[factual-summary] provider=${provider} model=${client.model}`);
  console.log(
    `[factual-summary] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'}`,
  );

  const listOpts: {
    onlyMissingFactualSummary: boolean;
    requireDescription: boolean;
    limit?: number;
    slug?: string;
    slugs?: readonly string[];
  } = {
    onlyMissingFactualSummary: !args.includeAll,
    requireDescription: !args.noDescriptionFilter,
  };
  if (args.limit !== undefined) listOpts.limit = args.limit;
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;
  const rows = await listHotelsForFactualSummary(supabase, listOpts);

  console.log(`[factual-summary] ${rows.length} hotel(s) eligible.`);
  if (rows.length === 0) {
    console.log('[factual-summary] nothing to do.');
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
      console.log(
        `[factual-summary] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`,
      );
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[factual-summary] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[factual-summary] success=${okCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  // Persist a run log so we can diff against next runs.
  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `factual-summary-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        dryRun: args.dryRun,
        totalEligible: rows.length,
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
  console.log(`[factual-summary] run log → ${logPath}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[factual-summary] FATAL', err);
  process.exit(1);
});
