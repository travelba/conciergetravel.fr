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
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate';
import { isEditoriallyRelevantPaa } from './faq-perplexity-gates';

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

/**
 * Duplicate DB rows of OFFICIAL Atout France 2026 Palaces under a different
 * slug with `is_palace=false` (verified against the official Collection 2026
 * — Le Figaro / Atout France, 2026-06-02 — during the 2026-07-03 sweep).
 * Their Palace claims are FACTUALLY TRUE and must never be stripped; the
 * canonical row for each carries `is_palace=true`.
 */
const OFFICIAL_PALACE_TWIN_SLUGS: ReadonlySet<string> = new Set([
  'hotel-de-crillon', // twin of hotel-de-crillon-a-rosewood-hotel
  'four-seasons-georges-v', // twin of four-seasons-hotel-george-v
  'bvlgari-hotel-paris', // twin of bulgari-hotel-paris (new 2026)
  'mandarin-oriental-lutetia', // twin of hotel-lutetia (renewed 2026)
  'chateau-de-la-messardiere', // twin of les-airelles-saint-tropez
  'cheval-blanc-st-barth-isle-de-france', // twin of cheval-blanc-st-barth
  'fouquet-s-paris', // twin of hotel-barriere-le-fouquet-s-paris (new 2026)
  'hotel-fouquet-s-paris', // twin of hotel-barriere-le-fouquet-s-paris
  'le-fouquet-s-paris', // twin of hotel-barriere-le-fouquet-s-paris
  // Added 2026-07-03 (Bugbot review of ws/c2-p0-sweeps + normalized-name hunt):
  'hotel-royal', // twin of hotel-royal-evian (canonical per fix-is-palace-flag.ts)
  'hotel-le-royal-evian', // twin of hotel-royal-evian
  'hotel-barriere-les-neiges-courchevel', // rebranded winter 2025-26 → fouquets-courchevel (Palace kept)
  'l-apogee', // twin of lapogee-courchevel
]);

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

export type HotelRow = z.infer<typeof HotelRowSchema>;

interface Args {
  readonly apply: boolean;
  readonly slugs: readonly string[];
  /** When set, load candidate slugs from a palace-claims-inventory JSON. */
  readonly inventory: string | null;
  /** Slice the resolved slug list — supports 20-30/lot cadence. */
  readonly offset: number;
  readonly limit: number | null;
}

interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly reason: string;
}

export interface PatchPlan {
  readonly row: HotelRow;
  readonly changes: readonly FieldChange[];
  readonly notes: readonly string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const readString = (name: string): string | undefined =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const slugsRaw = readString('slugs');
  const inventoryRaw = argv.includes('--inventory') ? (readString('inventory') ?? 'latest') : null;
  const offsetRaw = readString('offset');
  const limitRaw = readString('limit');
  const offset = offsetRaw === undefined ? 0 : Math.max(0, Number.parseInt(offsetRaw, 10) || 0);
  const limitParsed = limitRaw === undefined ? null : Number.parseInt(limitRaw, 10);
  return {
    apply: argv.includes('--apply'),
    slugs:
      slugsRaw === undefined
        ? []
        : slugsRaw
            .split(',')
            .map((slug) => slug.trim())
            .filter((slug) => slug.length > 0),
    inventory: inventoryRaw,
    offset,
    limit:
      limitParsed !== null && Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : null,
  };
}

const InventorySchema = z.object({
  findings: z.array(
    z.object({
      slug: z.string(),
      official: z.boolean().optional(),
      isPalaceFlag: z.boolean().nullable().optional(),
    }),
  ),
});

