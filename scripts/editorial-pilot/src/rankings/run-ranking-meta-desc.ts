/**
 * CLI — generate `meta_desc_{fr,en}` for `editorial_rankings` rows.
 *
 * Modes:
 *   --slug=<slug>            single ranking (debug)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N rankings (PILOT mode)
 *   --dry-run                generate + print, do NOT write
 *   --include-all            include rows already in [140,170] band
 *   --include-drafts         include rows where `is_published = false`
 *   --only-drafts            ONLY draft rows (implies --include-drafts)
 *   --concurrency=<N>        parallel LLM calls (default 3, max 8)
 *
 * Examples:
 *   pnpm tsx scripts/editorial-pilot/src/rankings/run-ranking-meta-desc.ts --include-drafts --limit=3 --dry-run
 *   pnpm tsx scripts/editorial-pilot/src/rankings/run-ranking-meta-desc.ts --include-drafts --concurrency=4
 *
 * Eligibility (default): rows where `meta_desc_fr` OR `meta_desc_en`
 * is NULL, empty, < 140 chars, or > 170 chars. Length filter runs
 * client-side because PostgREST can't express `char_length(col)` in
 * a filter.
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
  listRankings,
  projectRankingForLlm,
  updateRankingMetaDesc,
  type RankingRow,
  type SupabaseRestConfig,
} from './supabase-rankings.js';
import {
  generateRankingMetaDesc,
  RankingMetaDescError,
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
  readonly onlyDrafts: boolean;
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
    onlyDrafts: boolean;
    concurrency: number;
  } = {
    dryRun: map.has('dry-run'),
    includeAll: map.has('include-all'),
    includeDrafts: map.has('include-drafts') || map.has('only-drafts'),
    onlyDrafts: map.has('only-drafts'),
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

function isOutOfBand(value: string | null): boolean {
  if (value === null) return true;
  const len = value.length;
  if (len === 0) return true;
  return len < META_DESC_MIN_CHARS || len > META_DESC_MAX_CHARS;
}

interface PerRankingResult {
  readonly slug: string;
  readonly rankingId: string;
  readonly title_fr: string;
  readonly kind: string;
  readonly success: boolean;
  readonly fr?: string;
  readonly en?: string;
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly error?: string;
  readonly errorAttempts?: ReadonlyArray<{ raw: string; reason: string }>;
}

async function runOnRanking(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  row: RankingRow,
  options: { dryRun: boolean },
): Promise<PerRankingResult> {
  const input = projectRankingForLlm(row);
  try {
    const result = await generateRankingMetaDesc(client, input);
    if (!options.dryRun) {
      await updateRankingMetaDesc(supabase, row.id, {
        meta_desc_fr: result.output.fr,
        meta_desc_en: result.output.en,
      });
    }
    return {
      slug: row.slug,
      rankingId: row.id,
      title_fr: row.title_fr,
      kind: row.kind,
      success: true,
      fr: result.output.fr,
      en: result.output.en,
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    if (err instanceof RankingMetaDescError) {
      return {
        slug: row.slug,
        rankingId: row.id,
        title_fr: row.title_fr,
        kind: row.kind,
        success: false,
        error: err.message,
        errorAttempts: err.attempts,
      };
    }
    return {
      slug: row.slug,
      rankingId: row.id,
      title_fr: row.title_fr,
      kind: row.kind,
      success: false,
      error: (err as Error).message,
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

  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[ranking-meta-desc] provider=${provider} model=${client.model}`);
  console.log(
    `[ranking-meta-desc] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} includeAll=${args.includeAll} includeDrafts=${args.includeDrafts}`,
  );

  const listOpts: {
    onlyPublished: boolean;
    requireSections: boolean;
    slug?: string;
    slugs?: readonly string[];
  } = {
    onlyPublished: !args.includeDrafts,
    requireSections: true,
  };
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;
  const allRows = await listRankings(supabase, listOpts);

  const draftOnly = args.onlyDrafts ? allRows.filter((row) => !row.is_published) : allRows;
  const candidates = args.includeAll
    ? draftOnly
    : draftOnly.filter((row) => isOutOfBand(row.meta_desc_fr) || isOutOfBand(row.meta_desc_en));

  const rows = args.limit !== undefined ? candidates.slice(0, args.limit) : candidates;

  console.log(
    `[ranking-meta-desc] fetched=${allRows.length} eligible=${candidates.length} processing=${rows.length}`,
  );
  if (rows.length === 0) {
    console.log('[ranking-meta-desc] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnRanking(client, supabase, row, { dryRun: args.dryRun }),
    (done, total, last) => {
      const status = last.success
        ? `OK (${last.attempts}x, ${last.fr?.length}c/${last.en?.length}c)`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(`[ranking-meta-desc] ${done}/${total} ${last.slug} [${last.kind}] → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[ranking-meta-desc] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[ranking-meta-desc] success=${okCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `ranking-meta-desc-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
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
  console.log(`[ranking-meta-desc] run log → ${logPath}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[ranking-meta-desc] FATAL', err);
  process.exit(1);
});
