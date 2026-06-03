/**
 * CLI — structure & verify Michelin distinctions cited in a fiche's narrative.
 *
 * Why
 * ---
 * The catalogue audit flags ~210 fiches with `struct.no_fabricated_star`: the
 * narrative claims a Michelin star but `awards[]` carries no VERIFIED Michelin
 * entry. Investigation showed ~94 % of these are LEGITIMATE, source-cited claims
 * ("le Guide Michelin attribue 3 étoiles à L'Oustau de Baumanière") whose award
 * was simply never structured. The EEAT-correct fix is NOT to delete the
 * sentence (that destroys accurate gastronomic content) — it is to extract the
 * distinction into a structured, `verified: true` award entry, exactly like the
 * Airelles golden template (`patchAirellesAwards`).
 *
 * Pipeline (Rule 9 — extraction, not generation)
 * ----------------------------------------------
 * 1. Pre-filter: only fiches where `detectFabricatedStarClaim(narrative, awards)`
 *    is true (no LLM call on the ~2000 clean fiches).
 * 2. `llmExtract` (gpt-4o-mini, temp 0) over the fiche's OWN narrative: extract
 *    the Michelin distinction(s) of the hotel's restaurant(s), each with an
 *    `evidence_quote` and whether the Guide Michelin is the cited source.
 * 3. Post-validate: keep only distinctions sourced to the Guide Michelin with a
 *    star count present in the evidence. NO source → fiche left for manual review
 *    (these are the ~12 unsourced claims — never auto-verified).
 * 4. Merge: stamp `verified: true` on any existing Michelin award, append the
 *    extracted distinctions as verified awards (deduped by restaurant).
 *
 * Modes:
 *   --dry-run        extract + print per-fiche distinctions, NO write
 *   --slug=<s>       restrict to one fiche
 *   --slugs=a,b,c    restrict to a list (PowerShell: quote the arg)
 *   --limit=<n>      cap fiches processed
 *   --concurrency=<n> LLM concurrency (default 4)
 *
 * Skill: llm-output-robustness (Rule 9), content-enrichment-pipeline,
 * structured-data-schema-org, seo-technical (EEAT Hard Rule 7).
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { detectFabricatedStarClaim, hasVerifiedMichelinAward } from '@mch/domain/editorial';

import { llmExtract } from '../enrichment/llm-extract.js';
import { updateHotelAwards, type SupabaseRestConfig } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

interface CliArgs {
  readonly dryRun: boolean;
  readonly slug: string | null;
  readonly slugs: readonly string[] | null;
  readonly limit: number | null;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let slug: string | null = null;
  let slugs: readonly string[] | null = null;
  let limit: number | null = null;
  let concurrency = 4;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length) || null;
    else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (arg.startsWith('--concurrency=')) {
      const n = Number(arg.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.floor(n);
    }
  }
  return { dryRun, slug, slugs, limit, concurrency };
}

// ---------------------------------------------------------------------------
// Lightweight SELECT — only the columns the extractor needs.
// ---------------------------------------------------------------------------

interface StarRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
  readonly awards: unknown;
}

const STAR_COLUMNS =
  'id,slug,name,description_fr,description_en,long_description_sections,signature_experiences,awards';
const PAGE_SIZE = 300;

async function fetchStarRows(cfg: SupabaseRestConfig, opts: CliArgs): Promise<StarRow[]> {
  const bySlug = new Map<string, StarRow>();
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', STAR_COLUMNS);
    params.set('is_published', 'eq.true');
    params.set('order', 'slug.asc');
    params.set('limit', String(PAGE_SIZE));
    if (offset > 0) params.set('offset', String(offset));
    if (opts.slug !== null) params.set('slug', `eq.${opts.slug}`);
    else if (opts.slugs !== null && opts.slugs.length > 0) {
      params.set('slug', `in.(${opts.slugs.join(',')})`);
    }
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[extract-michelin] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[extract-michelin] SELECT did not return an array');
    const page = json as StarRow[];
    for (const row of page) if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
    offset += page.length;
    if (page.length < PAGE_SIZE || opts.slug !== null || opts.slugs !== null) break;
  }
  return [...bySlug.values()];
}

// ---------------------------------------------------------------------------
// Narrative assembly (mirror of the audit's `narrativeTexts`).
// ---------------------------------------------------------------------------

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function narrativeTexts(row: StarRow): string[] {
  const out: string[] = [];
  if (nonEmpty(row.description_fr)) out.push(row.description_fr);
  if (nonEmpty(row.description_en)) out.push(row.description_en);
  if (Array.isArray(row.long_description_sections)) {
    for (const s of row.long_description_sections) {
      if (s !== null && typeof s === 'object') {
        const rec = s as Record<string, unknown>;
        for (const k of ['title_fr', 'title_en', 'body_fr', 'body_en']) {
          if (nonEmpty(rec[k])) out.push(rec[k] as string);
        }
      }
    }
  }
  if (Array.isArray(row.signature_experiences)) {
    out.push(JSON.stringify(row.signature_experiences));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Extraction schema + post-validation.
// ---------------------------------------------------------------------------

/** FR/EN spelled-out star counts → integer (narratives rarely use digits). */
const WORD_TO_STARS: Readonly<Record<string, number>> = {
  une: 1,
  un: 1,
  one: 1,
  deux: 2,
  two: 2,
  trois: 3,
  three: 3,
};

