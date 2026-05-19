/**
 * enrich-brand-tier1.ts — anchor the 66 brand-only Tier-1 international
 * hotel fiches in concrete facts pulled from the property's official
 * homepage via Tavily Extract.
 *
 * Context
 * -------
 * `seed-tier1-content.ts` (commit 0588024) populated 337 Tier-1
 * international hotels with LLM-generated content. The 271 award-based
 * hotels (W50, T+L, CN Gold List) anchored well because the award name
 * gave GPT-4o-mini a strong factual lever. The 66 brand-only hotels
 * (luxury_tier IN aman / belmond / rosewood / four_seasons /
 * mandarin_oriental / park_hyatt / ritz_carlton_reserve) shipped
 * thinner prose — generic Concierge phrasing with no neighborhood or
 * USP anchors.
 *
 * What this script does
 * ---------------------
 * For each brand-only published hotel:
 *   1. Resolve `official_url` from public.hotels. Skip if missing or
 *      if it looks like a brand homepage only (e.g.
 *      https://www.fourseasons.com/ — no property path).
 *   2. Tavily Extract on the URL (advanced depth, markdown). If the
 *      payload exceeds ~15 k chars we anchor-trim to ~8 k keeping the
 *      first paragraphs + the first "Rooms"/"Suites"/"Restaurants" or
 *      "Amenities" anchor we find (Rule 12-ter, llm-output-robustness).
 *   3. One LLM call (gpt-4o-mini, JSON mode, temp 0.3) extracts:
 *        - neighborhood (verbatim or "non disponible")
 *        - 3 USPs (verbatim or fewer)
 *        - meta_desc_fr / meta_desc_en (130-150 chars, anchored in the
 *          extracted facts)
 *        - description_fr / description_en (220-260 words, anchored,
 *          Concierge voice, ends with the italic "Mon conseil")
 *        - anchor_facts: array of verbatim phrases from the markdown
 *          that the LLM used as anchors (audit trail).
 *      System prompt forbids inventing room counts / dates / architects
 *      / chef names — only verbatim facts allowed.
 *   4. Post-validate (Rule 12-quinquies, llm-output-robustness):
 *        - finish_reason === 'length' → surface as error
 *        - meta_desc truncated to ≤155 chars on a sentence boundary
 *        - description sentence count > 25 words flagged as warning
 *      Anti-hallucination rule (content-enrichment-pipeline §rule-9):
 *        - anchor_facts.length < 2 → skipped, do NOT overwrite (we
 *          refuse to clobber the existing seed with equally-thin prose).
 *   5. Conditional UPDATE — skipped if length(description_fr) > 1500
 *      (heuristic: an editor or a richer pipeline has already touched
 *      the fiche; we never overwrite editorial work).
 *
 * Cost budget: ≤ $0.01 Tavily × 66 + ≤ $0.05 LLM ≈ $0.71. Hard cap
 * documented as < $1.50.
 *
 * Idempotent: re-running the script skips already-enriched fiches via
 * both the length heuristic AND the anchor-facts gate.
 *
 * Branch / commit: feat/intl-phase-2-polish — `feat(editorial-pilot):
 * enrich Tier 1 brand-only hotels with Tavily homepage facts`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { tavilyExtract, type TavilyExtractResult } from '../enrichment/tavily-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

// ─── Constants ─────────────────────────────────────────────────────────────

const EXTRACTION_MODEL = 'gpt-4o-mini-2024-07-18';

const BRAND_TIERS = [
  'aman',
  'belmond',
  'rosewood',
  'four_seasons',
  'mandarin_oriental',
  'park_hyatt',
  'ritz_carlton_reserve',
] as const;
type BrandTier = (typeof BRAND_TIERS)[number];

const TIER_HUMAN: Readonly<Record<BrandTier, { fr: string; en: string }>> = {
  aman: { fr: 'Adresse Aman', en: 'Aman property' },
  belmond: { fr: 'Maison Belmond (LVMH)', en: 'Belmond property (LVMH)' },
  rosewood: { fr: 'Maison Rosewood Hotels & Resorts', en: 'Rosewood Hotels & Resorts property' },
  four_seasons: { fr: 'Adresse Four Seasons', en: 'Four Seasons property' },
  mandarin_oriental: { fr: 'Maison Mandarin Oriental', en: 'Mandarin Oriental property' },
  park_hyatt: { fr: 'Adresse Park Hyatt', en: 'Park Hyatt property' },
  ritz_carlton_reserve: { fr: 'Adresse Ritz-Carlton Reserve', en: 'Ritz-Carlton Reserve property' },
};

/** Heuristic for "this fiche has been editorially enriched beyond the seed". */
const EDITOR_ENRICHED_DESC_LEN_THRESHOLD = 1500;

/** Minimum anchor facts required to overwrite — refuses thin Tavily payloads. */
const MIN_ANCHOR_FACTS = 2;

