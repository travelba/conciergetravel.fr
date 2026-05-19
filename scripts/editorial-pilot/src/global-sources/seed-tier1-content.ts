/**
 * seed-tier1-content.ts — minimum-viable editorial seed for Tier 1
 * international hotels (W50 / T+L / CN Gold List / Aman / Belmond /
 * Rosewood / Four Seasons / Mandarin Oriental / Park Hyatt /
 * Ritz-Carlton Reserve).
 *
 * Tier 1 selection criteria:
 *   - country_code != 'FR'
 *   - is_published = false
 *   - luxury_tier in the Tier 1 set
 *
 * Per hotel:
 *   1. Fetch Wikidata facts (if `wikidata_id` is set) — inception year,
 *      architects, owner/operator, heritage, official URL.
 *   2. One LLM call (gpt-4o-mini, temp 0.4, JSON mode, ~1200 output
 *      tokens) producing FR+EN meta_title, meta_desc, description.
 *   3. Post-validate lengths (Rule 12-quinquies pattern — relaxed
 *      schema + post-validation drop / truncate).
 *   4. (Optional) Wikimedia Commons → first non-logo photo → build
 *      Special:FilePath URL for `hero_image`.
 *   5. UPDATE public.hotels via COALESCE so we never clobber existing
 *      editor-pinned content.
 *
 * NEVER sets `is_published = true`. The parent agent handles the flip
 * in a batch operation after editorial review.
 *
 * NEVER fabricates concrete facts. The system prompt forbids inventing
 * room counts, opening dates, architect names, chef names, etc. unless
 * they came from Wikidata. Hotels without Wikidata coverage receive
 * deliberately generic prose mentioning only name + city + country +
 * brand affiliation.
 *
 * Voice: "Le Concierge" (EDITORIAL_VOICE.md) — expert complice, never
 * journalist, never salesperson. Sentences ≤ 25 words, no banned
 * superlatives, ends with one italic "Mon conseil du Concierge :" /
 * "My tip from the Concierge:" line.
 *
 * CLI flags:
 *   --limit N         Process only the first N candidates (smoke test).
 *   --dry-run         Run LLM + Wikidata calls but skip DB writes.
 *   --skip-images     Skip Commons API calls (faster iteration).
 *   --slug=foo,bar    Restrict to specific slugs (comma-separated).
 *   --concurrency=N   Override concurrency (default 5).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot run seed:tier1 -- --limit=5 --dry-run
 *   pnpm --filter @mch/editorial-pilot run seed:tier1
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import {
  fetchHotelByQid,
  fetchHotelExternalIds,
  type WdHotel,
  type WdHotelExternalIds,
} from '../enrichment/wikidata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

// ─── Constants ─────────────────────────────────────────────────────────────

const EXTRACTION_MODEL = 'gpt-4o-mini-2024-07-18';
const TIER1 = [
  'world_50_best',
  'tl_worlds_best',
  'cn_gold_list',
  'aman',
  'belmond',
  'rosewood',
  'four_seasons',
  'mandarin_oriental',
  'park_hyatt',
  'ritz_carlton_reserve',
] as const;

type Tier = (typeof TIER1)[number];

const TIER_HUMAN: Readonly<Record<Tier, { fr: string; en: string }>> = {
  world_50_best: {
    fr: "Classé dans The World's 50 Best Hotels 2025",
    en: "Listed in The World's 50 Best Hotels 2025",
  },
  tl_worlds_best: {
    fr: "Distingué par Travel + Leisure World's Best Awards 2025",
    en: "Honoured by Travel + Leisure World's Best Awards 2025",
  },
  cn_gold_list: {
    fr: 'Sélectionné dans la Condé Nast Traveler Gold List 2025-2026',
    en: 'Selected in the Condé Nast Traveler Gold List 2025-2026',
  },
  aman: { fr: 'Adresse Aman', en: 'Aman property' },
  belmond: { fr: 'Maison Belmond (LVMH)', en: 'Belmond property (LVMH)' },
  rosewood: { fr: 'Maison Rosewood Hotels & Resorts', en: 'Rosewood Hotels & Resorts property' },
  four_seasons: { fr: 'Adresse Four Seasons', en: 'Four Seasons property' },
  mandarin_oriental: { fr: 'Maison Mandarin Oriental', en: 'Mandarin Oriental property' },
  park_hyatt: { fr: 'Adresse Park Hyatt', en: 'Park Hyatt property' },
  ritz_carlton_reserve: {
    fr: 'Adresse Ritz-Carlton Reserve',
    en: 'Ritz-Carlton Reserve property',
  },
};

// ─── CLI parsing ───────────────────────────────────────────────────────────

interface CliArgs {
  readonly limit: number | null;
  readonly dryRun: boolean;
  readonly skipImages: boolean;
  readonly slugs: readonly string[];
  readonly concurrency: number;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let limit: number | null = null;
  let dryRun = false;
  let skipImages = false;
  let slugs: string[] = [];
  let concurrency = 5;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--skip-images') skipImages = true;
    else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.floor(n);
    } else if (a.startsWith('--slug=')) {
      slugs = a
        .slice('--slug='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return { limit, dryRun, skipImages, slugs, concurrency };
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
  readonly luxury_tier: string;
  readonly wikidata_id: string | null;
  readonly commons_category: string | null;
  readonly official_url: string | null;
  readonly hero_image: string | null;
  readonly description_fr: string | null;
  readonly meta_desc_fr: string | null;
}

// ─── Wikidata facts ────────────────────────────────────────────────────────

interface CompactWdFacts {
  readonly inception_year: number | null;
  readonly architects: readonly string[];
  readonly owner: string | null;
  readonly operator: string | null;
  readonly partOf: string | null;
  readonly heritage: readonly string[];
  readonly official_url: string | null;
}

async function fetchWdFacts(qid: string): Promise<CompactWdFacts | null> {
  try {
    let core: WdHotel | null = null;
    let ext: WdHotelExternalIds | null = null;
    try {
      core = await fetchHotelByQid(qid);
    } catch {
      core = null;
    }
    // Throttle between paired calls.
    await sleep(700);
    try {
      ext = await fetchHotelExternalIds(qid);
    } catch {
      ext = null;
    }
    return {
      inception_year: ext?.inceptionYear ?? core?.inception?.year ?? null,
      architects: ext?.architects ?? core?.architects ?? [],
      owner: core?.owner ?? null,
      operator: core?.operator ?? null,
      partOf: core?.partOf ?? null,
      heritage: ext?.heritageDesignations ?? core?.heritageDesignations ?? [],
      official_url: ext?.officialUrl ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Commons image ─────────────────────────────────────────────────────────

const USER_AGENT =
  'MyConciergeHotelEditorialPilot/0.1 (https://myconciergehotel.com; reservations@myconciergehotel.com)';

const CommonsResponseSchema = z
  .object({
    query: z
      .object({
        categorymembers: z
          .array(z.object({ title: z.string() }).passthrough())
          .optional()
          .default([]),
      })
      .partial()
      .optional(),
  })
  .passthrough();

const IMAGE_BLOCKLIST_RX =
  /\b(logo|icon|map|plan|grundriss|wappen|coat[_\s-]*of[_\s-]*arms|svg|seal|emblem|drawing|sketch|signature)\b/iu;

function isUsableImage(filename: string): boolean {
  if (IMAGE_BLOCKLIST_RX.test(filename)) return false;
  if (/\.(svg|tif|tiff|pdf|ogv|webm|mp4)$/iu.test(filename)) return false;
  return /\.(jpe?g|png|webp)$/iu.test(filename);
}

async function fetchCommonsHero(category: string): Promise<string | null> {
  const cleaned = category.replace(/^Category:/u, '').trim();
  if (cleaned.length === 0) return null;
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'categorymembers');
  url.searchParams.set('cmtype', 'file');
  url.searchParams.set('cmtitle', `Category:${cleaned}`);
  url.searchParams.set('cmlimit', '12');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = CommonsResponseSchema.safeParse(json);
    if (!parsed.success) return null;
    const members = parsed.data.query?.categorymembers ?? [];
    for (const m of members) {
      const file = m.title.replace(/^File:/iu, '');
      if (isUsableImage(file)) {
        const encoded = encodeURIComponent(file.replace(/ /gu, '_'));
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=2000`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── LLM call (generation, temperature 0.4) ────────────────────────────────

const SeedSchema = z.object({
  meta_title_fr: z.string(),
  meta_title_en: z.string(),
  meta_desc_fr: z.string(),
  meta_desc_en: z.string(),
  description_fr: z.string(),
  description_en: z.string(),
});

type SeedContent = z.infer<typeof SeedSchema>;

const SYSTEM_PROMPT = `Tu es "Le Concierge", la voix éditoriale de MyConciergeHotel.com.

POSTURE :
- Expert complice, jamais journaliste, jamais vendeur.
- Tu partages des secrets d'initié, jamais des superlatifs marketing.
- Tu donnes des faits concrets quand tu les as, jamais d'à-peu-près.

RÈGLES NARRATIVES (hard rules, non-négociables, FR ET EN) :
- Phrases ≤ 25 mots STRICT.
- Voix active, présent narratif.
- Toujours TTC + euros quand un prix est cité (rare, seulement si Wikidata fournit).
- INTERDIT en FR : "incroyable", "magnifique", "exceptionnel" (sauf classement Atout France), "magique", "sublime", "n'hésitez pas à", "il est à noter que", "dans le cadre de", "notamment", "découvrez", "à ne pas manquer".
- INTERDIT en EN : "amazing", "stunning", "incredible", "magnificent" (except awards), "exceptional", "feel free to", "discover", "must-see", "world-class" (cliché).

ANTI-HALLUCINATION (CRITIQUE) :
- N'invente JAMAIS un fait concret (nombre de chambres, année d'ouverture, nom d'architecte, nom de chef, surface, distance précise, prix).
- N'utilise un fait précis QUE s'il est explicitement présent dans WIKIDATA_FACTS ci-dessous.
- Si WIKIDATA_FACTS est vide ou null, écris une prose volontairement générique qui s'appuie SEULEMENT sur : nom de l'hôtel, ville, pays, affiliation de marque (TIER_SIGNAL).
- Aucune mention de chambre numérotée, suite signature nommée, restaurant nommé, chef nommé, spa nommé, marque de soin, sauf si présent dans WIKIDATA_FACTS.

FORMAT DE SORTIE :
JSON object avec exactement ces 6 clés string :
  - meta_title_fr  : ≤ 60 caractères. Format : "<Nom> · <Ville> · 5★ | MyConciergeHotel".
  - meta_title_en  : ≤ 60 caractères. Format : "<Name> · <City> · 5★ | MyConciergeHotel".
  - meta_desc_fr   : 130-150 caractères STRICT. Mentionne type d'hôtel (palace, hôtel 5★, lodge, riad…), ville/pays, et 2-3 USP brèves (signal de marque, distinction). Pas de superlatif vide.
  - meta_desc_en   : 130-150 caractères STRICT. Idem en anglais.
  - description_fr : 220-260 MOTS — DOIT être ≥ 220 mots. C'est un IMPÉRATIF (sous 200 mots = la fiche est inutilisable). Voix Concierge. Structure obligatoire en **4 paragraphes** :
      § 1 — Chapeau (50-65 mots) : plante l'adresse — type d'hôtel, ville, contexte géographique / quartier si connu, signal de marque (TIER_SIGNAL).
      § 2 — Ce qui distingue (55-75 mots) : la distinction (award du tier), positionnement, atmosphère générale. Reste générique si tu n'as pas de fait spécifique.
      § 3 — Ce qu'un voyageur doit savoir avant d'y aller (60-80 mots) : ambiance, type de séjour adapté (couples, voyageurs solo, business, famille), saisonnalité ou point d'accès si pertinent. Pas de fait inventé.
      § 4 — UNE dernière ligne en italique markdown commençant EXACTEMENT par "_Mon conseil du Concierge :_" suivie d'un conseil opérationnel concret (15-30 mots). Cette ligne italique est OBLIGATOIRE. Exemple générique acceptable : "_Mon conseil du Concierge : réservez votre table au restaurant principal dès la confirmation, l'agenda se remplit semaines à l'avance._"
  - description_en : 220-260 WORDS — MUST be ≥ 220 words. Same 4-paragraph structure. Last italic line starts EXACTLY with "_My tip from the Concierge:_".

VÉRIFICATION INTERNE AVANT DE RÉPONDRE :
- Compte mentalement les mots de description_fr et description_en (mot = séquence séparée par des espaces). Si < 220, RÉÉCRIS en allongeant les paragraphes § 1-3. Le § 4 reste court.
- Compte les caractères des meta_desc. Si > 150, raccourcis.
- Aucune phrase > 25 mots (compte virgules + et/mais comme séparateurs).

Réponds UNIQUEMENT par le JSON, sans markdown fence, sans préambule.`;

interface LlmOk {
  readonly kind: 'ok';
  readonly content: SeedContent;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}
interface LlmFail {
  readonly kind: 'fail';
  readonly reason: string;
}
type LlmResult = LlmOk | LlmFail;

async function generateContent(
  client: OpenAI,
  hotel: HotelRow,
  facts: CompactWdFacts | null,
): Promise<LlmResult> {
  const tier = hotel.luxury_tier as Tier;
  const tierHuman = TIER_HUMAN[tier] ?? { fr: tier, en: tier };

  // Compact, factual block — null if nothing useful, so the LLM can't
  // "interpret" empty arrays as licence to invent.
  const wikidataBlock = facts
    ? JSON.stringify(
        {
          inception_year: facts.inception_year,
          architects: facts.architects.slice(0, 3),
          owner: facts.owner,
          operator: facts.operator,
          part_of_chain: facts.partOf,
          heritage_designations: facts.heritage.slice(0, 3),
          official_website: facts.official_url ?? hotel.official_url,
        },
        null,
        2,
      )
    : 'null';

  const userPrompt = [
    `HOTEL_NAME: ${hotel.name}`,
    `CITY: ${hotel.city}`,
    `COUNTRY_FR: ${hotel.country_label_fr}`,
    `COUNTRY_EN: ${hotel.country_label_en}`,
    hotel.region ? `REGION: ${hotel.region}` : '',
    `TIER_SIGNAL_FR: ${tierHuman.fr}`,
    `TIER_SIGNAL_EN: ${tierHuman.en}`,
    '',
    "WIKIDATA_FACTS (seul matériau autorisé pour les faits concrets — n'invente rien hors de ce bloc) :",
    wikidataBlock,
    '',
    'Rappel critique : si WIKIDATA_FACTS est null OU si une clé vaut null, NE LA MENTIONNE PAS dans la prose. Reste générique sur le segment manquant.',
    '',
    'Retourne UNIQUEMENT le JSON object maintenant.',
  ]
    .filter((l) => l.length > 0)
    .join('\n');

  try {
    const response = await client.chat.completions.create({
      model: EXTRACTION_MODEL,
      temperature: 0.4,
      // 220-260 words × 2 langs × ~1.4 tokens/word ≈ 730 tokens, + meta
      // fields + JSON overhead ≈ 1000 tokens of body. We cap at 1500 to
      // leave generous headroom for sentence-≤25-words rephrasing.
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const choice = response.choices[0];
    if (!choice || !choice.message.content) {
      return { kind: 'fail', reason: 'empty LLM response' };
    }
    // Rule 12-bis: detect silent truncation.
    if (choice.finish_reason === 'length') {
      return {
        kind: 'fail',
        reason: 'finish_reason=length (truncated) — bump maxOutputTokens above 1200',
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(choice.message.content);
    } catch {
      return { kind: 'fail', reason: `JSON parse failed: ${choice.message.content.slice(0, 200)}` };
    }
    const parsed = SeedSchema.safeParse(json);
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
  readonly content: SeedContent;
  readonly warnings: readonly string[];
}

function wordCount(s: string): number {
  return s.split(/\s+/u).filter((w) => w.length > 0).length;
}

// EDITORIAL_VOICE.md §3 — superlatives + tics rédactionnels bannis.
// We don't auto-reject (we want minimum-viable seed, not pristine
// output) — we surface them as warnings so an editor can clean up.
const BANNED_FR =
  /\b(incroyable|magnifique|magique|sublime|n['’]h[ée]sitez pas|il est [aà] noter|dans le cadre de|notamment|d[ée]couvrez|[aà] ne pas manquer)\b/iu;
const BANNED_EN =
  /\b(amazing|stunning|incredible|magnificent|feel free to|discover the|must[- ]see|world[- ]class)\b/iu;
// "exceptionnel" gets a softer rule because it's the official Atout
// France Palace classification term — only flag standalone uses.
const EXCEPTIONNEL_RX = /\bexceptionnell?e?s?\b/iu;

function bannedWordIssues(text: string, locale: 'fr' | 'en'): readonly string[] {
  const issues: string[] = [];
  const banned = locale === 'fr' ? BANNED_FR : BANNED_EN;
  const m = banned.exec(text);
  if (m) issues.push(`banned ${locale} word: "${m[0]}"`);
  if (locale === 'fr') {
    const ex = EXCEPTIONNEL_RX.exec(text);
    if (ex && !/atout france/iu.test(text)) {
      issues.push(`banned-or-soft fr word: "${ex[0]}" (allowed only when citing Atout France)`);
    }
  }
  return issues;
}

// Lint sentence length — Concierge voice = ≤ 25 words STRICT.
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

function postValidate(raw: SeedContent): ValidationOutcome {
  const warnings: string[] = [];

  let meta_title_fr = raw.meta_title_fr.trim();
  let meta_title_en = raw.meta_title_en.trim();
  let meta_desc_fr = raw.meta_desc_fr.trim();
  let meta_desc_en = raw.meta_desc_en.trim();
  let description_fr = raw.description_fr.trim();
  let description_en = raw.description_en.trim();

  // meta_title: ≤ 60 chars (truncate, never throw away)
  if (meta_title_fr.length > 60) {
    warnings.push(`meta_title_fr truncated from ${meta_title_fr.length} to 60 chars`);
    meta_title_fr = truncateChars(meta_title_fr, 60);
  }
  if (meta_title_en.length > 60) {
    warnings.push(`meta_title_en truncated from ${meta_title_en.length} to 60 chars`);
    meta_title_en = truncateChars(meta_title_en, 60);
  }
  if (meta_title_fr.length < 20) warnings.push(`meta_title_fr too short (${meta_title_fr.length})`);
  if (meta_title_en.length < 20) warnings.push(`meta_title_en too short (${meta_title_en.length})`);

  // meta_desc: aim for 130-150 chars (truncate over, warn under)
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

  // description: aim 220-260 words; gpt-4o-mini chronically undershoots
  // word-count instructions so we warn under 140 only (still much better
  // than NULL/empty for SEO purposes — minimum-viable seed).
  description_fr = ensureConciergeLine(description_fr, 'fr');
  description_en = ensureConciergeLine(description_en, 'en');
  const wcFr = wordCount(description_fr);
  const wcEn = wordCount(description_en);
  if (wcFr < 140) warnings.push(`description_fr short (${wcFr} words, target 220-260)`);
  if (wcEn < 140) warnings.push(`description_en short (${wcEn} words, target 220-260)`);
  if (wcFr > 320) warnings.push(`description_fr long (${wcFr} words, target 220-260)`);
  if (wcEn > 320) warnings.push(`description_en long (${wcEn} words, target 220-260)`);

  // Editorial cleanup signals — non-blocking, surfaced for human review.
  for (const w of bannedWordIssues(description_fr, 'fr')) warnings.push(w);
  for (const w of bannedWordIssues(description_en, 'en')) warnings.push(w);
  const tooLongFr = tooLongSentences(description_fr);
  const tooLongEn = tooLongSentences(description_en);
  if (tooLongFr > 0) warnings.push(`description_fr has ${tooLongFr} sentence(s) > 25 words`);
  if (tooLongEn > 0) warnings.push(`description_en has ${tooLongEn} sentence(s) > 25 words`);

  return {
    content: {
      meta_title_fr,
      meta_title_en,
      meta_desc_fr,
      meta_desc_en,
      description_fr,
      description_en,
    },
    warnings,
  };
}

// ─── DB write ──────────────────────────────────────────────────────────────

interface PgClientLike {
  query: (text: string, values: ReadonlyArray<unknown>) => Promise<unknown>;
}

async function writeContent(
  client: PgClientLike,
  slug: string,
  content: SeedContent,
  hero: string | null,
): Promise<void> {
  // COALESCE preserves any value an editor already pinned; we only ever
  // fill blanks. Re-running the script is idempotent.
  const sql = `
    UPDATE public.hotels SET
      meta_title_fr  = COALESCE(meta_title_fr,  $2),
      meta_title_en  = COALESCE(meta_title_en,  $3),
      meta_desc_fr   = COALESCE(meta_desc_fr,   $4),
      meta_desc_en   = COALESCE(meta_desc_en,   $5),
      description_fr = COALESCE(description_fr, $6),
      description_en = COALESCE(description_en, $7),
      hero_image     = COALESCE(hero_image,     $8),
      updated_at     = timezone('utc', now())
    WHERE slug = $1;
  `.trim();
  await client.query(sql, [
    slug,
    content.meta_title_fr,
    content.meta_title_en,
    content.meta_desc_fr,
    content.meta_desc_en,
    content.description_fr,
    content.description_en,
    hero,
  ]);
}

// ─── Concurrency helper (Rule 7 — bounded, no Promise.all flood) ──────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Runlog entry ──────────────────────────────────────────────────────────

interface RunLogEntry {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly country_code: string;
  readonly luxury_tier: string;
  readonly status: 'success' | 'skipped' | 'error';
  readonly reason?: string;
  readonly warnings?: readonly string[];
  readonly hero_image_set?: boolean;
  readonly wikidata_used?: boolean;
  readonly tokens?: { input: number; output: number };
  /** Only populated on --dry-run for inspection. */
  readonly content_preview?: SeedContent;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  console.log(
    `[seed-tier1] starting — dryRun=${args.dryRun}, skipImages=${args.skipImages}, ` +
      `limit=${args.limit ?? 'none'}, slugs=${args.slugs.length}, concurrency=${args.concurrency}`,
  );

  if (!process.env['OPENAI_API_KEY']) {
    console.error('[seed-tier1] OPENAI_API_KEY missing in .env.local');
    process.exit(1);
  }
  const connectionString =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (!connectionString) {
    console.error(
      '[seed-tier1] DATABASE_URL / SUPABASE_DB_POOLER_URL / SUPABASE_DB_URL missing in .env.local',
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
    const filters: string[] = ["country_code != 'FR'", 'is_published = false'];
    const params: unknown[] = [];
    params.push(TIER1 as unknown as readonly string[]);
    filters.push(`luxury_tier = ANY($${params.length}::text[])`);
    if (args.slugs.length > 0) {
      params.push(args.slugs);
      filters.push(`slug = ANY($${params.length}::text[])`);
    }
    const limitSql = args.limit !== null ? `LIMIT ${args.limit}` : '';
    const sql = `
      SELECT slug, name, city, country_code, country_label_fr, country_label_en,
             region, luxury_tier, wikidata_id, commons_category, official_url,
             hero_image, description_fr, meta_desc_fr
      FROM public.hotels
      WHERE ${filters.join(' AND ')}
      ORDER BY
        CASE luxury_tier
          WHEN 'world_50_best' THEN 1
          WHEN 'tl_worlds_best' THEN 2
          WHEN 'cn_gold_list' THEN 3
          WHEN 'aman' THEN 4
          WHEN 'rosewood' THEN 5
          WHEN 'four_seasons' THEN 6
          WHEN 'mandarin_oriental' THEN 7
          WHEN 'belmond' THEN 8
          WHEN 'park_hyatt' THEN 9
          WHEN 'ritz_carlton_reserve' THEN 10
          ELSE 11
        END,
        name
      ${limitSql};
    `.trim();
    const r = await dbClient.query(sql, params);
    hotels = r.rows as HotelRow[];

    const byTier: Record<string, number> = {};
    for (const h of hotels) byTier[h.luxury_tier] = (byTier[h.luxury_tier] ?? 0) + 1;
    console.log(`[seed-tier1] ${hotels.length} candidates`);
    for (const t of TIER1) {
      const n = byTier[t] ?? 0;
      if (n > 0) console.log(`              ${String(n).padStart(4)} × ${t}`);
    }

    if (hotels.length === 0) {
      console.log('[seed-tier1] nothing to do, exiting.');
      return;
    }

    // ───── Per-hotel pipeline ─────────────────────────────────────────────

    const runlog: RunLogEntry[] = new Array(hotels.length);
    let totalIn = 0;
    let totalOut = 0;
    let okCount = 0;
    let errCount = 0;
    let skipCount = 0;

    await runWithConcurrency(hotels, args.concurrency, async (hotel, idx) => {
      const tag = `[${String(idx + 1).padStart(3)}/${hotels.length}] ${hotel.slug}`;

      // Skip if both factual_summary surface AND description are already
      // populated — assume an editor (or a previous run) handled it.
      const alreadySeeded =
        hotel.description_fr !== null &&
        hotel.description_fr.trim().length > 0 &&
        hotel.meta_desc_fr !== null &&
        hotel.meta_desc_fr.trim().length > 0;
      if (alreadySeeded) {
        console.log(`${tag} ⤵ already seeded (description_fr + meta_desc_fr set), skipping`);
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          luxury_tier: hotel.luxury_tier,
          status: 'skipped',
          reason: 'already seeded',
        };
        skipCount += 1;
        return;
      }

      try {
        // ── Wikidata facts (best-effort, never blocks the LLM call) ──
        let facts: CompactWdFacts | null = null;
        if (hotel.wikidata_id !== null && hotel.wikidata_id.length > 0) {
          // Polite throttle — we run with concurrency 5 so the global
          // pace stays well under Wikidata's 5 req/s recommendation.
          await sleep(300 + Math.random() * 300);
          facts = await fetchWdFacts(hotel.wikidata_id);
        }

        // ── LLM generation ──
        const result = await generateContent(openai, hotel, facts);
        if (result.kind === 'fail') {
          console.warn(`${tag} ✗ LLM fail: ${result.reason}`);
          runlog[idx] = {
            slug: hotel.slug,
            name: hotel.name,
            city: hotel.city,
            country_code: hotel.country_code,
            luxury_tier: hotel.luxury_tier,
            status: 'error',
            reason: result.reason,
            wikidata_used: facts !== null,
          };
          errCount += 1;
          return;
        }
        totalIn += result.usage.inputTokens;
        totalOut += result.usage.outputTokens;

        const { content, warnings } = postValidate(result.content);

        // ── Commons hero image (optional) ──
        let hero: string | null = null;
        if (
          !args.skipImages &&
          hotel.hero_image === null &&
          hotel.commons_category !== null &&
          hotel.commons_category.length > 0
        ) {
          await sleep(150 + Math.random() * 250);
          hero = await fetchCommonsHero(hotel.commons_category);
        }

        if (!args.dryRun) {
          await writeContent(dbClient, hotel.slug, content, hero);
        }

        const heroNote = hero ? ' +hero' : '';
        const warnNote = warnings.length > 0 ? ` ⚠${warnings.length}` : '';
        const wdNote = facts !== null ? ' wd' : '';
        console.log(
          `${tag} ✓${wdNote}${heroNote}${warnNote}  meta=${content.meta_desc_fr.length}/${content.meta_desc_en.length}c desc=${wordCount(content.description_fr)}/${wordCount(content.description_en)}w`,
        );

        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          luxury_tier: hotel.luxury_tier,
          status: 'success',
          warnings: warnings.length > 0 ? warnings : undefined,
          hero_image_set: hero !== null,
          wikidata_used: facts !== null,
          tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
          // Inspectable text in dry-run only — full DB has the same data
          // after a real run, no need to duplicate it twice.
          content_preview: args.dryRun ? content : undefined,
        } as RunLogEntry;
        okCount += 1;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ exception: ${reason}`);
        runlog[idx] = {
          slug: hotel.slug,
          name: hotel.name,
          city: hotel.city,
          country_code: hotel.country_code,
          luxury_tier: hotel.luxury_tier,
          status: 'error',
          reason,
        };
        errCount += 1;
      }
    });

    // ───── Final stats + runlog ──────────────────────────────────────────
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    // gpt-4o-mini-2024-07-18 pricing (per 1M tokens): $0.15 input, $0.60 output.
    const cost = (totalIn / 1_000_000) * 0.15 + (totalOut / 1_000_000) * 0.6;
    const heroFilled = runlog.filter((r) => r?.hero_image_set).length;
    const withWd = runlog.filter((r) => r?.wikidata_used).length;

    console.log('');
    console.log('────────────────────────────────────────');
    console.log('[seed-tier1] DONE');
    console.log(`  candidates : ${hotels.length}`);
    console.log(`  success    : ${okCount}`);
    console.log(`  skipped    : ${skipCount}`);
    console.log(`  errored    : ${errCount}`);
    console.log(`  with Wikidata facts: ${withWd}/${okCount}`);
    console.log(`  hero_image set     : ${heroFilled}/${okCount}`);
    console.log(`  LLM tokens : in=${totalIn} out=${totalOut} cost≈$${cost.toFixed(3)}`);
    console.log(`  elapsed    : ${elapsed}s`);
    if (args.dryRun) console.log('  (DRY RUN — no DB writes performed)');

    const runsDir = resolve(__dirname, '../../runs');
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const runlogPath = resolve(runsDir, `seed-tier1-${stamp}.json`);
    writeFileSync(
      runlogPath,
      JSON.stringify(
        {
          startedAt: new Date(startedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          args,
          stats: {
            candidates: hotels.length,
            success: okCount,
            skipped: skipCount,
            errored: errCount,
            withWikidata: withWd,
            heroImageSet: heroFilled,
            tokens: { input: totalIn, output: totalOut },
            estimatedCostUsd: Number(cost.toFixed(4)),
            elapsedSeconds: Number(elapsed),
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

main().catch((err) => {
  console.error('[seed-tier1] FATAL', err);
  process.exit(1);
});
