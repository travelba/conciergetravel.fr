/**
 * Deterministic P0 patcher for the first DataSEO hotel wave (WP-C1 + WP-C2).
 *
 * Dry-run by default. It only applies low-risk deterministic cleanup:
 * - trailing pipe in meta titles,
 * - clearly noisy public FAQ/GEO items (celebrities, net worth, salaries),
 * - FALSE "Palace" claims (WP-C1): the Palace distinction is a French
 *   ministerial label (Atout France, Collection 2026 = 33 hotels published
 *   2026-06-02). A non-listed hotel must not carry `luxury_tier=
 *   'palace_atout_france'`, a `palace_atout_france` affiliation entry, nor
 *   descriptive "palace" claims in its editorial fields. Claims are removed
 *   or downgraded ("hôtel de légende", "hôtel emblématique") — NEVER replaced
 *   by an invented claim. Occurrences inside the hotel's own commercial name
 *   (Taj Lake Palace, El Palace Hotel…) are preserved via name masking.
 *
 * It deliberately does not regenerate prose, EEAT, photos or factual summaries.
 * Every run writes a JSON report + full row backup under runs/ (rollback).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

/**
 * Wave-1 scope (2026-07-02 inventory `runs/palace-claims-inventory-*.json`):
 * the 18 fiches mis-tiered `palace_atout_france` + the P0 fiches of the
 * DataSEO action plan carrying textual Palace claims.
 */
const DEFAULT_SLUGS = [
  // Mis-tiered palace_atout_france (18)
  'jumeirah-mina-a-salam',
  'jumeirah-dar-al-masyaf',
  'mamaison-suite-hotel-pachtuv-palace',
  'the-regent-berlin',
  'brenners-park-hotel-and-spa',
  'hotel-adlon-kempinski',
  'hotel-claris',
  'el-palace-hotel',
  'the-berkeley',
  'the-langham-hotel',
  'claridge-s-londres',
  'the-st-regis-rome',
  'the-lake-como-edition',
  'imperial-hotel-tokyo',
  'palais-faraj',
  'prince-s-palace',
  'the-fairmont-copley-plaza-hotel',
  'the-plaza-hotel',
  // DataSEO P0 with textual claims only
  'hotel-ritz-paris',
  'hotel-de-russie-rocco-forte-collection',
  'burj-al-arab',
  // DataSEO P0 kept for meta/noise cleanup (no false palace claim found)
  '25hours-hotel-dubai-one-central',
  'bulgari-roma',
  'trianon-palace-versailles-a-waldorf-astoria-hotel',
  'taj-lake-palace',
] as const;

/**
 * WP-C1 — luxury_tier remap for the 18 mis-tiered fiches. Target tier =
 * the strongest REAL affiliation the row already carries (verified against
 * `hotels.affiliations` on 2026-07-02), else `self_5_star`. `null` = leave
 * the tier untouched.
 */
const TIER_REMAP: Readonly<Record<string, string>> = {
  'jumeirah-mina-a-salam': 'jumeirah',
  'jumeirah-dar-al-masyaf': 'jumeirah',
  'mamaison-suite-hotel-pachtuv-palace': 'self_5_star',
  'the-regent-berlin': 'self_5_star',
  'brenners-park-hotel-and-spa': 'oetker_collection',
  'hotel-adlon-kempinski': 'kempinski',
  'hotel-claris': 'small_luxury_hotels',
  'el-palace-hotel': 'self_5_star',
  'the-berkeley': 'forbes_5_star',
  'the-langham-hotel': 'self_5_star',
  'claridge-s-londres': 'self_5_star',
  'the-st-regis-rome': 'st_regis',
  'the-lake-como-edition': 'self_5_star',
  'imperial-hotel-tokyo': 'self_5_star',
  'palais-faraj': 'self_5_star',
  'prince-s-palace': 'self_5_star',
  'the-fairmont-copley-plaza-hotel': 'fairmont',
  'the-plaza-hotel': 'fairmont',
};

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(40)
    .refine((k) => k.startsWith('eyJ'), 'not a service-role JWT — writes would no-op under RLS'),
});

const HotelRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  country_code: z.string().nullable(),
  is_palace: z.boolean().nullable(),
  luxury_tier: z.string().nullable(),
  affiliations: z.unknown().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  meta_title_fr: z.string().nullable(),
  meta_title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  faq_content: z.unknown().nullable(),
  faq_content_kit: z.unknown().nullable(),
  concierge_questions: z.unknown().nullable(),
  geo_qa: z.unknown().nullable(),
});

type HotelRow = z.infer<typeof HotelRowSchema>;

interface Args {
  readonly apply: boolean;
  readonly slugs: readonly string[];
}

interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string;
}

interface PatchPlan {
  readonly row: HotelRow;
  readonly changes: readonly FieldChange[];
  readonly notes: readonly string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const slugsRaw = argv.find((arg) => arg.startsWith('--slugs='))?.slice('--slugs='.length);
  return {
    apply: argv.includes('--apply'),
    slugs:
      slugsRaw === undefined
        ? DEFAULT_SLUGS
        : slugsRaw
            .split(',')
            .map((slug) => slug.trim())
            .filter((slug) => slug.length > 0),
  };
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Newline-preserving spacing cleanup — paragraph breaks are content.
 * No "insert space after punctuation" rule: it corrupts domains
 * (Trip.com → "Trip. com") and decimals. Only collapses excess whitespace.
 */
function cleanupSpacing(value: string): string {
  return value
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+([,.;:])/gu, '$1')
    .replace(/[ \t]+(?=\n)/gu, '')
    .trim();
}

function normalizeSeoField(value: string | null): {
  readonly value: string | null;
  readonly reasons: readonly string[];
} {
  if (value === null) return { value, reasons: [] };
  const reasons: string[] = [];
  let next = value;
  const stripped = next.replace(/\s*\|+\s*$/gu, '').trim();
  if (stripped !== next) {
    next = stripped;
    reasons.push('strip_trailing_pipe');
  }

  next = cleanupSpacing(next);
  return { value: next, reasons };
}

// ─── WP-C1 — deterministic Palace-claim rewriting ────────────────────────────

const MASK = '\u0000NAME\u0000';

/**
 * Phrase-level substitutions, FR + EN. Patterns are precision-targeted to the
 * claim shapes observed in the 2026-07-02 inventory — a generic bare "palace"
 * swap would corrupt legit uses (Buckingham Palace, Palace of Versailles,
 * commercial names). Order matters: multi-word claim strips run before the
 * descriptor downgrades.
 */
