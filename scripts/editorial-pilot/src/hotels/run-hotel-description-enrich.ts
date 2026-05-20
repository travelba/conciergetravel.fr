/**
 * CLI — enrich `hotels.description_{fr,en}` from Wikidata + Wikipedia
 * for the hotels that have a Supabase identity (name+city+stars) but
 * no description yet (494 rows as of 2026-05-20).
 *
 * Per `content-enrichment-pipeline` SKILL Rule 9: refuse to write when
 * source layer < 3 anchor facts. Hallucinated content is worse than
 * absent content (it breaks EEAT and feeds AI Overviews garbage).
 *
 * Modes:
 *   --slug=<slug>            single hotel
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels
 *   --dry-run                fetch sources + LLM call, print only
 *   --require-wikidata       only hotels with wikidata_id set
 *   --require-any-source     only hotels with at least one external source
 *   --concurrency=<N>        default 2 (Wikidata SPARQL is rate-limited)
 *   --min-richness=<N>       skip hotel before calling LLM if source
 *                            richness score < N (default 3, see
 *                            scoreSourceRichness)
 *
 * Examples:
 *   pnpm exec tsx src/hotels/run-hotel-description-enrich.ts --limit=5 --dry-run --require-wikidata
 *   pnpm exec tsx src/hotels/run-hotel-description-enrich.ts --require-any-source --concurrency=3
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, llm-output-robustness.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import {
  listHotelsMissingDescription,
  updateHotelDescription,
  type HotelRow,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  collectSourcesForHotel,
  generateDescriptionFromWiki,
  scoreSourceRichness,
  DescriptionGenerationError,
} from './description-from-wiki-generator.js';

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

interface CliArgs {
  slug?: string;
  slugs?: readonly string[];
  limit?: number;
  dryRun: boolean;
  requireWikidata: boolean;
  requireAnySource: boolean;
  concurrency: number;
  minRichness: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const concRaw = map.get('concurrency');
  const concurrency =
    typeof concRaw === 'string' ? Math.min(6, Math.max(1, Number(concRaw))) : 2;
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const minRichRaw = map.get('min-richness');
  const out: CliArgs = {
    dryRun: map.has('dry-run'),
    requireWikidata: map.has('require-wikidata'),
    requireAnySource: map.has('require-any-source'),
    concurrency,
    minRichness: typeof minRichRaw === 'string' ? Number(minRichRaw) : 2,
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
  readonly skipReason?: string;
  readonly sourceRichness?: number;
  readonly anchorFactCount?: number;
  readonly fr_words?: number;
  readonly en_words?: number;
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly error?: string;
}

async function runOnHotel(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  row: HotelRow,
  options: { dryRun: boolean; minRichness: number },
): Promise<PerHotelResult> {
  // 1. Collect sources (Wikidata + Wikipedia)
  const sources = await collectSourcesForHotel(row);
  const richness = scoreSourceRichness(sources);

  // 2. Skip cheaply if sources are too thin to anchor 3 facts
  if (richness < options.minRichness) {
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: false,
      skipReason: `source_richness_${richness}_below_${options.minRichness}`,
      sourceRichness: richness,
    };
  }

  // 3. Generate
  try {
    const result = await generateDescriptionFromWiki(client, {
      slug: row.slug,
      name: row.name,
      name_en: row.name_en,
      city: row.city,
      district: row.district,
      country_code: row.country_code,
      country_label_fr: row.country_label_fr,
      country_label_en: row.country_label_en,
      stars: row.stars,
      is_palace: row.is_palace,
      source_facts: sources,
    });

    // The model might still decide to skip after seeing the data
    if (result.skipped) {
      return {
        slug: row.slug,
        hotelId: row.id,
        name: row.name,
        city: row.city,
        success: false,
        skipReason: result.output.skip_reason ?? 'model_skipped',
        sourceRichness: richness,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    }

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
      sourceRichness: richness,
      anchorFactCount: result.output.anchor_facts.length,
      fr_words: countWords(result.output.fr),
      en_words: countWords(result.output.en),
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (err) {
    if (err instanceof DescriptionGenerationError) {
      return {
        slug: row.slug,
        hotelId: row.id,
        name: row.name,
        city: row.city,
        success: false,
        sourceRichness: richness,
        error: err.message.slice(0, 200),
      };
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: false,
      sourceRichness: richness,
      error: (err as Error).message.slice(0, 200),
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

  console.log(`[desc-enrich] provider=${provider} model=${client.model}`);
  console.log(
    `[desc-enrich] mode dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} requireWikidata=${args.requireWikidata} requireAnySource=${args.requireAnySource} minRichness=${args.minRichness}`,
  );

  const listOpts: {
    requireWikidata: boolean;
    requireAnyExternalSource: boolean;
    limit?: number;
    slug?: string;
    slugs?: readonly string[];
  } = {
    requireWikidata: args.requireWikidata,
    requireAnyExternalSource: args.requireAnySource,
  };
  if (args.limit !== undefined) listOpts.limit = args.limit;
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;
  const rows = await listHotelsMissingDescription(supabase, listOpts);

  console.log(`[desc-enrich] ${rows.length} hotel(s) eligible.`);
  if (rows.length === 0) {
    console.log('[desc-enrich] nothing to do.');
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) => runOnHotel(client, supabase, row, { dryRun: args.dryRun, minRichness: args.minRichness }),
    (done, total, last) => {
      const status = last.success
        ? `OK (r=${last.sourceRichness}, ${last.fr_words}w/${last.en_words}w, ${last.anchorFactCount} facts)`
        : `SKIP: ${last.skipReason ?? last.error?.slice(0, 80) ?? '?'}`;
      console.log(
        `[desc-enrich] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`,
      );
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const skipCount = results.filter((r) => !r.success && r.skipReason !== undefined).length;
  const failCount = results.filter((r) => !r.success && r.error !== undefined).length;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(`[desc-enrich] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[desc-enrich] success=${okCount} skip=${skipCount} fail=${failCount} tokens=${totalInputTokens} in / ${totalOutputTokens} out`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(
    RUNS_DIR,
    `desc-enrich-${args.dryRun ? 'dry' : 'live'}-${ts}.json`,
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
        totalEligible: rows.length,
        success: okCount,
        skip: skipCount,
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
  console.log(`[desc-enrich] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[desc-enrich] FATAL', err);
  process.exit(1);
});