const DistinctionSchema = z.object({
  restaurant_name: z.string().min(1).max(160),
  stars: z.preprocess((v) => {
    if (typeof v === 'string') {
      const t = v.trim().toLowerCase();
      const n = Number(t);
      if (Number.isFinite(n)) return n;
      if (t in WORD_TO_STARS) return WORD_TO_STARS[t];
      return v;
    }
    return v;
  }, z.number().int().min(1).max(3)),
  source_is_guide_michelin: z.boolean(),
  evidence_quote: z.string().min(1).max(400),
});

const ExtractionSchema = z.object({
  distinctions: z.array(DistinctionSchema).max(8).default([]),
});

const SCHEMA_DESCRIPTION = [
  '{',
  '  "distinctions": [   // Michelin distinctions held by THIS hotel\'s OWN restaurant(s). Empty array if none stated.',
  '    {',
  '      "restaurant_name": string,            // the restaurant name exactly as written',
  '      "stars": 1 | 2 | 3,                    // the Michelin star count stated for it',
  '      "source_is_guide_michelin": boolean,   // true ONLY if the text attributes the stars to the Guide Michelin / MICHELIN Guide',
  '      "evidence_quote": string               // the verbatim sentence stating the star count',
  '    }',
  '  ]',
  '}',
  '',
  'Rules:',
  '- Extract ONLY Michelin STAR distinctions of restaurant(s) belonging to the hotel described.',
  '- Do NOT extract MICHELIN Keys (clés), Bib Gourmand, Gault&Millau toques, or stars of NEARBY/other restaurants.',
  '- EXCLUDE any restaurant described as off-site or independent of the hotel: phrases like',
  '  "à quelques mètres", "à proximité", "non loin", "nearby", "a few metres away",',
  '  "X meters away", "X mètres" indicate it is NOT the hotel\'s own restaurant → skip it.',
  '- The star count is often spelled out in words: "une étoile" = 1, "deux étoiles" /',
  '  "doublement étoilé" = 2, "trois étoiles" = 3. Return the integer in "stars".',
  '- "source_is_guide_michelin" is true when the text says "Guide Michelin", "au Michelin",',
  '  "étoile(s) Michelin", "Michelin-starred", or "étoilé Michelin" — the Michelin star is the source.',
  '- If no Michelin star is stated for the hotel\'s OWN restaurant → return an empty "distinctions" array.',
  '- evidence_quote MUST be copied verbatim from SOURCE_CONTENT and state the star (word or digit).',
].join('\n');

interface VerifiedAward {
  readonly name_fr: string;
  readonly name_en: string;
  readonly issuer: string;
  readonly url: string;
  readonly verified: true;
  readonly _evidence_quote: string;
}

