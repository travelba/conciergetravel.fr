/**
 * CLI — enrich a curated `editorial_rankings` row by generating its
 * `editorial_sections` and `faq` blocks WITHOUT touching the existing
 * intro/outro/entries.
 *
 * Use case: curated rankings whose entries are sourced authentically
 * (e.g. `classement-travel-leisure-worlds-best-2025` — 84 official
 * Travel + Leisure award entries). The v2 bulk runner
 * (`run-rankings-v2-bulk.ts` → `push-ranking-v2.ts`) deletes-and-
 * replaces all entries on every push, which would destroy the
 * authentic ordering. This script is the surgical alternative.
 *
 * What it does:
 *   1. Loads the existing row by slug.
 *   2. Builds a minimal `RankingSeed` from the row + CLI keywords.
 *   3. Calls Call-M-Meta (section_plan) + Calls S (section bodies)
 *      + Call FAQ — reusing the v2 helpers via the exports added to
 *      `generate-ranking-v2.ts`.
 *   4. Validates the FAQ (`postValidateFaq` — clamps to 15, logs
 *      canonical theme coverage).
 *   5. PATCHes `editorial_rankings` with `editorial_sections` + `faq`
 *      (+ `is_published = true` if `--publish`).
 *
 * What it does NOT do:
 *   - Generate `entries` — they are preserved as-is.
 *   - Regenerate `intro_fr/en` / `outro_fr/en` / `meta_*` — preserved.
 *   - Touch `axes` — preserved.
 *
 * Modes:
 *   --slug=<slug>            ranking slug (required)
 *   --keywords=a,b,c         keywordsFr override (optional — defaults
 *                            to a generic awarded-list set)
 *   --target=<N>             targetLength used in the prompts (default
 *                            = current entry count from `editorial_ranking_entries`)
 *   --dry-run                generate + print to stdout, do NOT PATCH
 *   --publish                flip `is_published = true` in the PATCH
 *   --concurrency=<N>        parallel S calls (default 3, max 6)
 *
 * Examples:
 *   pnpm tsx src/rankings/enrich-ranking-sections-only.ts --slug=classement-travel-leisure-worlds-best-2025 --dry-run
 *   pnpm tsx src/rankings/enrich-ranking-sections-only.ts --slug=classement-travel-leisure-worlds-best-2025 --publish --keywords="palmarès,Travel + Leisure,World's Best Awards,2025,lecteurs"
 *
 * Skill: editorial-pilot, llm-output-robustness, editorial-rankings-matrix.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient } from '../llm.js';
import type { HotelCatalogRow } from './load-hotels-catalog.js';
import type { RankingSeed, RankingKind } from './rankings-catalog.js';
import {
  CallMMetaSchema,
  CallSSchema,
  CallFaqSchema,
  EditorialSectionSchema,
  SYSTEM_PROMPT,
  buildPromptCallMMeta,
  buildPromptCallS,
  buildPromptCallFaq,
  callLlm,
  runWithConcurrency,
  postValidateFaq,
  type EditorialSection,
} from './generate-ranking-v2.js';
import {
  listRankings,
  updateRankingSectionsAndFaq,
  type SupabaseRestConfig,
} from './supabase-rankings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const KIND_VALUES: readonly RankingKind[] = ['best_of', 'awarded', 'thematic', 'geographic'];
const isRankingKind = (s: string): s is RankingKind =>
  (KIND_VALUES as readonly string[]).includes(s);

interface ParsedArgs {
  readonly slug: string;
  readonly keywords?: readonly string[];
  readonly target?: number;
  readonly dryRun: boolean;
  readonly publish: boolean;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const slug = map.get('slug');
  if (typeof slug !== 'string' || slug.length === 0) {
    console.error('Usage: --slug=<ranking-slug> [--dry-run] [--publish] [--keywords=a,b,c]');
    process.exit(1);
  }
  const concRaw = map.get('concurrency');
  const concurrency = typeof concRaw === 'string' ? Math.min(6, Math.max(1, Number(concRaw))) : 3;
  const targetRaw = map.get('target');
  const target = typeof targetRaw === 'string' ? Math.max(3, Number(targetRaw)) : undefined;
  const kwRaw = map.get('keywords');
  const keywords =
    typeof kwRaw === 'string'
      ? kwRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : undefined;
  const out: ParsedArgs = {
    slug,
    dryRun: map.get('dry-run') === true,
    publish: map.get('publish') === true,
    concurrency,
    ...(keywords !== undefined ? { keywords } : {}),
    ...(target !== undefined ? { target } : {}),
  };
  return out;
}

/**
 * Count entries for a ranking via PostgREST. Uses a plain GET because
 * `Prefer: count=exact` 400's on this dataset without a paired
 * `Range` header. We just fetch the ids and count the array — cheap
 * on the rare side (≤ 100 entries per ranking, no full payload).
 */
