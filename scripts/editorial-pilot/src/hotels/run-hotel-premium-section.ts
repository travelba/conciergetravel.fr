/**
 * CLI — generate one of the 4 premium Concierge sections
 * (`conseil_enrichi`, `quartier_concierge`, `gastronomie_concierge`,
 * `timing_acces_concierge`) on a batch of hotels.
 *
 * Examples:
 *   pnpm exec tsx src/hotels/run-hotel-premium-section.ts --section=quartier_concierge --limit=5 --dry-run
 *   pnpm exec tsx src/hotels/run-hotel-premium-section.ts --section=conseil_enrichi --slug=le-bristol-paris
 *   pnpm exec tsx src/hotels/run-hotel-premium-section.ts --section=gastronomie_concierge --limit=50 --concurrency=4 --tavily
 *
 * Skill: editorial-pilot, concierge-voice-pipeline,
 *        content-enrichment-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import { tavilySearchAndExtract } from '../enrichment/tavily-client.js';
import {
  listHotels,
  projectHotelForLlm,
  updateHotelPremiumSection,
  type HotelRow,
  type PremiumSectionColumn,
  type SupabaseRestConfig,
} from './supabase-hotels.js';
import {
  generatePremiumSection,
  PremiumSectionGenerationError,
  type PremiumSectionKind,
  type PremiumGroundingSource,
} from './premium-section-generator.js';

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

const SECTION_KINDS: readonly PremiumSectionKind[] = [
  'conseil_enrichi',
  'quartier_concierge',
  'gastronomie_concierge',
  'timing_acces_concierge',
];

function parseArgs(argv: readonly string[]): {
  section: PremiumSectionKind;
  slug?: string;
  slugs?: readonly string[];
  limit?: number;
  dryRun: boolean;
  concurrency: number;
  tavily: boolean;
} {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const sectionRaw = map.get('section');
  if (typeof sectionRaw !== 'string') {
    throw new Error(`[premium-section] --section is required. One of: ${SECTION_KINDS.join(', ')}`);
  }
  if (!(SECTION_KINDS as readonly string[]).includes(sectionRaw)) {
    throw new Error(`[premium-section] unknown --section "${sectionRaw}".`);
  }
  const concRaw = map.get('concurrency');
  const concurrency = typeof concRaw === 'string' ? Math.min(8, Math.max(1, Number(concRaw))) : 3;
  const limitRaw = map.get('limit');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const out: {
    section: PremiumSectionKind;
    slug?: string;
    slugs?: readonly string[];
    limit?: number;
    dryRun: boolean;
    concurrency: number;
    tavily: boolean;
  } = {
    section: sectionRaw as PremiumSectionKind,
    dryRun: map.has('dry-run'),
    concurrency,
    tavily: map.has('tavily'),
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
  readonly body_fr_words?: number;
  readonly body_en_words?: number;
  readonly attempts?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly tavilySources?: number;
  readonly error?: string;
  readonly errorAttempts?: ReadonlyArray<{ raw: string; reason: string }>;
}

function countWords(s: string): number {
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

function tavilyQueryFor(kind: PremiumSectionKind, row: HotelRow): string | null {
  const name = row.name;
  const city = row.city ?? '';
  if (city.length === 0) return null;
  switch (kind) {
    case 'conseil_enrichi':
      return `${name} ${city} avis voyageurs spécificité chambre suite signature`;
    case 'quartier_concierge':
      return `${city} ${row.district ?? ''} quartier vie locale cafés boutiques`;
    case 'gastronomie_concierge':
      return `${name} ${city} restaurant gastronomie Michelin guide`;
    case 'timing_acces_concierge':
      return `${name} ${city} accès aéroport gare meilleure saison`;
  }
}

async function fetchGrounding(
  kind: PremiumSectionKind,
  row: HotelRow,
): Promise<readonly PremiumGroundingSource[]> {
  const query = tavilyQueryFor(kind, row);
  if (query === null) return [];
  try {
    const { extracted } = await tavilySearchAndExtract({
      query,
      maxSearchResults: 6,
      maxExtractUrls: 3,
      chunksPerSource: 2,
      searchDepth: 'advanced',
      extractDepth: 'basic',
    });
    return extracted.map((e) => ({
      url: e.url,
      title: e.title,
      snippet: e.content,
    }));
  } catch (err) {
    console.warn(
      `[premium-section] tavily grounding failed for ${row.slug}: ${(err as Error).message}`,
    );
    return [];
  }
}

async function runOnHotel(
  client: ReturnType<typeof buildLlmClient>,
  supabase: SupabaseRestConfig,
  kind: PremiumSectionKind,
  row: HotelRow,
  options: { dryRun: boolean; useTavily: boolean },
): Promise<PerHotelResult> {
  const input = projectHotelForLlm(row);
  const grounding = options.useTavily ? await fetchGrounding(kind, row) : [];
  try {
    const result = await generatePremiumSection(client, kind, input, {
      grounding,
    });
    if (!options.dryRun) {
      const column = kind as PremiumSectionColumn;
      await updateHotelPremiumSection(supabase, row.id, column, {
        fr: result.output.fr,
        en: result.output.en,
        _editorial_review_status: 'draft',
        _generated_at: new Date().toISOString(),
        _llm_model: client.model,
      });
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: true,
      body_fr_words: countWords(result.output.fr.body),
      body_en_words: countWords(result.output.en.body),
      attempts: result.attempts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      tavilySources: grounding.length,
    };
  } catch (err) {
    if (err instanceof PremiumSectionGenerationError) {
      return {
        slug: row.slug,
        hotelId: row.id,
        name: row.name,
        city: row.city,
        success: false,
        error: err.message,
        errorAttempts: err.attempts,
        tavilySources: grounding.length,
      };
    }
    return {
      slug: row.slug,
      hotelId: row.id,
      name: row.name,
      city: row.city,
      success: false,
      error: (err as Error).message,
      tavilySources: grounding.length,
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

  console.log(
    `[premium-section:${args.section}] provider=${provider} model=${client.model} tavily=${args.tavily}`,
  );
  console.log(
    `[premium-section:${args.section}] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'}`,
  );

  const listOpts: {
    requireDescription: boolean;
    onlyMissingPremiumSection: PremiumSectionColumn;
    limit?: number;
    slug?: string;
    slugs?: readonly string[];
  } = {
    requireDescription: true,
    onlyMissingPremiumSection: args.section as PremiumSectionColumn,
  };
  if (args.limit !== undefined) listOpts.limit = args.limit;
  if (args.slug !== undefined) listOpts.slug = args.slug;
  if (args.slugs !== undefined) listOpts.slugs = args.slugs;

  const rows = await listHotels(supabase, listOpts);

  console.log(`[premium-section:${args.section}] ${rows.length} hotel(s) eligible.`);
  if (rows.length === 0) {
    console.log(`[premium-section:${args.section}] nothing to do.`);
    return;
  }

  const startedAt = Date.now();
  const results = await withConcurrency(
    rows,
    args.concurrency,
    (row) =>
      runOnHotel(client, supabase, args.section, row, {
        dryRun: args.dryRun,
        useTavily: args.tavily,
      }),
    (done, total, last) => {
      const status = last.success
        ? `OK (${last.attempts}x, ${last.body_fr_words}w/${last.body_en_words}w, sources=${last.tavilySources ?? 0})`
        : `FAIL: ${last.error?.slice(0, 80)}`;
      console.log(
        `[premium-section:${args.section}] ${done}/${total} ${last.slug} (${last.city ?? '—'}) → ${status}`,
      );
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const okCount = results.filter((r) => r.success).length;
  const failCount = results.length - okCount;
  const totalInputTokens = results.reduce((acc, r) => acc + (r.inputTokens ?? 0), 0);
  const totalOutputTokens = results.reduce((acc, r) => acc + (r.outputTokens ?? 0), 0);

  console.log('---');
  console.log(
    `[premium-section:${args.section}] DONE in ${(elapsedMs / 1000).toFixed(1)}s — success=${okCount} fail=${failCount} tokens=${totalInputTokens}/${totalOutputTokens}`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(
    RUNS_DIR,
    `premium-section-${args.section}-${args.dryRun ? 'dry' : 'live'}-${ts}.json`,
  );
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        provider,
        model: client.model,
        section: args.section,
        dryRun: args.dryRun,
        tavily: args.tavily,
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
  console.log(`[premium-section:${args.section}] run log → ${logPath}`);

  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[premium-section] FATAL', err);
  process.exit(1);
});