/** Max chars we send to the LLM — keeps tokens (and cost) bounded. */
const LLM_INPUT_BUDGET = 6000;

/** Above this size we apply anchor-trim instead of plain head-slice. */
const ANCHOR_TRIM_THRESHOLD = 15000;

/** Sections we try to keep when anchor-trimming long pages. */
const SECTION_ANCHORS = [
  'Rooms',
  'Suites',
  'Accommodation',
  'Accommodations',
  'Restaurants',
  'Dining',
  'Cuisine',
  'Spa',
  'Wellness',
  'Amenities',
  'Experiences',
  'Location',
  'Neighborhood',
  'Neighbourhood',
];

// ─── CLI parsing ───────────────────────────────────────────────────────────

interface CliArgs {
  readonly limit: number | null;
  readonly dryRun: boolean;
  readonly brand: BrandTier | null;
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let limit: number | null = null;
  let dryRun = false;
  let brand: BrandTier | null = null;
  let concurrency = 3;

  const readNext = (flag: string, i: number): string | undefined => {
    if (i + 1 >= argv.length) return undefined;
    const next = argv[i + 1];
    if (typeof next !== 'string' || next.startsWith('--')) return undefined;
    void flag;
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== 'string') continue;
    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    // --limit N  /  --limit=N
    if (a === '--limit') {
      const v = readNext('--limit', i);
      const n = v !== undefined ? Number(v) : NaN;
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      if (v !== undefined) i += 1;
      continue;
    }
    if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      continue;
    }
    // --concurrency N  /  --concurrency=N
    if (a === '--concurrency') {
      const v = readNext('--concurrency', i);
      const n = v !== undefined ? Number(v) : NaN;
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(5, Math.floor(n));
      if (v !== undefined) i += 1;
      continue;
    }
    if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(5, Math.floor(n));
      continue;
    }
    // --brand <slug>  /  --brand=<slug>
    if (a === '--brand') {
      const v = readNext('--brand', i);
      if (v !== undefined) {
        const lc = v.toLowerCase();
        if ((BRAND_TIERS as readonly string[]).includes(lc)) {
          brand = lc as BrandTier;
        }
        i += 1;
      }
      continue;
    }
    if (a.startsWith('--brand=')) {
      const lc = a.slice('--brand='.length).toLowerCase();
      if ((BRAND_TIERS as readonly string[]).includes(lc)) {
        brand = lc as BrandTier;
      }
      continue;
    }
  }
  return { limit, dryRun, brand, concurrency };
}

// ─── DB row shape ──────────────────────────────────────────────────────────

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly country_label_fr: string;
  readonly country_label_en: string;
  readonly region: string | null;
  readonly luxury_tier: BrandTier;
  readonly official_url: string | null;
  readonly description_fr_len: number;
  readonly meta_desc_fr: string | null;
  readonly description_fr_preview: string | null;
  readonly meta_desc_en: string | null;
  readonly description_en_preview: string | null;
}

// ─── URL filter (skip brand-homepage-only URLs) ────────────────────────────

interface UrlVerdict {
  readonly kind: 'ok' | 'skip';
  readonly reason?: string;
}

/**
 * Returns 'skip' for URLs that point at a brand root (e.g.
 * https://www.fourseasons.com/) — those return marketing/global content
 * with no property facts, so Tavily would waste a credit and the LLM
 * would have nothing to anchor on. The path heuristic is intentionally
 * conservative: anything with a path ≥ 3 chars below root is accepted.
 */
function classifyUrl(rawUrl: string): UrlVerdict {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { kind: 'skip', reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { kind: 'skip', reason: 'non_http_url' };
  }
  const path = parsed.pathname.replace(/\/+$/u, '');
  if (path === '' || path === '/') {
    return { kind: 'skip', reason: 'url_is_brand_homepage' };
  }
  if (path.replace(/^\//u, '').length < 3) {
    return { kind: 'skip', reason: 'url_path_too_short' };
  }
  return { kind: 'ok' };
}

// ─── Tavily payload normaliser (anchor-trim long pages) ────────────────────

function trimForLlm(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= LLM_INPUT_BUDGET) return clean;
  if (clean.length <= ANCHOR_TRIM_THRESHOLD) {
    return clean.slice(0, LLM_INPUT_BUDGET);
  }
  // Find the first section anchor and stitch ~2 k chars of prelude with
  // a slice starting at that anchor — this catches "Rooms / Restaurants
  // / Spa / Amenities" lists that hold the most concrete facts.
  const prelude = clean.slice(0, 2000);
  let anchorSlice = '';
  for (const anchor of SECTION_ANCHORS) {
    // Match a markdown-ish heading or a bold/plain anchor on its own line.
    const rx = new RegExp(`(^|\\n)\\s*[#*-]*\\s*${anchor}\\b`, 'iu');
    const m = rx.exec(clean);
    if (m && typeof m.index === 'number') {
      anchorSlice = clean.slice(m.index, m.index + (LLM_INPUT_BUDGET - prelude.length - 50));
      break;
    }
  }
  if (anchorSlice.length === 0) {
    return clean.slice(0, LLM_INPUT_BUDGET);
  }
  return `${prelude}\n\n…\n\n${anchorSlice}`;
}

