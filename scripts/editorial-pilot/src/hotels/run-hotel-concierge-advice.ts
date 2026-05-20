/**
 * CLI — generate `hotels.concierge_advice` (FR + EN) in batch for
 * the hotels that have a Supabase description but are not yet covered
 * by the editorial pipeline (rankings / guides) which produces the
 * `concierge_advice` block as a side effect of Pass 8 humanizer.
 *
 * Mirrors `run-hotel-factual-summary.ts` — same flag set, same
 * progress / log shape.
 *
 * Examples:
 *   pnpm exec tsx src/hotels/run-hotel-concierge-advice.ts --limit=5 --dry-run
 *   pnpm exec tsx src/hotels/run-hotel-concierge-advice.ts --slug=le-bristol-paris
 *   pnpm exec tsx src/hotels/run-hotel-concierge-advice.ts --limit=337 --concurrency=4
 *
 * Skill: editorial-pilot, llm-output-robustness, concierge-voice-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import {
  listHotelsForConciergeAdvice,
  projectHotelForLlm,
  updateHotelConciergeAdvice,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generateConciergeAdvice,
  ConciergeAdviceGenerationError,
} from './concierge-advice-generator.js';

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
  slug?: string;
  slugs?: readonly string[];
  limit?: number;
  dryRun: boolean;
  noDescriptionFilter: boolean;
  concurrency: number;
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
    noDescriptionFilter: boolean;
    concurrency: number;
  } = {
    dryRun: map.has('dry-run'),
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
  readonly title_fr?: string;
  readonly body_fr_words?: number;
  readonly body_en_words?: number;
  readonly tip_for?: string;
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
    const result = await generateConciergeAdvice(client, input);
    if (!options.dryRun) {
      await updateHotelConciergeAdvice(supabase, row.id, {
        fr: result.output.fr,
        en: result.output.en,
      });
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: true,
      title_fr: result.output.fr.title,
      body_fr_words: countWords(result.output.fr.body),
      body_en_words: countWords(result.output.en.body),
      tip_for: result.output.fr.tip_for,
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    if (err instanceof ConciergeAdviceGenerationError) {
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

function countWords(s: string): number {
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
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

  console.log(`[concierge-advice] provider=${provider} model=${client.model}`);
  console.log(
    `[concierge-advice] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'}`,
  );

  const listOpts: {
    requireDescription: boolean;
    limit?: number;
    slug?: string;
    slugs?: readonly string[];
  } = {
    requireDescription: !args.noDescriptionFilter,
  };
  if (args.limit !== undefined) listOpts.limit = args.limit;
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;
  const rows = await listHotelsForConciergeAdvice(supabase, listOpts);

  console.log(`[concierge-advice] ${rows.length} hotel(s) eligible.`);
  if (rows.length === 0) {
    console.log('[concierge-advice] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(client, supabase, row, { dryRun: args.dryRun }),
    (done, total, last) => {
      const status = last.success
        ? `OK (${last.attempts}x, ${last.body_fr_words}w/${last.body_en_words}w, ${last.tip_for})`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(
        `[concierge-advice] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`,
      );
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[concierge-advice] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[concierge-advice] success=${okCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `concierge-advice-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
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
  console.log(`[concierge-advice] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[concierge-advice] FATAL', err);
  process.exit(1);
});