const CLAIM_REWRITES: readonly (readonly [RegExp, string])[] = [
  // FR — claim-fragment strips (keep the true 5-star part of the sentence)
  [/\s*et (?:le|la|l['’])\s*distingue Palace\b/giu, ''],
  [/\s*et (?:l['’]|la |le )?inscrit parmi les Palaces\b/giu, ''],
  [/\s*et la distinction Palace\b/giu, ''],
  [/,?\s*class[ée] palace\b/giu, ''],
  [/\bla Distinction Palace et\s+/giu, ''],
  [/,?\s*ce qui lui vaut sa distinction en tant que palace\b/giu, ''],
  [/\bEn tant que palace, il\b/gu, 'Il'],
  [/\bEn tant que palace, elle\b/gu, 'Elle'],
  [/\bson statut de palace, une distinction qui t[ée]moigne de\s+/giu, ''],
  [/\bits palace status, a distinction that reflects\s+/giu, ''],
  // Word-duplication cleanup — earlier downgrades ("This palace hotel" →
  // "This hotel hotel") can leave a doubled noun.
  [/\bhotel hotel\b/giu, 'hotel'],
  [/\bhôtel hôtel\b/giu, 'hôtel'],
  // EN — claim-fragment strips
  [/\s*and distinguishes it as a Palace\b/giu, ''],
  [/\s*and includes it among the Palaces\b/giu, ''],
  [/\s*and (?:the |its )?Palace distinction\b/giu, ''],
  [/\bthe Palace distinction and\s+/giu, ''],
  [/,?\s*classified as a palace\b/giu, ''],
  // FR — descriptor downgrades (specific shapes first, generic last)
  [/^Palace (?=à|au|aux|sur|en|dans)/gmu, 'Hôtel de légende '],
  [/\bpalace embl[ée]matique\b/giu, 'hôtel emblématique'],
  [/\bCe palace\b/gu, 'Cet hôtel'],
  [/\bce palace\b/gu, 'cet hôtel'],
  [/\bhôtel palace\b/giu, 'hôtel'],
  [/\bun palace historique\b/giu, 'un hôtel historique'],
  [/\bun palace (?:cinq|5) [ée]toiles\b/giu, 'un hôtel cinq étoiles'],
  // Architectural fact stays: "un palace construit/bâti/datant de 1913"
  // describes the BUILDING (palais), not the French distinction.
  [
    /\bun palace\b(?!\s+(?:construit|b[âa]ti|datant|[ée]difi[ée]|[ée]rig[ée]))/giu,
    'un hôtel de légende',
  ],
  [/\bpalace situ[ée]\b/giu, 'hôtel situé'],
  [/\bpalace au c(?:œ|oe)ur\b/giu, 'hôtel au cœur'],
  [/\bPalace 5 [ée]toiles situ[ée]\b/giu, 'Hôtel 5 étoiles situé'],
  [/\bpalace 5 [ée]toiles\b/giu, 'hôtel 5 étoiles'],
  [/\badresse Palace\b/gu, 'adresse de légende'],
  [/—\s*Palace\s+(?=[A-ZÀ-Ü])/gu, '— Hôtel '],
  // "X, palace à/sur/en …" — the meta_desc appositive shape
  [/,\s*palace (?=(?:à|a|au|aux|sur|en|dans|situ[ée])\s)/giu, ', hôtel de légende '],
  [/\bLe palace fait partie\b/gu, 'L’hôtel fait partie'],
  [/\ble palace fait partie\b/gu, 'l’hôtel fait partie'],
  [/\bLe palace propose\b/gu, 'L’hôtel propose'],
  [/\ble palace propose\b/gu, 'l’hôtel propose'],
  // EN — descriptor downgrades
  [/—\s*Luxury Palace in\b/gu, '— Luxury Hotel in'],
  [/\ba (?:5-star|five-star) palace\b/giu, 'a 5-star hotel'],
  [/^Iconic palace in\b/gmu, 'Iconic hotel in'],
  [/^Palace in\b/gmu, 'Legendary hotel in'],
  [/\bThe palace (?=is|offers|provides|features)/gu, 'The hotel '],
  [/\bthe palace (?=is|offers|provides|features)/gu, 'the hotel '],
  [/\ban iconic palace\b/giu, 'an iconic hotel'],
  [/\bThis palace\b/gu, 'This hotel'],
  [/\bthis palace\b/gu, 'this hotel'],
  [/\bpalace hotel\b/giu, 'hotel'],
  [
    /\ba palace\b(?!\s+(?:built|dating|constructed|erected|converted|from))/giu,
    'a legendary hotel',
  ],
  [/\bPalace 5-star in\b/gu, '5-star hotel in'],
  [/\bThis Palace address\b/gu, 'This legendary address'],
];

interface ClaimRewrite {
  readonly value: string;
  readonly reasons: readonly string[];
}

/**
 * Rewrite false Palace claims out of a prose field. The hotel's own name is
 * masked first so commercial-name occurrences ("Taj Lake Palace", "El Palace
 * Hotel") survive untouched. For non-FR hotels, any sentence still claiming
 * an Atout France classification is dropped entirely (Atout France only
 * classifies French establishments).
 */
function rewritePalaceClaims(row: HotelRow, raw: string): ClaimRewrite {
  const reasons = new Set<string>();
  const base = [row.name, row.name.replace(/^(?:Le |La |L['’]|The |El )/u, '')];
  // Apostrophe-less variant covers loose FAQ phrasings ("Prince Palace hotel"
  // for "Prince's Palace").
  const nameVariants = [...base, ...base.map((n) => n.replace(/['’]s /gu, ' '))]
    .map((n) => n.trim())
    .filter((n, i, arr) => n.length >= 4 && /palace|palais/iu.test(n) && arr.indexOf(n) === i)
    .sort((a, b) => b.length - a.length);

  let text = raw;
  const masks: string[] = [];
  for (const variant of nameVariants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    text = text.replace(new RegExp(escaped, 'gu'), (m) => {
      masks.push(m);
      return `${MASK}${masks.length - 1}${MASK}`;
    });
  }

  for (const [pattern, replacement] of CLAIM_REWRITES) {
    const next = text.replace(pattern, replacement);
    if (next !== text) {
      reasons.add(`palace_claim:${pattern.source.slice(0, 40)}`);
      text = next;
    }
  }

  // Safety net: a non-French hotel cannot carry ANY Atout France claim.
  // Sentence-drop runs per paragraph so `\n\n` breaks survive.
  if (row.country_code !== null && row.country_code !== 'FR' && /atout france/iu.test(text)) {
    reasons.add('drop_atout_france_sentence_non_fr');
    text = text
      .split(/\n{2,}/u)
      .map((paragraph) =>
        splitSentences(paragraph)
          .filter((s) => !/atout france/iu.test(s))
          .join(' '),
      )
      .filter((paragraph) => paragraph.length > 0)
      .join('\n\n');
  }

  text = text.replace(new RegExp(`${MASK}(\\d+)${MASK}`, 'gu'), (_m, i: string) => {
    const idx = Number.parseInt(i, 10);
    return masks[idx] ?? '';
  });

  return { value: cleanupSpacing(text), reasons: [...reasons] };
}

/** Recursively rewrite claims inside a JSON surface (faq_content, geo_qa…). */
function rewriteJsonClaims(row: HotelRow, value: unknown): { value: unknown; touched: boolean } {
  if (typeof value === 'string') {
    const rewritten = rewritePalaceClaims(row, value);
    return { value: rewritten.value, touched: rewritten.reasons.length > 0 };
  }
  if (Array.isArray(value)) {
    let touched = false;
    const next = value.map((item) => {
      const r = rewriteJsonClaims(row, item);
      touched = touched || r.touched;
      return r.value;
    });
    return { value: next, touched };
  }
  if (value !== null && typeof value === 'object') {
    let touched = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const r = rewriteJsonClaims(row, v);
      touched = touched || r.touched;
      next[k] = r.value;
    }
    return { value: next, touched };
  }
  return { value, touched: false };
}

const AffiliationEntrySchema = z.object({ source: z.string() }).passthrough();

/** Strip the false `palace_atout_france` entry, keep every other affiliation. */
function stripPalaceAffiliation(value: unknown): { value: unknown; removed: number } {
  if (!Array.isArray(value)) return { value, removed: 0 };
  const kept = value.filter((entry) => {
    const parsed = AffiliationEntrySchema.safeParse(entry);
    return !(parsed.success && parsed.data.source === 'palace_atout_france');
  });
  return { value: kept, removed: value.length - kept.length };
}

// ─── WP-C2 — noisy PAA removal (unchanged) ───────────────────────────────────

const NOISE_PATTERNS = [
  /\bnet worth\b/iu,
  /\bfortune\b/iu,
  /\bsalary\b/iu,
  /\bsalaire\b/iu,
  /\bbillionaires?\b/iu,
  /\brichest\b/iu,
  /\bcelebrity\b/iu,
  /\bcelebrities\b/iu,
  /\bkim kardashian\b/iu,
  /\bkardashian\b/iu,
  /\bbeyonc[ée]\b/iu,
  /\bobama\b/iu,
  /\btaylor swift\b/iu,
  /\bwho owns\b/iu,
  /\bqui poss[eè]de\b/iu,
];

function isNoisyPublicItem(value: unknown): boolean {
  const text = textOf(value);
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function filterNoisyArray(value: unknown): { readonly value: unknown; readonly removed: number } {
  if (!Array.isArray(value)) return { value, removed: 0 };
  const filtered = value.filter((item) => !isNoisyPublicItem(item));
  return { value: filtered, removed: value.length - filtered.length };
}

// ─── plan builder ────────────────────────────────────────────────────────────

const PROSE_FIELDS = [
  'description_fr',
  'description_en',
  'factual_summary_fr',
  'factual_summary_en',
  'meta_title_fr',
  'meta_title_en',
  'meta_desc_fr',
  'meta_desc_en',
] as const;

function buildPlan(row: HotelRow): PatchPlan {
  const changes: FieldChange[] = [];
  const notes: string[] = [];
  const isOfficialPalace = row.is_palace === true;

  // WP-C1 — tier + affiliations (only when the row is NOT an official Palace)
  if (!isOfficialPalace) {
    const targetTier = TIER_REMAP[row.slug];
    if (targetTier !== undefined && row.luxury_tier === 'palace_atout_france') {
      changes.push({
        field: 'luxury_tier',
        before: row.luxury_tier,
        after: targetTier,
        reason: 'false_palace_tier_remap',
      });
    } else if (row.luxury_tier === 'palace_atout_france') {
      notes.push('palace_tier_without_remap_entry_MANUAL_REVIEW');
    }

    const strippedAff = stripPalaceAffiliation(row.affiliations);
    if (strippedAff.removed > 0) {
      changes.push({
        field: 'affiliations',
        before: row.affiliations,
        after: strippedAff.value,
        reason: `strip_palace_affiliation:${strippedAff.removed}`,
      });
    }
  }

  // Prose fields: pipe/spacing normalisation + Palace claim rewrite.
  for (const field of PROSE_FIELDS) {
    const current = row[field];
    if (current === null) continue;
    const normalized = normalizeSeoField(current);
    let nextValue = normalized.value ?? current;
    const reasons = [...normalized.reasons];

    if (!isOfficialPalace) {
      const rewritten = rewritePalaceClaims(row, nextValue);
      if (rewritten.value !== nextValue) {
        nextValue = rewritten.value;
        reasons.push(...rewritten.reasons);
      }
    }

    // Pure whitespace drift (trailing spaces before \n…) is not worth a write.
    if (nextValue !== current && reasons.length > 0) {
      if (hasLeak(nextValue)) {
        notes.push(`${field}_rewrite_tripped_hasLeak_SKIPPED`);
        continue;
      }
      changes.push({ field, before: current, after: nextValue, reason: reasons.join(',') });
    }
  }

  // JSON surfaces: noisy-PAA removal + Palace claim rewrite.
  const jsonFields = ['faq_content', 'faq_content_kit', 'concierge_questions', 'geo_qa'] as const;
  for (const field of jsonFields) {
    const current = row[field];
    if (current === null) continue;
    const filtered = filterNoisyArray(current);
    let nextValue = filtered.value;
    const reasons: string[] = [];
    if (filtered.removed > 0) reasons.push(`remove_noisy_items:${filtered.removed}`);

    if (!isOfficialPalace) {
      const rewritten = rewriteJsonClaims(row, nextValue);
      if (rewritten.touched) {
        nextValue = rewritten.value;
        reasons.push('palace_claim_json');
      }
    }

    if (reasons.length > 0) {
      changes.push({ field, before: current, after: nextValue, reason: reasons.join(',') });
    }
  }

  // Band sanity notes (non-blocking — renderer has fallbacks, but flag drift).
  for (const change of changes) {
    if (
      (change.field === 'factual_summary_fr' || change.field === 'factual_summary_en') &&
      typeof change.after === 'string' &&
      (change.after.length < 110 || change.after.length > 165)
    ) {
      notes.push(`${change.field}_out_of_envelope:${change.after.length}`);
    }
    if (
      (change.field === 'meta_desc_fr' || change.field === 'meta_desc_en') &&
      typeof change.after === 'string' &&
      (change.after.length < 140 || change.after.length > 170)
    ) {
      notes.push(`${change.field}_out_of_band:${change.after.length}`);
    }
  }

  return { row, changes, notes };
}

// ─── REST I/O ────────────────────────────────────────────────────────────────

async function fetchRows(url: string, key: string, slugs: readonly string[]): Promise<HotelRow[]> {
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set(
    'select',
    [
      'id',
      'slug',
      'name',
      'country_code',
      'is_palace',
      'luxury_tier',
      'affiliations',
      'description_fr',
      'description_en',
      'factual_summary_fr',
      'factual_summary_en',
      'meta_title_fr',
      'meta_title_en',
      'meta_desc_fr',
      'meta_desc_en',
      'faq_content',
      'faq_content_kit',
      'concierge_questions',
      'geo_qa',
    ].join(','),
  );
  const encoded = slugs.map((slug) => `"${slug.replace(/"/gu, '')}"`).join(',');
  endpoint.searchParams.set('slug', `in.(${encoded})`);
  const res = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[patch-dataseo-p0-hotels] SELECT failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  return z.array(HotelRowSchema).parse(await res.json());
}

async function patchRow(url: string, key: string, plan: PatchPlan): Promise<void> {
  const body: Record<string, unknown> = {};
  for (const change of plan.changes) {
    body[change.field] = change.after;
  }
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('id', `eq.${plan.row.id}`);
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(
      `[patch-dataseo-p0-hotels] PATCH ${plan.row.slug} failed (${res.status}): ${responseBody.slice(0, 300)}`,
    );
  }
}

/** Post-write verification — re-read one field per plan and compare. */
async function verifyRow(url: string, key: string, plan: PatchPlan): Promise<boolean> {
  const probe = plan.changes[0];
  if (probe === undefined) return true;
  const endpoint = new URL('/rest/v1/hotels', url);
  endpoint.searchParams.set('select', `slug,${probe.field}`);
  endpoint.searchParams.set('id', `eq.${plan.row.id}`);
  const res = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return false;
  const rows = (await res.json()) as Record<string, unknown>[];
  const persisted = rows[0]?.[probe.field];
  return JSON.stringify(persisted) === JSON.stringify(probe.after);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = SupabaseEnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const rows = await fetchRows(url, env.SUPABASE_SERVICE_ROLE_KEY, args.slugs);
  const plans = rows.map(buildPlan);
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  await mkdir(RUNS_DIR, { recursive: true });
  const reportPath = resolve(
    RUNS_DIR,
    `dataseo-p0-hotels-patch-${args.apply ? 'apply' : 'dry'}-${stamp}.json`,
  );
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt,
        apply: args.apply,
        requestedSlugs: args.slugs,
        plans: plans.map((plan) => ({
          slug: plan.row.slug,
          changes: plan.changes,
          notes: plan.notes,
        })),
        backup: rows,
      },
      null,
      2,
    ),
    'utf8',
  );

  const changed = plans.filter((plan) => plan.changes.length > 0);
  console.log(
    `[patch-dataseo-p0-hotels] rows=${rows.length} changed=${changed.length} apply=${args.apply}`,
  );
  console.log(`[patch-dataseo-p0-hotels] wrote ${reportPath}`);

  for (const plan of changed) {
    console.log(
      `[patch-dataseo-p0-hotels] ${plan.row.slug} changes=${plan.changes
        .map((change) => `${change.field}:${change.reason}`)
        .join('|')}`,
    );
    for (const note of plan.notes) {
      console.log(`[patch-dataseo-p0-hotels]   note: ${note}`);
    }
  }

  if (!args.apply) {
    console.log('[patch-dataseo-p0-hotels] dry-run only. Re-run with --apply to write.');
    return;
  }

  let verified = 0;
  for (const plan of changed) {
    await patchRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan);
    const ok = await verifyRow(url, env.SUPABASE_SERVICE_ROLE_KEY, plan);
    if (ok) {
      verified += 1;
    } else {
      console.error(
        `[patch-dataseo-p0-hotels] VERIFY FAILED for ${plan.row.slug} — write may have no-op'd`,
      );
    }
  }
  console.log(`[patch-dataseo-p0-hotels] applied=${changed.length} verified=${verified}`);
}

main().catch((err: unknown) => {
  console.error('[patch-dataseo-p0-hotels] FATAL', err);
  process.exit(1);
});