/**
 * True when the evidence explicitly states a Michelin star COUNT, so we never
 * fabricate one from a bare adjective. Accepts:
 *  - a number (digit or word) adjacent to "étoile(s)"/"star(s)"  → "deux étoiles"
 *  - the singular star noun "étoile" (word-boundaried, not the "étoilé" adjective) → 1
 *  - "doublement"/"triplement" étoilé → 2 / 3
 *  - "N MICHELIN star(s)" in English
 */
export function evidenceStatesStarCount(ev: string): boolean {
  const t = ev.normalize('NFC');
  // "doublement / triplement étoilé(e)" → 2 / 3.
  if (/(?:doublement|triplement)\s+[ée]toil/iu.test(t)) return true;
  // A count (digit or word) immediately followed by the star noun / "michelin star".
  if (
    /(?:\d|\b(?:une|deux|trois|one|two|three)\b)\s*(?:[ée]toiles?|michelin\s+stars?|stars?)/iu.test(
      t,
    )
  ) {
    return true;
  }
  if (/\d\s*michelin\b/iu.test(t)) return true;
  // The star NOUN "étoile(s)" — but NOT the adjective "étoilé(e/s)": the noun is
  // never followed by another letter. `(?!\p{L})` rejects "restaurant étoilé".
  // A named star noun ("son étoile Michelin", "deux étoiles") is an explicit
  // count signal; the bare adjective is not.
  if (/[ée]toiles?(?!\p{L})/iu.test(t) && /michelin/iu.test(t)) return true;
  return false;
}

function buildAward(d: z.infer<typeof DistinctionSchema>): VerifiedAward {
  const starWordFr = d.stars === 1 ? 'étoile' : 'étoiles';
  const starWordEn = d.stars === 1 ? 'Star' : 'Stars';
  return {
    name_fr: `${d.stars} ${starWordFr} au Guide MICHELIN — ${d.restaurant_name}`,
    name_en: `${d.stars} MICHELIN ${starWordEn} — ${d.restaurant_name}`,
    issuer: 'Guide MICHELIN',
    url: 'https://guide.michelin.com',
    verified: true,
    _evidence_quote: d.evidence_quote,
  };
}

function isMichelinAward(entry: unknown): boolean {
  if (entry === null || typeof entry !== 'object') return false;
  const rec = entry as Record<string, unknown>;
  const hay = [rec['issuer'], rec['name_fr'], rec['name_en'], rec['url']]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  return hay.includes('michelin');
}

/**
 * Merge extracted distinctions into the existing awards array:
 *  - stamp `verified: true` on any existing Michelin award (it is now confirmed
 *    by the evidenced extraction);
 *  - append extracted distinctions not already represented (deduped by the
 *    restaurant name appearing in an existing Michelin award).
 */
function mergeAwards(existing: unknown, distinctions: readonly VerifiedAward[]): unknown[] {
  const base: unknown[] = Array.isArray(existing) ? [...existing] : [];
  let hadMichelin = false;
  const stamped = base.map((entry) => {
    if (isMichelinAward(entry) && entry !== null && typeof entry === 'object') {
      hadMichelin = true;
      return { ...(entry as Record<string, unknown>), verified: true };
    }
    return entry;
  });
  // If a Michelin award already exists we only stamp it `verified` — appending
  // the extracted one would duplicate the distinction on the fiche. The richer
  // restaurant-named award is reserved for fiches that had no structured entry.
  if (hadMichelin) return stamped;
  return [...stamped, ...distinctions];
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await fn(items[i]!, i);
      }
    }),
  );
  return results;
}

interface FicheOutcome {
  readonly slug: string;
  readonly id: string;
  readonly name: string;
  readonly distinctions: readonly VerifiedAward[];
  readonly mergedAwards: unknown[];
  readonly status: 'extracted' | 'no_source' | 'llm_empty';
}