async function countEntries(cfg: SupabaseRestConfig, rankingId: string): Promise<number> {
  const url = `${cfg.url}/rest/v1/editorial_ranking_entries?select=rank&ranking_id=eq.${encodeURIComponent(rankingId)}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[count-entries] failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const arr = (await res.json()) as unknown[];
  return Array.isArray(arr) ? arr.length : 0;
}

/**
 * Build a minimal `RankingSeed` from a DB row. `eligibility` is set
 * to `() => false` because this enricher never regenerates entries —
 * the predicate is irrelevant to the prompts we call here.
 */
function buildSeedFromRow(opts: {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly kind: RankingKind;
  readonly targetLength: number;
  readonly keywordsFr: readonly string[];
}): RankingSeed {
  return {
    slug: opts.slug,
    titleFr: opts.titleFr,
    titleEn: opts.titleEn,
    kind: opts.kind,
    targetLength: opts.targetLength,
    keywordsFr: opts.keywordsFr,
    eligibility: (_h: HotelCatalogRow) => false,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);

  const supaParsed = SupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
  });
  if (!supaParsed.success) {
    console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  const cfg: SupabaseRestConfig = {
    url: supaParsed.data.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supaParsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Load the row (include drafts).
  const rows = await listRankings(cfg, {
    slug: args.slug,
    onlyPublished: false,
    requireSections: false,
    limit: 1,
  });
  if (rows.length === 0) {
    console.error(`Ranking not found: ${args.slug}`);
    process.exit(1);
  }
  const row = rows[0]!;

  if (!isRankingKind(row.kind)) {
    console.error(`Unexpected kind="${row.kind}" on row ${row.slug}`);
    process.exit(1);
  }

  const entryCount = args.target ?? (await countEntries(cfg, row.id));
  console.log(`[${row.slug}] kind=${row.kind} title="${row.title_fr}" entries=${entryCount}`);

  // Default keywords if none supplied — kept generic for curated awarded lists.
  const keywords: readonly string[] =
    args.keywords ??
    (row.kind === 'awarded'
      ? [
          'palmarès',
          'distinctions',
          'awards',
          'critères de sélection',
          'transparence éditoriale',
          'voyage de luxe',
        ]
      : ['classement', 'sélection éditoriale', 'critères', 'voyage de luxe']);

  const seed = buildSeedFromRow({
    slug: row.slug,
    titleFr: row.title_fr,
    titleEn: row.title_en,
    kind: row.kind,
    targetLength: entryCount,
    keywordsFr: keywords,
  });

  // Phase 1 — Call M Meta (we discard meta_title/meta_desc, keep section_plan).
  console.log(`[${seed.slug}] → Call M Meta (section plan)…`);
  const callM = await callLlm(
    llm,
    SYSTEM_PROMPT,
    buildPromptCallMMeta(seed),
    CallMMetaSchema,
    `enrich ${seed.slug} call-M-meta`,
  );

  // Deduplicate plan keys.
  const seenKeys = new Set<string>();
  const plan = callM.section_plan.map((p) => {
    let k = p.key;
    let suffix = 1;
    while (seenKeys.has(k)) {
      suffix += 1;
      k = `${p.key}-${suffix}`;
    }
    seenKeys.add(k);
    return { ...p, key: k };
  });
  console.log(
    `[${seed.slug}]    section_plan: ${plan.length} sections — ${plan.map((p) => p.key).join(', ')}`,
  );

  // Phase 2 — Calls S (bodies) + Call FAQ in parallel.
  console.log(
    `[${seed.slug}] → Calls S (n=${plan.length}, concurrency=${args.concurrency}) + Call FAQ…`,
  );
  const anchors = plan.map((p) => p.key);
  const [sectionBodies, callFaq] = await Promise.all([
    runWithConcurrency(plan, args.concurrency, (p) =>
      callLlm(
        llm,
        SYSTEM_PROMPT,
        buildPromptCallS(seed, p, plan),
        CallSSchema,
        `enrich ${seed.slug} S/${p.key}`,
      ),
    ),
    callLlm(
      llm,
      SYSTEM_PROMPT,
      buildPromptCallFaq(seed, anchors),
      CallFaqSchema,
      `enrich ${seed.slug} call-FAQ`,
    ),
  ]);

  // Compose `EditorialSection[]` from plan + bodies.
  const sections: EditorialSection[] = plan.map((p, i) => {
    const body = sectionBodies[i]!;
    return {
      key: p.key,
      type: p.type,
      title_fr: p.title_fr,
      title_en: p.title_en ?? '',
      body_fr: body.body_fr,
      body_en: body.body_en,
    };
  });

  // Validate the sections payload one more time (defensive — Calls S
  // were already schema-validated).
  const sectionsValidation = z.array(EditorialSectionSchema).safeParse(sections);
  if (!sectionsValidation.success) {
    console.error(
      `[${seed.slug}] sections schema-fail:\n${sectionsValidation.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
    process.exit(1);
  }

  // FAQ post-validation (clamp 10-15, log canonical gaps).
  const cleanedFaq = postValidateFaq(callFaq.faq, seed.slug);

  // Words check on body_fr (CDC ≥ 300 chars; we want roughly 300-700 words).
  const totalBodyWords = sections.reduce(
    (acc, s) => acc + s.body_fr.split(/\s+/).filter((w) => w.length > 0).length,
    0,
  );
  console.log(
    `[${seed.slug}]    sections: ${sections.length} • body_fr ≈ ${totalBodyWords} words • faq: ${cleanedFaq.length}`,
  );

  if (args.dryRun) {
    console.log('— DRY RUN — sections + faq payload:');
    console.log(JSON.stringify({ sections, faq: cleanedFaq }, null, 2).slice(0, 4000));
    console.log('— end DRY RUN —');
    return;
  }

  console.log(
    `[${seed.slug}] → PATCH editorial_rankings (sections + faq${args.publish ? ' + is_published=true' : ''})…`,
  );
  await updateRankingSectionsAndFaq(cfg, row.id, {
    editorial_sections: sections,
    faq: cleanedFaq,
    publish: args.publish,
  });
  console.log(`[${seed.slug}] ✓ patched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