/** Resolve the inventory file path (explicit path, or latest in runs/). */
async function resolveInventoryPath(spec: string): Promise<string> {
  if (spec !== 'latest') return resolve(process.cwd(), spec);
  const entries = (await readdir(RUNS_DIR))
    .filter((f) => /^palace-claims-inventory-.*\.json$/u.test(f))
    .sort();
  const latest = entries.at(-1);
  if (latest === undefined) {
    throw new Error(
      `[patch-dataseo-p0-hotels] no palace-claims-inventory-*.json found in ${RUNS_DIR}`,
    );
  }
  return resolve(RUNS_DIR, latest);
}

/** Load non-official-Palace finding slugs from the inventory (dedup, ordered). */
async function loadInventorySlugs(spec: string): Promise<readonly string[]> {
  const path = await resolveInventoryPath(spec);
  const parsed = InventorySchema.parse(JSON.parse(await readFile(path, 'utf8')));
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const f of parsed.findings) {
    if (f.official === true || f.isPalaceFlag === true) continue;
    if (seen.has(f.slug)) continue;
    seen.add(f.slug);
    slugs.push(f.slug);
  }
  console.log(`[patch-dataseo-p0-hotels] inventory=${path} findings_slugs=${slugs.length}`);
  return slugs;
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
  // FR/EN — false "Palace par/selon Atout France" self-claims on non-official
  // fiches. Atout France awards BOTH the star rating and the ministerial
  // "Palace" distinction, but only to French establishments listed in the
  // Collection (33 hotels). A non-listed hotel claiming the label is false.
  // These MUST run before the generic `classé palace` strip below, otherwise
  // "classé Palace" is removed first and orphans " par Atout France,".
  // The comma-appositive strips preserve the surrounding sentence; the
  // standalone-sentence strips drop the whole false statement.
  [/,\s*class[ée]e?s? palace par atout france\s*,/giu, ''],
  [/,\s*classified as a palace by atout france\s*,/giu, ''],
  [/,\s*(?:reconnu|distingu[ée])e?s? palace par atout france\s*,/giu, ''],
  [
    /\b(?:le|son) (?:classement|statut|label) palace (?:par|selon|d['’])\s*atout france[^.!?]*[.!?]\s*/giu,
    '',
  ],
  [
    /\b(?:its|the) palace (?:classification|status|distinction|ranking) (?:by|according to|from)\s*atout france[^.!?]*[.!?]\s*/giu,
    '',
  ],
  [/,?\s*class[ée]e?s? palace par atout france\b/giu, ''],
  [/,?\s*classified as a palace by atout france\b/giu, ''],
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
export function rewritePalaceClaims(row: HotelRow, raw: string): ClaimRewrite {
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

  // Safety net for residual false Atout France claims (isOfficialPalace already
  // short-circuits above, so every fiche reaching here is a non-Palace hotel).
  //   - Non-French hotel → it holds NO Atout France classification whatsoever
  //     (neither stars nor the Palace label) → drop every sentence mentioning
  //     Atout France.
  //   - French non-Palace hotel → "5 étoiles … Atout France" is a LEGIT star
  //     reference, but a "Palace … Atout France" sentence is a false Palace
  //     claim → drop only sentences that still pair "palace" with Atout France
  //     (targeted strips above already handle the common appositive shapes).
  // Sentence-drop runs per paragraph so `\n\n` breaks survive. An empty result
  // is reverted — nuking a whole short field (a meta/factual) is worse than a
  // residual claim flagged for manual review.
  if (/atout france/iu.test(text)) {
    const isNonFrench = row.country_code !== null && row.country_code !== 'FR';
    const dropSentence = (s: string): boolean =>
      /atout france/iu.test(s) && (isNonFrench || /\bpalaces?\b/iu.test(s));
    const before = text;
    const dropped = before
      .split(/\n{2,}/u)
      .map((paragraph) =>
        splitSentences(paragraph)
          .filter((s) => !dropSentence(s))
          .join(' '),
      )
      .filter((paragraph) => paragraph.length > 0)
      .join('\n\n');
    if (dropped.trim().length > 0 && dropped !== before) {
      reasons.add(
        isNonFrench ? 'drop_atout_france_sentence_non_fr' : 'drop_palace_atout_france_sentence_fr',
      );
      text = dropped;
    }
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

// ─── WP-C2 — noisy PAA removal ───────────────────────────────────────────────

/**
 * Whole-item sweep for celebrity names that may live in the ANSWER text.
 * Question-level noise is delegated to the canonical `isEditoriallyRelevantPaa`
 * gate (faq-perplexity-gates.ts) so the patcher and the audit agree.
 */
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

/**
 * Question-shape noise the canonical gate does not cover yet (playbook WP-C2
 * families: célébrités, fortunes, salaires, recrutement + etiquette trivia).
 * Observed live on the wave-1 fiches (2026-07-02 scan).
 */
const EXTRA_QUESTION_NOISE: readonly RegExp[] = [
  // Public-affection etiquette trivia ("Can I kiss my girlfriend in Dubai?")
  /\bcan i kiss\b/iu,
  /\bkiss(?:ing)?\b[^?]*\b(?:girlfriend|boyfriend|partner)\b/iu,
  // Celebrity weddings ("Who got married in Taj Lake Palace?")
  /\bwho got married\b/iu,
  /\bqui s[’']est mari[ée]/iu,
  // Wealth-class gossip the canonical gate misses (plural / FR genitive)
  /\bgrandes? fortunes?\b/iu,
  // Ownership trivia — canonical gate covers "(proprietaire|owner) (de|of)"
  // but not the FR contracted genitive nor Italian.
  /\bpropri[ée]taire (?:du|des)\b/iu,
  /\bproprietario (?:del|della|di)\b/iu,
  // Corporate-leadership trivia
  /\bwho is the ceo\b/iu,
  /\bqui est le (?:pdg|ceo)\b/iu,
];

function questionTexts(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return ['question_fr', 'question_en', 'question', 'q']
    .map((key) => record[key])
    .filter((q): q is string => typeof q === 'string' && q.length > 0);
}

function isNoisyPublicItem(value: unknown): boolean {
  const questions = questionTexts(value);
  if (
    questions.some(
      (q) => !isEditoriallyRelevantPaa(q) || EXTRA_QUESTION_NOISE.some((re) => re.test(q)),
    )
  ) {
    return true;
  }
  const text = textOf(value);
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function filterNoisyArray(value: unknown): { readonly value: unknown; readonly removed: number } {
  if (!Array.isArray(value)) return { value, removed: 0 };
  const filtered = value.filter((item) => !isNoisyPublicItem(item));
  return { value: filtered, removed: value.length - filtered.length };
}

// ─── WP-C2 — FAQ wrong-locale question fix (deterministic, no LLM) ───────────

/**
 * The FAQ promote pipeline occasionally copied the raw PAA (EN/IT) into
 * `question_fr` while the answers were correctly written in both locales.
 * Playbook WP-C2 §3 mandates a deterministic patch — these are hand-authored
 * FR questions for the exact rows flagged `faq_language_leak` by the audit.
 * Keyed by current `question_fr` value; applied across all 4 JSON surfaces
 * (kit included, so a future promote does not reintroduce the leak).
 */
interface FaqQuestionFix {
  readonly fr?: string;
  readonly en?: string;
}

/** `null` = drop the whole item (off-topic PAA whose answer self-declares irrelevance). */
const FAQ_QUESTION_FR_FIX: Readonly<
  Record<string, Readonly<Record<string, FaqQuestionFix | null>>>
> = {
  'bulgari-roma': {
    'Dove si trova Bulgari a Roma?': { fr: 'Où se trouve le Bulgari à Rome ?' },
    'Quanto costa una cena al Bulgari Hotel Roma?': {
      fr: 'Combien coûte un dîner au Bulgari Hotel Roma ?',
    },
    'Dove si trova il ristorante Bulgari a Roma?': {
      fr: 'Où se trouve le restaurant du Bulgari à Rome ?',
    },
    'Quanto costa un aperitivo al Bulgari Hotel Roma?': {
      fr: 'Combien coûte un apéritif au Bulgari Hotel Roma ?',
    },
    'Quanto costa una notte al Bulgari Hotel Roma?': {
      fr: 'Combien coûte une nuit au Bulgari Hotel Roma ?',
    },
    'Quanto costa fare colazione da Bulgari a Roma?': {
      fr: 'Combien coûte le petit-déjeuner au Bulgari à Rome ?',
    },
    'Dove si trova Bulgari in Italia?': { fr: 'Où se trouve le Bulgari en Italie ?' },
  },
  'jumeirah-dar-al-masyaf': {
    'What is Jumeirah Dar Al Masyaf known for?': {
      fr: 'Qu’est-ce qui fait la réputation du Jumeirah Dar Al Masyaf ?',
    },
    'How many rooms are there in Jumeirah Dar al Masyaf?': {
      fr: 'Combien de chambres compte le Jumeirah Dar Al Masyaf ?',
    },
    'What is the only 7 star hotel in Dubai?': {
      fr: 'Quel est le seul hôtel « 7 étoiles » de Dubaï ?',
    },
    // Answer self-declares "cette information n'est pas liée à Jumeirah Dar Al Masyaf".
    'Which is the largest hotel in Dubai?': null,
    'What is the dress code at Dar Al Masyaf?': {
      fr: 'Quel est le code vestimentaire au Dar Al Masyaf ?',
    },
    'How many stars are there in Jumeirah Dar al Masyaf?': {
      fr: 'Combien d’étoiles possède le Jumeirah Dar Al Masyaf ?',
    },
    'Can I wear jeans to Grand Mosque?': { fr: 'Peut-on visiter la Grande Mosquée en jean ?' },
  },
  'jumeirah-mina-a-salam': {
    'Where is Jumeirah Mina a salam?': { fr: 'Où se situe le Jumeirah Mina A’Salam ?' },
    'How many rooms does Mina a Salam have?': {
      fr: 'Combien de chambres compte le Mina A’Salam ?',
    },
    'What is the Jumeirah Mina a Salam about?': {
      fr: 'Qu’est-ce qui distingue le Jumeirah Mina A’Salam ?',
    },
    'What does mina al salam mean?': { fr: 'Que signifie « Mina A’Salam » ?' },
    'What is the only 7 star hotel in Dubai?': {
      fr: 'Quel est le seul hôtel « 7 étoiles » de Dubaï ?',
    },
    'When did Mina Al Salam open?': { fr: 'Quand le Mina A’Salam a-t-il ouvert ?' },
  },
  'taj-lake-palace': {
    'Is it worth staying in Taj Lake Palace, Udaipur?': {
      fr: 'Un séjour au Taj Lake Palace d’Udaipur vaut-il la peine ?',
    },
    'Is Taj Lake Palace 7 star?': { fr: 'Le Taj Lake Palace est-il un hôtel « 7 étoiles » ?' },
    'What is the cost of Taj Lake Palace?': { fr: 'Quels sont les tarifs du Taj Lake Palace ?' },
    'What is the cost of dinner at Taj Lake Palace, Udaipur?': {
      fr: 'Combien coûte un dîner au Taj Lake Palace ?',
    },
    'Which is better Taj Lake Palace or Leela palace?': {
      fr: 'Que choisir entre le Taj Lake Palace et le Leela Palace ?',
    },
    // Nonsense scraped PAA with a non-answer ("no official ranking exists").
    'Which is the no. 1 strongest hotel in the world?': null,
    'Can visitors go inside the Taj Lake Palace in Udaipur?': {
      fr: 'Peut-on visiter le Taj Lake Palace sans y séjourner ?',
    },
    // Question was about the Taj Mahal monument; the answer is about the hotel's
    // dinner dress code — realign BOTH locales on the answer.
    'Can I wear jeans to the Taj Mahal?': {
      fr: 'Peut-on porter un jean pour dîner au Taj Lake Palace ?',
      en: 'Can I wear jeans for dinner at Taj Lake Palace?',
    },
    'How much does it cost for one dinner at Taj Udaipur?': {
      fr: 'Quel budget prévoir pour dîner au Taj Lake Palace ?',
    },
  },
};

function fixFaqQuestionLocale(
  slug: string,
  value: unknown,
): { readonly value: unknown; readonly fixed: number; readonly dropped: number } {
  const fixes = FAQ_QUESTION_FR_FIX[slug];
  if (fixes === undefined || !Array.isArray(value)) return { value, fixed: 0, dropped: 0 };
  let fixed = 0;
  let dropped = 0;
  const next: unknown[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      next.push(item);
      continue;
    }
    const record = item as Record<string, unknown>;
    const current = record.question_fr;
    if (typeof current !== 'string') {
      next.push(item);
      continue;
    }
    const fix = fixes[current.trim()];
    if (fix === undefined) {
      next.push(item);
      continue;
    }
    if (fix === null) {
      dropped += 1;
      continue;
    }
    fixed += 1;
    next.push({
      ...record,
      ...(fix.fr === undefined ? {} : { question_fr: fix.fr }),
      ...(fix.en === undefined ? {} : { question_en: fix.en }),
    });
  }
  return { value: next, fixed, dropped };
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

export function buildPlan(row: HotelRow): PatchPlan {
  const changes: FieldChange[] = [];
  const notes: string[] = [];
  const isOfficialPalace = row.is_palace === true || OFFICIAL_PALACE_TWIN_SLUGS.has(row.slug);

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
    const reasons: string[] = [];
    // Noise removal runs FIRST — a removed item must not consume a locale fix.
    const filtered = filterNoisyArray(current);
    if (filtered.removed > 0) reasons.push(`remove_noisy_items:${filtered.removed}`);
    const localeFixed = fixFaqQuestionLocale(row.slug, filtered.value);
    let nextValue = localeFixed.value;
    if (localeFixed.fixed > 0) reasons.push(`fix_question_fr_locale:${localeFixed.fixed}`);
    if (localeFixed.dropped > 0) reasons.push(`drop_offtopic_items:${localeFixed.dropped}`);

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

/**
 * Fetch rows in slug chunks. Heavy JSON columns (faq_content, geo_qa,
 * long descriptions) make a single `in.()` over hundreds of slugs time out
 * (~500 is the documented ceiling). 50/chunk stays comfortably under it.
 */
export async function fetchRowsChunked(
  url: string,
  key: string,
  slugs: readonly string[],
): Promise<HotelRow[]> {
  const out: HotelRow[] = [];
  for (const part of chunk(slugs, 50)) {
    out.push(...(await fetchRows(url, key, part)));
  }
  return out;
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

async function resolveSlugs(args: Args): Promise<readonly string[]> {
  let base: readonly string[];
  if (args.inventory !== null) {
    base = await loadInventorySlugs(args.inventory);
  } else if (args.slugs.length > 0) {
    base = args.slugs;
  } else {
    base = DEFAULT_SLUGS;
  }
  const end = args.limit === null ? undefined : args.offset + args.limit;
  return base.slice(args.offset, end);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = SupabaseEnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const slugs = await resolveSlugs(args);
  console.log(
    `[patch-dataseo-p0-hotels] resolved slugs=${slugs.length} (offset=${args.offset} limit=${args.limit ?? 'all'})`,
  );
  const rows = await fetchRowsChunked(url, env.SUPABASE_SERVICE_ROLE_KEY, slugs);
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
        requestedSlugs: slugs,
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

// Only auto-run as a CLI entry point — importing this module (unit tests)
// must not trigger a DB round-trip.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[patch-dataseo-p0-hotels] FATAL', err);
    process.exit(1);
  });
}