async function processFiche(row: StarRow): Promise<FicheOutcome> {
  const content = narrativeTexts(row).join('\n\n');
  const result = await llmExtract({
    content,
    context: `${row.name} — extract Michelin star distinctions of the hotel's own restaurant(s)`,
    schemaDescription: SCHEMA_DESCRIPTION,
    schema: ExtractionSchema,
    maxOutputTokens: 1200,
  });
  if (result === null || result.data.distinctions.length === 0) {
    return {
      slug: row.slug,
      id: row.id,
      name: row.name,
      distinctions: [],
      mergedAwards: Array.isArray(row.awards) ? row.awards : [],
      status: 'llm_empty',
    };
  }
  // Validation: the distinction must be sourced to the Guide Michelin AND the
  // evidence must EXPLICITLY state the star count. We accept spelled-out counts
  // ("deux étoiles Michelin"), the singular star noun ("son étoile Michelin" → 1)
  // and "doublement/triplement étoilé" (2/3). We REJECT the bare adjective
  // ("restaurant étoilé", "table étoilée") with no stated count: guessing a
  // count there fabricates a verified award and under-counts 3-star houses
  // (e.g. La Bouitte, Maison Lameloise) — those go to manual review instead.
  const sourced = result.data.distinctions.filter(
    (d) => d.source_is_guide_michelin && evidenceStatesStarCount(d.evidence_quote),
  );
  if (sourced.length === 0) {
    return {
      slug: row.slug,
      id: row.id,
      name: row.name,
      distinctions: [],
      mergedAwards: Array.isArray(row.awards) ? row.awards : [],
      status: 'no_source',
    };
  }
  const awards = sourced.map(buildAward);
  return {
    slug: row.slug,
    id: row.id,
    name: row.name,
    distinctions: awards,
    mergedAwards: mergeAwards(row.awards, awards),
    status: 'extracted',
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[extract-michelin] dryRun=${args.dryRun} concurrency=${args.concurrency}`);

  const allRows = await fetchStarRows(cfg, args);
  console.log(`[extract-michelin] fetched ${allRows.length} published fiche(s).`);

  // Pre-filter: only fiches the audit flags as fabricated-star (no LLM on clean fiches).
  let candidates = allRows.filter((r) => detectFabricatedStarClaim(narrativeTexts(r), r.awards));
  if (args.limit !== null) candidates = candidates.slice(0, args.limit);
  console.log(
    `[extract-michelin] ${candidates.length} candidate(s) with an unverified star claim.\n`,
  );

  if (candidates.length === 0) {
    console.log('[extract-michelin] nothing to do.');
    return;
  }

  const outcomes = await runWithConcurrency(candidates, args.concurrency, (row) =>
    processFiche(row),
  );

  const extracted = outcomes.filter((o) => o.status === 'extracted');
  const noSource = outcomes.filter((o) => o.status !== 'extracted');

  for (const o of extracted) {
    console.log(`→ ${o.slug} (${o.name})`);
    for (const a of o.distinctions) {
      console.log(`     ✓ ${a.name_fr}`);
      console.log(`        evidence: "${a._evidence_quote.slice(0, 140)}"`);
    }
  }

  console.log(
    `\n[extract-michelin] ${extracted.length} fiche(s) with structured verified award(s); ` +
      `${noSource.length} left for manual review (no Guide Michelin source / LLM empty).`,
  );
  if (noSource.length > 0) {
    console.log(`  manual review: ${noSource.map((o) => o.slug).join(', ')}`);
  }

  // Sanity guard — every merged award set must now satisfy the audit predicate.
  const failedGuard = extracted.filter((o) => !hasVerifiedMichelinAward(o.mergedAwards));
  if (failedGuard.length > 0) {
    console.warn(
      `[extract-michelin] ⚠ ${failedGuard.length} merged set(s) still fail hasVerifiedMichelinAward: ` +
        failedGuard.map((o) => o.slug).join(', '),
    );
  }

  if (args.dryRun) {
    console.log('\n[extract-michelin] DRY RUN — no write performed.');
    return;
  }

  let written = 0;
  for (const o of extracted) {
    await updateHotelAwards(cfg, o.id, o.mergedAwards);
    written += 1;
  }
  console.log(`\n[extract-michelin] ✅ wrote verified awards to ${written} fiche(s).`);
}

main().catch((err) => {
  console.error('[extract-michelin] FATAL', err);
  process.exit(1);
});