// ─── LLM schema + prompt ───────────────────────────────────────────────────

const NEIGHBORHOOD_NOT_AVAILABLE = 'non disponible';

const EnrichmentSchema = z.object({
  neighborhood: z.string().default(''),
  usps: z.array(z.string()).default([]),
  anchored_meta_desc_fr: z.string().default(''),
  anchored_meta_desc_en: z.string().default(''),
  anchored_description_fr: z.string().default(''),
  anchored_description_en: z.string().default(''),
  anchor_facts: z.array(z.string()).default([]),
});

type EnrichmentContent = z.infer<typeof EnrichmentSchema>;

const SYSTEM_PROMPT = `Tu es "Le Concierge", la voix éditoriale de MyConciergeHotel.com.
Tu construis une fiche hôtel ANCRÉE dans les faits du site officiel, sans rien inventer.

POSTURE :
- Expert complice, jamais journaliste, jamais vendeur.
- Tu cites des faits concrets QUE s'ils sont LITTÉRALEMENT présents dans SOURCE_CONTENT.
- Aucune supposition, aucune inférence, aucune combinaison de sources.

RÈGLES NARRATIVES (FR ET EN, hard rules) :
- Phrases ≤ 25 mots STRICT.
- Voix active, présent narratif.
- INTERDIT en FR : "incroyable", "magnifique", "exceptionnel" (sauf classement Atout France), "magique", "sublime", "n'hésitez pas à", "il est à noter que", "dans le cadre de", "notamment", "découvrez", "à ne pas manquer".
- INTERDIT en EN : "amazing", "stunning", "incredible", "magnificent" (except awards), "exceptional", "feel free to", "discover", "must-see", "world-class".

ANTI-HALLUCINATION (CRITIQUE — règle 9 du content-enrichment-pipeline) :
- N'invente JAMAIS un fait concret : nombre de chambres, année d'ouverture, nom d'architecte, nom de chef, nom de spa, marque de soin, distance précise, prix.
- N'utilise un fait précis QUE s'il est LITTÉRALEMENT présent dans SOURCE_CONTENT ci-dessous.
- Si tu ne trouves pas de fait concret, tu écris une prose volontairement générique qui s'appuie SEULEMENT sur : nom, ville, pays, marque.
- Le champ "neighborhood" doit valoir "non disponible" si le quartier / district n'est PAS littéralement mentionné dans SOURCE_CONTENT.
- Le champ "usps" doit contenir UNIQUEMENT des éléments présents dans SOURCE_CONTENT (3 max, 0 acceptable).
- Le champ "anchor_facts" doit lister, EN VERBATIM (ou citation rapprochée < 15 mots), les phrases ou groupes nominaux de SOURCE_CONTENT qui t'ont servi de point d'ancrage factuel. Si tu n'as ancré aucun fait, retourne un tableau VIDE.

FORMAT DE SORTIE (JSON strict) :
{
  "neighborhood": string — quartier/district/zone géographique, VERBATIM (ex: "St. James's", "Faubourg Saint-Honoré", "Ginza"), ou "non disponible".
  "usps": string[] — 0 à 3 USPs courts (≤ 12 mots chacun), VERBATIM ou paraphrase fidèle. Ex: ["Olympic-size pool overlooking the Bosphorus", "Rooftop bar designed by Tadao Ando"].
  "anchored_meta_desc_fr": string — 130-150 caractères. Mentionne type (palace, hôtel 5★, resort, lodge…), ville/pays, ET au moins 1 USP ou le quartier ancré. Pas de superlatif vide.
  "anchored_meta_desc_en": string — 130-150 caractères. Idem en anglais.
  "anchored_description_fr": string — 220-260 MOTS — IMPÉRATIF ≥ 220 mots. 4 paragraphes :
      § 1 (50-65 mots) — Chapeau : type d'hôtel, ville, pays, quartier SI ancré, signal de marque (TIER_SIGNAL).
      § 2 (55-75 mots) — Ce qui distingue : intègre 1-2 USPs ancrés (restaurants, suites, vues, équipements) UNIQUEMENT présents dans SOURCE_CONTENT.
      § 3 (60-80 mots) — Ce qu'un voyageur doit savoir : ambiance, type de séjour (couples, business, famille), saisonnalité ou accès si présent dans SOURCE_CONTENT. Pas de fait inventé.
      § 4 — UNE dernière ligne en italique markdown commençant EXACTEMENT par "_Mon conseil du Concierge :_" suivie d'un conseil opérationnel (15-30 mots). OBLIGATOIRE.
  "anchored_description_en": string — 220-260 WORDS — MUST be ≥ 220 words. Same 4-paragraph structure. Last italic line starts EXACTLY with "_My tip from the Concierge:_".
  "anchor_facts": string[] — phrases verbatim de SOURCE_CONTENT utilisées comme ancres factuelles. ≥ 2 souhaité, 0 = aucun fait exploitable trouvé.
}

VÉRIFICATION INTERNE AVANT DE RÉPONDRE :
- Si tu ne peux ancrer AUCUN fait concret (cas d'une page très pauvre), retourne anchor_facts = [] et écris des descriptions GÉNÉRIQUES (le caller refusera l'écrasement, donc pas grave).
- Compte les mots des descriptions. Si < 220, RÉÉCRIS en allongeant § 1-3.
- Compte les caractères des meta_desc. Si > 150, raccourcis. Si < 120, allonge.
- Aucune phrase > 25 mots.

Réponds UNIQUEMENT par le JSON, sans markdown fence, sans préambule.`;

interface LlmOk {
  readonly kind: 'ok';
  readonly content: EnrichmentContent;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}
interface LlmFail {
  readonly kind: 'fail';
  readonly reason: string;
}
type LlmResult = LlmOk | LlmFail;

async function generateAnchoredContent(
  client: OpenAI,
  hotel: HotelRow,
  tavilyMarkdown: string,
): Promise<LlmResult> {
  const tier = hotel.luxury_tier;
  const tierHuman = TIER_HUMAN[tier];

  const userPrompt = [
    `HOTEL_NAME: ${hotel.name}`,
    `CITY: ${hotel.city}`,
    `COUNTRY_FR: ${hotel.country_label_fr}`,
    `COUNTRY_EN: ${hotel.country_label_en}`,
    hotel.region !== null && hotel.region.length > 0 ? `REGION: ${hotel.region}` : '',
    `TIER_SIGNAL_FR: ${tierHuman.fr}`,
    `TIER_SIGNAL_EN: ${tierHuman.en}`,
    '',
    'SOURCE_CONTENT (Tavily-extracted markdown du site officiel — SEUL MATÉRIAU AUTORISÉ pour les faits concrets) :',
    '"""',
    tavilyMarkdown,
    '"""',
    '',
    `Rappel critique : tout fait absent de SOURCE_CONTENT doit être omis (pas inventé, pas inféré). Le champ "neighborhood" vaut "${NEIGHBORHOOD_NOT_AVAILABLE}" si le quartier n'est pas mentionné LITTÉRALEMENT.`,
    '',
    'Retourne UNIQUEMENT le JSON object maintenant.',
  ]
    .filter((l) => l.length > 0)
    .join('\n');

  try {
    const response = await client.chat.completions.create({
      model: EXTRACTION_MODEL,
      temperature: 0.3,
      // 220-260 words × 2 langs × ~1.4 tokens/word ≈ 730 tokens + meta
      // + anchor_facts array + JSON overhead ≈ 1100 tokens of body.
      // Cap at 1600 to leave headroom for sentence-≤25-words rephrasing.
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const choice = response.choices[0];
    if (!choice || choice.message.content === null || choice.message.content.length === 0) {
      return { kind: 'fail', reason: 'empty LLM response' };
    }
    // Rule 12-bis (llm-output-robustness): detect silent truncation.
    if (choice.finish_reason === 'length') {
      return {
        kind: 'fail',
        reason: 'finish_reason=length (truncated) — bump max_tokens above 1600',
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(choice.message.content);
    } catch {
      return {
        kind: 'fail',
        reason: `JSON parse failed: ${choice.message.content.slice(0, 200)}`,
      };
    }
    const parsed = EnrichmentSchema.safeParse(json);
    if (!parsed.success) {
      return {
        kind: 'fail',
        reason: `Zod fail: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' | ')}`,
      };
    }
    return {
      kind: 'ok',
      content: parsed.data,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  } catch (err) {
    return { kind: 'fail', reason: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Post-validation (Rule 12-quinquies — relax + post-map) ────────────────

interface ValidationOutcome {
  readonly content: EnrichmentContent;
  readonly warnings: readonly string[];
}

function wordCount(s: string): number {
  return s.split(/\s+/u).filter((w) => w.length > 0).length;
}

function truncateChars(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  // Prefer breaking at the last sentence-ending punctuation
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastDot > max * 0.6) return cut.slice(0, lastDot + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

function ensureConciergeLine(body: string, locale: 'fr' | 'en'): string {
  const prefix = locale === 'fr' ? '_Mon conseil du Concierge :' : '_My tip from the Concierge:';
  if (body.includes(prefix)) return body;
  const fallback =
    locale === 'fr'
      ? "\n\n_Mon conseil du Concierge : réservez le restaurant principal dès la confirmation, les meilleures tables partent des semaines à l'avance._"
      : '\n\n_My tip from the Concierge: book the signature restaurant as soon as your stay is confirmed — the best tables vanish weeks ahead._';
  return body.trimEnd() + fallback;
}

function tooLongSentences(text: string): number {
  const sentences = text
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('_'));
  let n = 0;
  for (const s of sentences) {
    const wc = s.split(/\s+/u).filter((w) => w.length > 0).length;
    if (wc > 25) n += 1;
  }
  return n;
}

function postValidate(raw: EnrichmentContent): ValidationOutcome {
  const warnings: string[] = [];

  let meta_desc_fr = raw.anchored_meta_desc_fr.trim();
  let meta_desc_en = raw.anchored_meta_desc_en.trim();
  let description_fr = raw.anchored_description_fr.trim();
  let description_en = raw.anchored_description_en.trim();

  if (meta_desc_fr.length > 155) {
    warnings.push(`meta_desc_fr truncated from ${meta_desc_fr.length} to ≤155 chars`);
    meta_desc_fr = truncateChars(meta_desc_fr, 155);
  }
  if (meta_desc_en.length > 155) {
    warnings.push(`meta_desc_en truncated from ${meta_desc_en.length} to ≤155 chars`);
    meta_desc_en = truncateChars(meta_desc_en, 155);
  }
  if (meta_desc_fr.length < 120) {
    warnings.push(`meta_desc_fr short (${meta_desc_fr.length} chars, target 130-150)`);
  }
  if (meta_desc_en.length < 120) {
    warnings.push(`meta_desc_en short (${meta_desc_en.length} chars, target 130-150)`);
  }

  description_fr = ensureConciergeLine(description_fr, 'fr');
  description_en = ensureConciergeLine(description_en, 'en');
  const wcFr = wordCount(description_fr);
  const wcEn = wordCount(description_en);
  if (wcFr < 180) warnings.push(`description_fr short (${wcFr} words, target 220-260)`);
  if (wcEn < 180) warnings.push(`description_en short (${wcEn} words, target 220-260)`);
  if (wcFr > 320) warnings.push(`description_fr long (${wcFr} words, target 220-260)`);
  if (wcEn > 320) warnings.push(`description_en long (${wcEn} words, target 220-260)`);

  const tooLongFr = tooLongSentences(description_fr);
  const tooLongEn = tooLongSentences(description_en);
  if (tooLongFr > 0) warnings.push(`description_fr has ${tooLongFr} sentence(s) > 25 words`);
  if (tooLongEn > 0) warnings.push(`description_en has ${tooLongEn} sentence(s) > 25 words`);

  // De-duplicate / sanitise anchor_facts (drop empties, dedupe).
  const seen = new Set<string>();
  const cleanedFacts: string[] = [];
  for (const f of raw.anchor_facts) {
    const t = f.trim();
    if (t.length === 0) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleanedFacts.push(t);
  }
  // Same for USPs.
  const seenUsps = new Set<string>();
  const cleanedUsps: string[] = [];
  for (const u of raw.usps) {
    const t = u.trim();
    if (t.length === 0) continue;
    const key = t.toLowerCase();
    if (seenUsps.has(key)) continue;
    seenUsps.add(key);
    cleanedUsps.push(t);
    if (cleanedUsps.length >= 3) break;
  }

  return {
    content: {
      neighborhood: raw.neighborhood.trim(),
      usps: cleanedUsps,
      anchored_meta_desc_fr: meta_desc_fr,
      anchored_meta_desc_en: meta_desc_en,
      anchored_description_fr: description_fr,
      anchored_description_en: description_en,
      anchor_facts: cleanedFacts,
    },
    warnings,
  };
}

// ─── DB write ──────────────────────────────────────────────────────────────

interface PgClientLike {
  query: (text: string, values: ReadonlyArray<unknown>) => Promise<unknown>;
}

/**
 * Conditional UPDATE. We re-check the editor-enriched length guard inside
 * the SQL WHERE clause too, so a concurrent editor edit between row-read
 * and row-write cannot be clobbered.
 */
async function writeEnrichedContent(
  client: PgClientLike,
  slug: string,
  content: EnrichmentContent,
): Promise<{ readonly updated: boolean }> {
  const sql = `
    UPDATE public.hotels
       SET meta_desc_fr   = $2,
           meta_desc_en   = $3,
           description_fr = $4,
           description_en = $5,
           updated_at     = timezone('utc', now())
     WHERE slug = $1
       AND coalesce(length(description_fr), 0) <= $6
  `.trim();
  const r = (await client.query(sql, [
    slug,
    content.anchored_meta_desc_fr,
    content.anchored_meta_desc_en,
    content.anchored_description_fr,
    content.anchored_description_en,
    EDITOR_ENRICHED_DESC_LEN_THRESHOLD,
  ])) as { rowCount?: number };
  return { updated: (r.rowCount ?? 0) > 0 };
}

// ─── Concurrency helper (Rule 7) ───────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      out[i] = await fn(item, i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ─── Runlog entry ──────────────────────────────────────────────────────────

type Status = 'success' | 'skipped' | 'error';

interface RunLogEntry {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly brand: BrandTier;
  readonly status: Status;
  readonly reason?: string;
  readonly tavily_chars?: number;
  readonly llm_input_tokens?: number;
  readonly llm_output_tokens?: number;
  readonly anchor_facts_count?: number;
  readonly neighborhood_found?: boolean;
  readonly usps_count?: number;
  readonly warnings?: readonly string[];
  /** Only populated in --dry-run to inspect the would-be output. */
  readonly content_preview?: EnrichmentContent;
  readonly before?: {
    readonly meta_desc_fr: string | null;
    readonly description_fr_preview: string | null;
    readonly description_fr_len: number;
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  console.log(
    `[enrich-brand-tier1] starting — dryRun=${args.dryRun}, limit=${args.limit ?? 'none'}, ` +
      `brand=${args.brand ?? 'all'}, concurrency=${args.concurrency}`,
  );

  if (process.env['OPENAI_API_KEY'] === undefined) {
    console.error('[enrich-brand-tier1] OPENAI_API_KEY missing in .env.local');
    process.exit(1);
  }
  if (process.env['TAVILY_API_KEY'] === undefined) {
    console.error('[enrich-brand-tier1] TAVILY_API_KEY missing in .env.local');
    process.exit(1);
  }
  const connectionString =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (connectionString === null) {
    console.error(
      '[enrich-brand-tier1] DATABASE_URL / SUPABASE_DB_POOLER_URL / SUPABASE_DB_URL missing',
    );
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });

  const pg = await import('pg');
  const cleaned = connectionString.replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const dbClient = new pg.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await dbClient.connect();

  let hotels: HotelRow[] = [];
  try {
    const filters: string[] = ["country_code <> 'FR'", 'is_published = true'];
    const params: unknown[] = [];
    const tiers =
      args.brand !== null
        ? ([args.brand] as readonly string[])
        : (BRAND_TIERS as readonly string[]);
    params.push(tiers);
    filters.push(`luxury_tier = ANY($${params.length}::text[])`);

    const limitSql = args.limit !== null ? `LIMIT ${args.limit}` : '';
    const sql = `
      SELECT slug, name, city, country_code, country_label_fr, country_label_en,
             region, luxury_tier, official_url,
             coalesce(length(description_fr), 0) AS description_fr_len,
             meta_desc_fr,
             substring(description_fr, 1, 300) AS description_fr_preview,
             meta_desc_en,
             substring(description_en, 1, 300) AS description_en_preview
        FROM public.hotels
       WHERE ${filters.join(' AND ')}
       ORDER BY luxury_tier, name
       ${limitSql};
    `.trim();
    const r = await dbClient.query(sql, params);
    hotels = r.rows as HotelRow[];

    const byTier: Record<string, number> = {};
    for (const h of hotels) byTier[h.luxury_tier] = (byTier[h.luxury_tier] ?? 0) + 1;
    console.log(`[enrich-brand-tier1] ${hotels.length} candidates`);
    for (const t of BRAND_TIERS) {
      const n = byTier[t] ?? 0;
      if (n > 0) console.log(`              ${String(n).padStart(4)} × ${t}`);
    }
    if (hotels.length === 0) {
      console.log('[enrich-brand-tier1] nothing to do, exiting.');
      return;
    }

    // ───── Per-hotel pipeline ───────────────────────────────────────────

    const runlog: RunLogEntry[] = new Array<RunLogEntry>(hotels.length);
    let totalIn = 0;
    let totalOut = 0;
    let okCount = 0;
    let errCount = 0;
    let skipCount = 0;
    let tavilyCalls = 0;

    await runWithConcurrency(hotels, args.concurrency, async (hotel, idx) => {
      const tag = `[${String(idx + 1).padStart(3)}/${hotels.length}] ${hotel.slug}`;

      const before = {
        meta_desc_fr: hotel.meta_desc_fr,
        description_fr_preview: hotel.description_fr_preview,
        description_fr_len: hotel.description_fr_len,
      } as const;

      // ── Pre-flight: already-enriched fiche? Refuse to clobber.
      if (hotel.description_fr_len > EDITOR_ENRICHED_DESC_LEN_THRESHOLD) {
        console.log(
          `${tag} ⤵ skip (description_fr already ${hotel.description_fr_len} chars > ${EDITOR_ENRICHED_DESC_LEN_THRESHOLD})`,
        );
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          brand: hotel.luxury_tier,
          status: 'skipped',
          reason: 'already_enriched',
          before,
        };
        skipCount += 1;
        return;
      }

      // ── Pre-flight: URL gate.
      if (hotel.official_url === null || hotel.official_url.length === 0) {
        console.log(`${tag} ⤵ skip (no official_url)`);
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          brand: hotel.luxury_tier,
          status: 'skipped',
          reason: 'no_official_url',
          before,
        };
        skipCount += 1;
        return;
      }
      const verdict = classifyUrl(hotel.official_url);
      if (verdict.kind === 'skip') {
        console.log(`${tag} ⤵ skip (${verdict.reason ?? 'url_filtered'}): ${hotel.official_url}`);
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          brand: hotel.luxury_tier,
          status: 'skipped',
          reason: verdict.reason ?? 'url_filtered',
          before,
        };
        skipCount += 1;
        return;
      }

      try {
        // ── Tavily Extract ──
        tavilyCalls += 1;
        let extracted: TavilyExtractResult | null = null;
        let tavilyError: string | null = null;
        try {
          const res = await tavilyExtract({
            urls: [hotel.official_url],
            extractDepth: 'advanced',
            format: 'markdown',
            timeoutSec: 30,
          });
          extracted = res.results[0] ?? null;
          if (extracted === null) {
            const fail = res.failedResults[0];
            tavilyError = fail !== undefined ? `tavily_failed: ${fail.error}` : 'tavily_empty';
          }
        } catch (e) {
          tavilyError = `tavily_threw: ${e instanceof Error ? e.message : String(e)}`;
        }

        if (extracted === null || extracted.rawContent.trim().length < 200) {
          const reason = tavilyError ?? 'tavily_thin_content';
          console.warn(`${tag} ✗ ${reason}`);
          runlog[idx] = {
            slug: hotel.slug,
            name: hotel.name,
            city: hotel.city,
            country_code: hotel.country_code,
            brand: hotel.luxury_tier,
            status: 'error',
            reason,
            tavily_chars: extracted?.rawContent.length ?? 0,
            before,
          };
          errCount += 1;
          return;
        }

        const tavilyChars = extracted.rawContent.length;
        const trimmed = trimForLlm(extracted.rawContent);

        // ── LLM extraction ──
        const result = await generateAnchoredContent(openai, hotel, trimmed);
        if (result.kind === 'fail') {
          console.warn(`${tag} ✗ LLM fail: ${result.reason}`);
          runlog[idx] = {
            slug: hotel.slug,
            name: hotel.name,
            city: hotel.city,
            country_code: hotel.country_code,
            brand: hotel.luxury_tier,
            status: 'error',
            reason: result.reason,
            tavily_chars: tavilyChars,
            before,
          };
          errCount += 1;
          return;
        }
        totalIn += result.usage.inputTokens;
        totalOut += result.usage.outputTokens;

        const { content, warnings } = postValidate(result.content);

        // ── Anti-hallucination gate: refuse thin payloads ──
        if (content.anchor_facts.length < MIN_ANCHOR_FACTS) {
          console.log(
            `${tag} ⤵ skip (only ${content.anchor_facts.length} anchor fact(s), need ≥ ${MIN_ANCHOR_FACTS}) — preserving existing seed`,
          );
          runlog[idx] = {
            slug: hotel.slug,
            name: hotel.name,
            city: hotel.city,
            country_code: hotel.country_code,
            brand: hotel.luxury_tier,
            status: 'skipped',
            reason: `no_anchor_facts (${content.anchor_facts.length} found)`,
            tavily_chars: tavilyChars,
            llm_input_tokens: result.usage.inputTokens,
            llm_output_tokens: result.usage.outputTokens,
            anchor_facts_count: content.anchor_facts.length,
            usps_count: content.usps.length,
            neighborhood_found:
              content.neighborhood.length > 0 &&
              content.neighborhood !== NEIGHBORHOOD_NOT_AVAILABLE,
            ...(warnings.length > 0 ? { warnings } : {}),
            before,
          };
          skipCount += 1;
          return;
        }

        // ── DB write (conditional, idempotent) ──
        let wrote = false;
        if (!args.dryRun) {
          const w = await writeEnrichedContent(dbClient, hotel.slug, content);
          wrote = w.updated;
          if (!wrote) {
            // Concurrent editor edit raced us — log and treat as skipped.
            console.log(`${tag} ⤵ db skipped (description_fr grew past guard during the run)`);
            runlog[idx] = {
              slug: hotel.slug,
              name: hotel.name,
              city: hotel.city,
              country_code: hotel.country_code,
              brand: hotel.luxury_tier,
              status: 'skipped',
              reason: 'guard_failed_after_llm',
              tavily_chars: tavilyChars,
              llm_input_tokens: result.usage.inputTokens,
              llm_output_tokens: result.usage.outputTokens,
              anchor_facts_count: content.anchor_facts.length,
              usps_count: content.usps.length,
              neighborhood_found:
                content.neighborhood.length > 0 &&
                content.neighborhood !== NEIGHBORHOOD_NOT_AVAILABLE,
              ...(warnings.length > 0 ? { warnings } : {}),
              before,
            };
            skipCount += 1;
            return;
          }
        }

        const wcDescFr = wordCount(content.anchored_description_fr);
        const wcDescEn = wordCount(content.anchored_description_en);
        const neighborhoodFound =
          content.neighborhood.length > 0 && content.neighborhood !== NEIGHBORHOOD_NOT_AVAILABLE;
        const nbgNote = neighborhoodFound ? ` n="${content.neighborhood}"` : '';
        const warnNote = warnings.length > 0 ? ` ⚠${warnings.length}` : '';
        console.log(
          `${tag} ✓ tavily=${tavilyChars}c facts=${content.anchor_facts.length} usps=${content.usps.length}${nbgNote} desc=${wcDescFr}/${wcDescEn}w${warnNote}`,
        );

        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          brand: hotel.luxury_tier,
          status: 'success',
          tavily_chars: tavilyChars,
          llm_input_tokens: result.usage.inputTokens,
          llm_output_tokens: result.usage.outputTokens,
          anchor_facts_count: content.anchor_facts.length,
          usps_count: content.usps.length,
          neighborhood_found: neighborhoodFound,
          ...(warnings.length > 0 ? { warnings } : {}),
          ...(args.dryRun ? { content_preview: content } : {}),
          before,
        };
        okCount += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ exception: ${reason}`);
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          brand: hotel.luxury_tier,
          status: 'error',
          reason,
          before,
        };
        errCount += 1;
      }
    });

    // ───── Stats + runlog ───────────────────────────────────────────────
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    // gpt-4o-mini-2024-07-18 pricing per 1M tokens: $0.15 input, $0.60 output.
    const llmCost = (totalIn / 1_000_000) * 0.15 + (totalOut / 1_000_000) * 0.6;
    // Tavily advanced extract: ~$0.01 per URL (2 credits, paid plan).
    const tavilyCost = tavilyCalls * 0.01;
    const totalCost = llmCost + tavilyCost;

    const byStatus = { success: 0, skipped: 0, error: 0 };
    const perBrand: Record<string, { success: number; skipped: number; error: number }> = {};
    for (const entry of runlog) {
      if (entry === undefined) continue;
      byStatus[entry.status] += 1;
      const b = (perBrand[entry.brand] ??= { success: 0, skipped: 0, error: 0 });
      b[entry.status] += 1;
    }

    console.log('');
    console.log('────────────────────────────────────────');
    console.log('[enrich-brand-tier1] DONE');
    console.log(`  candidates : ${hotels.length}`);
    console.log(`  success    : ${okCount}`);
    console.log(`  skipped    : ${skipCount}`);
    console.log(`  errored    : ${errCount}`);
    console.log(`  tavily calls : ${tavilyCalls} (~$${tavilyCost.toFixed(3)})`);
    console.log(`  LLM tokens : in=${totalIn} out=${totalOut} (~$${llmCost.toFixed(3)})`);
    console.log(`  total cost : ~$${totalCost.toFixed(3)}`);
    console.log(`  elapsed    : ${elapsed}s`);
    console.log('  per brand  :');
    for (const t of BRAND_TIERS) {
      const stats = perBrand[t];
      if (stats === undefined) continue;
      console.log(
        `              ${t.padEnd(22)} ok=${stats.success} skip=${stats.skipped} err=${stats.error}`,
      );
    }
    if (args.dryRun) console.log('  (DRY RUN — no DB writes performed)');

    const runsDir = resolve(__dirname, '../../runs');
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const runlogPath = resolve(runsDir, `enrich-brand-tier1-${stamp}.json`);
    writeFileSync(
      runlogPath,
      JSON.stringify(
        {
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          args: { ...args, brand: args.brand ?? 'all' },
          stats: {
            candidates: hotels.length,
            byStatus,
            tavilyCalls,
            tokens: { input: totalIn, output: totalOut },
            estimatedLlmCostUsd: Number(llmCost.toFixed(4)),
            estimatedTavilyCostUsd: Number(tavilyCost.toFixed(4)),
            estimatedTotalCostUsd: Number(totalCost.toFixed(4)),
            elapsedSeconds: Number(elapsed),
            perBrand,
          },
          entries: runlog,
        },
        null,
        2,
      ),
    );
    console.log(`  runlog     : ${runlogPath}`);
  } finally {
    await dbClient.end();
  }
}

main().catch((err: unknown) => {
  console.error('[enrich-brand-tier1] FATAL', err);
  process.exit(1);
});
