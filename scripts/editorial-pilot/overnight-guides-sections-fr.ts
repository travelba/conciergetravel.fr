/**
 * Phase 5 (morning) — long-form Concierge content for destination/country guides.
 *
 * Writes two columns added in migration 0039 on `public.editorial_guides` :
 *   - `summary_long_fr`     : magazine-style lead-in (2500-5500 chars / 400-700 mots, prose dense)
 *   - `editorial_sections`  : array of 6-9 Concierge-voice sections (400-700 mots each)
 *
 * Voice : « Le Concierge » (ADR-0011) — expert complice, jamais commercial,
 * phrases ≤ 25 mots strict, lexique anti-IA, sources factuelles nommées
 * (Atout France + millésime, Michelin + nombre d'étoiles, UNESCO + année…).
 * Lecture obligatoire avant tout patch : EDITORIAL_VOICE.md +
 * docs/editorial/style-guide.md §4-5.
 *
 * Two-call strategy (cf. .cursor/skills/llm-output-robustness/SKILL.md Rule 1) :
 *   Call 1 (4000 tok) → summary_long_fr seul.
 *   Call 2 (8000 tok) → editorial_sections, prend summary_long_fr en contexte
 *                       pour ne pas le redire.
 *
 * Idempotent. SQL filter ne touche QUE les rows incomplètes.
 * `--force` outrepasse le filtre (utile pour régénérer la voix Concierge).
 *
 * Usage (PowerShell, depuis scripts/editorial-pilot/) :
 *
 *   pnpm exec tsx overnight-guides-sections-fr.ts --limit 3 --concurrency 1
 *   pnpm exec tsx overnight-guides-sections-fr.ts --slugs france,paris,gordes
 *   pnpm exec tsx overnight-guides-sections-fr.ts --scope country --concurrency 2
 *   pnpm exec tsx overnight-guides-sections-fr.ts --dry-run --slugs paris
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';
import pg from 'pg';
import { z } from 'zod';

// ─────────────────────────── env / clients ───────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

// Supabase pooler ships a self-signed CA chain in the Windows trust store ;
// the editorial-pilot scripts (siblings) all bypass with rejectUnauthorized: false.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];
if (typeof OPENAI_API_KEY !== 'string' || OPENAI_API_KEY.length < 20) {
  console.error('[guides-sections] OPENAI_API_KEY missing or invalid in env.');
  process.exit(1);
}

const RAW_DB_URL =
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  process.env['DATABASE_URL'] ??
  '';
if (RAW_DB_URL.length === 0) {
  console.error('[guides-sections] SUPABASE_DB_POOLER_URL / SUPABASE_DB_URL missing in env.');
  process.exit(1);
}
const DB_URL = RAW_DB_URL.replace(/[?&]sslmode=[^&]*/giu, '');

const MODEL = process.env['EDITORIAL_PILOT_OPENAI_MODEL'] ?? 'gpt-5.4';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// ─────────────────────────── CLI parsing ───────────────────────────

interface CliArgs {
  readonly limit: number;
  readonly slugs: ReadonlyArray<string> | null;
  readonly scope: 'city' | 'region' | 'cluster' | 'country' | null;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly concurrency: number;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  function flag(name: string): string | null {
    const i = argv.indexOf(name);
    if (i < 0) return null;
    const v = argv[i + 1];
    return typeof v === 'string' ? v : null;
  }
  const limitRaw = flag('--limit');
  const limit =
    limitRaw === null || Number.isNaN(Number(limitRaw))
      ? Number.POSITIVE_INFINITY
      : Number(limitRaw);
  const slugsRaw = flag('--slugs') ?? flag('--slug');
  const slugs =
    slugsRaw === null
      ? null
      : slugsRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
  const scopeRaw = flag('--scope');
  const scope =
    scopeRaw === 'city' || scopeRaw === 'region' || scopeRaw === 'cluster' || scopeRaw === 'country'
      ? scopeRaw
      : null;
  const concurrencyRaw = flag('--concurrency');
  const concurrency =
    concurrencyRaw === null || Number.isNaN(Number(concurrencyRaw))
      ? 2
      : Math.max(1, Math.min(6, Number(concurrencyRaw)));
  return {
    limit,
    slugs,
    scope,
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    concurrency,
  };
}

const args = parseArgs(process.argv.slice(2));

// ─────────────────────────── Zod schemas ───────────────────────────

const KIND_VALUES = [
  'overview',
  'when-to-visit',
  'what-to-see',
  'how-to-get-around',
  'where-to-eat',
  'where-to-stay',
  'practical',
  'concierge-tip',
  'context',
] as const;

const SummarySchema = z.object({
  summary_long_fr: z.string().min(2500).max(5500),
});

const SectionSchema = z.object({
  anchor: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title_fr: z.string().min(8).max(120),
  // 400-700 mots ≈ 1800-4500 chars en français dense. Lenient floor 1800.
  body_fr: z.string().min(1800).max(4500),
  position: z.number().int().min(1).max(9),
  kind: z.enum(KIND_VALUES).optional(),
});

const SectionsSchema = z.object({
  sections: z.array(SectionSchema).min(6).max(9),
});

type Section = z.infer<typeof SectionSchema>;

// ─────────────────────────── voice contract (system prompt) ───────────────────────────

const SYSTEM_PROMPT = [
  'Tu es Le Concierge — expert complice, jamais commercial — pour MyConciergeHotel.com (agence IATA premium, 5★ et Palaces). Tu écris en français pour des voyageurs premium 40-65 ans, lectorat Condé Nast Traveler / Figaro Magazine.',
  '',
  'CONTRAT DE VOIX (non négociable, ADR-0011) :',
  '- Tu écris à la 3ᵉ personne par défaut. « Je » singulier autorisé uniquement dans la voix de conseil opérationnel. « Nous » pluriel INTERDIT dans le corps.',
  '- Phrases ≤ 25 mots STRICT. Hard rule. Compte avant de rendre.',
  '- Pas de superlatif vide : incroyable, magnifique, magique, sublime, somptueux, féerique, enchanteur, fascinant, splendide, mythique, inoubliable, exceptionnel (sauf classification Atout France).',
  '- Lexique interdit : niché, joyau, écrin, havre, refuge, bulle, escapade, dépaysement, art de vivre (sauf cité), art de recevoir, savoir-faire ancestral, quintessence, raffinement à la française, douceur de vivre, élégance intemporelle, charme désuet, cocon, sanctuaire, temple (du), institution (sauf factuel), spot, must, adresse confidentielle, secret bien gardé, coup de cœur (sauf attribué).',
  '- Ouvertures interdites : « Niché au cœur », « Au cœur de », « Découvrez », « Plongez dans », « Bienvenue dans », « Laissez-vous », « Imaginez ».',
  '- Adverbes IA-typiques interdits : véritablement, particulièrement (sauf factuel), notablement, remarquablement, harmonieusement, subtilement (sauf factuel), élégamment, divinement, sublimement, merveilleusement, magnifiquement, royalement, résolument, définitivement, assurément.',
  "- Verbes IA-typiques interdits : « se dresse fièrement », « s'inscrit dans », « rayonne par », « marie subtilement », « s'illustre par », « se distingue par », « incarne », « sublime » (verbe).",
  "- Patterns interdits : « X, c'est Y », « Plus qu'un X », « À l'image de », « Telle une », « Que vous soyez X, Y ou Z », faux questions rhétoriques (« Comment ne pas… ? »), conclusions paresseuses (« En définitive », « Ainsi », « Une chose est sûre »).",
  "- Pas d'emoji, pas d'exclamation, pas de markdown (gras, italique), pas de balise HTML, pas de listes à puces, pas de titres internes (la structure h2/h3 est gérée côté rendu).",
  '',
  'CONTRAT DE FACTUALITÉ (signature 6.2 du style-guide) :',
  '- Cite des institutions VRAIES avec millésime et nombre exact : « Palace classé par Atout France en 2020 », « 3 étoiles au Guide Michelin 2025 », « inscrit au patrimoine mondial UNESCO en 1985 », « Relais & Châteaux depuis 1988 ».',
  "- Si tu n'es pas certain d'un chiffre, dis « plus d'un demi-siècle » plutôt que d'inventer une date. JAMAIS de chiffre rond inventé (« environ 350 m² » INTERDIT).",
  '- Prix TOUJOURS TTC, TOUJOURS en euros. Pour les destinations non-€ : « ¥2 000 (≈ 12 €) ».',
  '- Distances précises (km, m) quand pertinent. Pas de « à quelques pas de ».',
  '- Pour les destinations hors France, équivalents locaux acceptables : Forbes Travel Guide (étoiles), Japan Ryokan Association, Hong Kong Tourism Board, etc. — uniquement si tu en es certain.',
  '',
  'POSTURE DU CONCIERGE :',
  '- Tu es un insider qui partage des secrets opérationnels. Tu ne vends pas, tu informes.',
  "- Détails concrets > généralités : un nom de quartier, un numéro de bus, une heure d'ouverture, un nom de chef étoilé, un mois de festival.",
  "- Nuance honnête bienvenue (« à éviter en juillet à cause de l'affluence », « le seul bémol : pas de ligne directe RER »). La crédibilité du Concierge vient de ces nuances.",
].join('\n');

// ─────────────────────────── post-validation helpers ───────────────────────────

/** Mots = tokens unicode L|N, après split sur tout ce qui n'est pas L|N. */
function countWords(s: string): number {
  return s
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0).length;
}

/** Sépare en phrases sur ponctuation forte précédant un espace + capitale. */
function splitSentences(s: string): ReadonlyArray<string> {
  return s
    .replace(/\s+/gu, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ])/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Renvoie les phrases > 25 mots (violation hard ADR-0011). */
function findLongSentences(s: string): ReadonlyArray<string> {
  return splitSentences(s).filter((sent) => countWords(sent) > 25);
}

/** Termes bannis (subset des 75+ — les plus communs en sortie LLM). */
const BANNED_WORD_BOUNDARIES = [
  'incroyable',
  'magnifique',
  'magique',
  'sublime',
  'somptueux',
  'somptueuse',
  'féerique',
  'feerique',
  'enchanteur',
  'enchanteresse',
  'fascinant',
  'fascinante',
  'splendide',
  'mythique',
  'inoubliable',
  'merveilleux',
  'merveilleuse',
  'extraordinaire',
  'remarquable',
  'véritable cocon',
  'cocon de luxe',
  'havre de paix',
  'écrin',
  'ecrin',
  'joyau',
  'niché',
  'niche au cœur',
  'au cœur battant',
  'dépaysement',
  'escapade',
  'quintessence',
  'art de recevoir',
  'savoir-faire ancestral',
  'douceur de vivre',
  'charme désuet',
  'charme intemporel',
  'élégance intemporelle',
  'raffinement à la française',
] as const;

interface BannedHit {
  readonly term: string;
  readonly count: number;
}

function findBannedTerms(s: string): ReadonlyArray<BannedHit> {
  const lower = s.toLowerCase();
  const hits: BannedHit[] = [];
  for (const term of BANNED_WORD_BOUNDARIES) {
    // word-boundary safe : on cherche une frontière non-alpha avant et après.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const re = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'giu');
    const m = lower.match(re);
    if (m !== null && m.length > 0) hits.push({ term, count: m.length });
  }
  return hits;
}

interface VoiceCheck {
  readonly ok: boolean;
  readonly longSentences: ReadonlyArray<string>;
  readonly banned: ReadonlyArray<BannedHit>;
}

function checkVoice(s: string): VoiceCheck {
  const longSentences = findLongSentences(s);
  const banned = findBannedTerms(s);
  return { ok: longSentences.length === 0 && banned.length === 0, longSentences, banned };
}

// ─────────────────────────── DB types ───────────────────────────

interface GuideRow {
  readonly slug: string;
  readonly name_fr: string;
  readonly scope: string;
  readonly country_code: string;
  readonly summary_fr: string;
  readonly summary_long_chars: number;
  readonly sections_count: number;
  readonly has_summary_long: boolean;
  readonly has_editorial_sections: boolean;
}

interface BaseRow {
  readonly slug: string;
  readonly name_fr: string;
  readonly scope: string;
  readonly country_code: string;
  readonly summary_fr: string;
  readonly summary_long_chars: string | number | null;
  readonly sections_count: string | number | null;
  readonly has_summary_long: boolean;
  readonly has_editorial_sections: boolean;
}

function toNumber(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ─────────────────────────── concurrency helper ───────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T, index: number) => Promise<R>,
): Promise<ReadonlyArray<R>> {
  const results: Array<R | undefined> = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) continue;
      results[i] = await fn(item, i);
    }
  });
  await Promise.all(workers);
  // Filter sentinels (undefined slots cannot exist after a successful run).
  return results.map((r, i) => {
    if (r === undefined) throw new Error(`[concurrency] slot ${i} unset`);
    return r;
  });
}

// ─────────────────────────── LLM calls ───────────────────────────

interface LlmCallParams {
  readonly userPrompt: string;
  readonly maxTokens: number;
}

async function callOpenAi(params: LlmCallParams): Promise<{
  readonly raw: string;
  readonly finishReason: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
}> {
  const useNewParams = /^(gpt-5|o3$|o3-(?!pro)|o4-mini)/u.test(MODEL);
  const isReasoning = /^(o3$|o3-(?!pro)|o4-mini)/u.test(MODEL);

  const base: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: params.userPrompt },
    ],
    response_format: { type: 'json_object' },
  };

  // Reasoning models reject custom `temperature` and need a generous budget
  // (cf. concierge-voice-pipeline/SKILL.md Rule 12).
  const composed: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = useNewParams
    ? isReasoning
      ? { ...base, max_completion_tokens: Math.max(params.maxTokens, 6000) }
      : { ...base, max_completion_tokens: params.maxTokens, temperature: 0.55 }
    : { ...base, max_tokens: params.maxTokens, temperature: 0.55 };

  const resp = await openai.chat.completions.create(composed);
  const choice = resp.choices[0];
  if (!choice || typeof choice.message.content !== 'string') {
    throw new Error(
      `OpenAI returned no content (usage=${JSON.stringify(resp.usage ?? {})}). ` +
        'Reasoning model probably consumed full budget on internal reasoning — bump maxTokens.',
    );
  }
  return {
    raw: choice.message.content,
    finishReason: choice.finish_reason ?? null,
    inputTokens: resp.usage?.prompt_tokens ?? 0,
    outputTokens: resp.usage?.completion_tokens ?? 0,
  };
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Fallback : strip code-fence wrappers (some models still wrap despite JSON mode).
    const stripped = raw.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, '');
    return JSON.parse(stripped);
  }
}

// ─────────────────────────── prompts ───────────────────────────

function buildSummaryUserPrompt(row: GuideRow): string {
  const scopeFr =
    row.scope === 'city'
      ? 'ville'
      : row.scope === 'region'
        ? 'région'
        : row.scope === 'cluster'
          ? 'cluster éditorial (regroupement géographique)'
          : 'pays';
  return [
    'TÂCHE',
    "Rédige `summary_long_fr` : un texte d'introduction magazine pour le guide de destination ci-dessous.",
    '',
    'CONTEXTE DESTINATION',
    `- Nom : ${row.name_fr}`,
    `- Périmètre : ${scopeFr} (${row.scope})`,
    `- Pays : ${row.country_code}`,
    `- Carte de visite existante (meta) : ${row.summary_fr}`,
    '',
    'CAHIER DES CHARGES `summary_long_fr`',
    '- Cible : 2500-5500 caractères (espaces inclus), soit ~ 400-700 mots.',
    '- Une seule prose dense, magazine, sans titres, sans bullet points, sans markdown.',
    '- 4 à 7 paragraphes séparés par UNE ligne vide (`\\n\\n`).',
    '- Pose la scène : géographie, héritage, ce qui fait la signature du lieu, ce que le voyageur premium vient y chercher.',
    "- Ne déballe PAS le contenu des sections (que faire / où manger / quand venir). Sers d'ouverture, pas de résumé exhaustif.",
    '- Cite AU MOINS 2 repères factuels nommés (un monument + une institution / classification, par exemple « patrimoine UNESCO depuis 1979 » + « 14 restaurants étoilés Michelin »).',
    '- Mentionne 1 nuance honnête (saison, affluence, accès, contrainte) — la crédibilité du Concierge.',
    '- Toutes les phrases ≤ 25 mots STRICT. Compte avant de rendre.',
    '',
    "FORMAT DE SORTIE — JSON STRICT, RIEN D'AUTRE",
    '{',
    '  "summary_long_fr": "…paragraphes séparés par \\n\\n…"',
    '}',
  ].join('\n');
}

function buildSectionsUserPrompt(row: GuideRow, summaryLong: string): string {
  const scopeFr =
    row.scope === 'city'
      ? 'ville'
      : row.scope === 'region'
        ? 'région'
        : row.scope === 'cluster'
          ? 'cluster éditorial'
          : 'pays';
  const targetCount =
    row.scope === 'country'
      ? '9 sections'
      : row.scope === 'city'
        ? '7 à 8 sections'
        : '8 à 9 sections';
  return [
    'TÂCHE',
    `Génère 6 à 9 sections éditoriales pour le guide ${row.name_fr} (${scopeFr}). Cible : ${targetCount}.`,
    '',
    "TU AS DÉJÀ ÉCRIT L'INTRODUCTION (summary_long_fr ci-dessous) — NE LA REDIS PAS.",
    "L'intro pose le décor. Les sections approfondissent CHACUNE un sujet précis.",
    '',
    '=== summary_long_fr déjà rédigé (contexte, ne pas répéter) ===',
    summaryLong,
    '=== fin contexte ===',
    '',
    'CONTEXTE DESTINATION',
    `- Nom : ${row.name_fr}`,
    `- Périmètre : ${scopeFr} (${row.scope})`,
    `- Pays : ${row.country_code}`,
    `- Carte de visite (meta) : ${row.summary_fr}`,
    '',
    'CATALOGUE DES SECTIONS CANONIQUES (choisis 6-9 dans cet ordre approximatif)',
    '1. `pourquoi-y-aller`        — overview      — la signature du lieu, qui vient et pour quoi',
    '2. `quand-y-aller`           — when-to-visit — saisons, météo, calendrier festival (cite des dates et des noms réels)',
    '3. `que-faire`               — what-to-see   — incontournables culturels, quartiers, musées, expériences',
    '4. `comment-circuler`        — how-to-get-around — transports, marchabilité, distances aéroport (en km), taxi vs métro',
    '5. `ou-manger`               — where-to-eat  — culture culinaire, plats signatures, paysage Michelin (cite étoiles + millésime)',
    "6. `ou-loger`                — where-to-stay — panorama des quartiers (PAS une liste d'hôtels — c'est le rôle des classements)",
    '7. `ce-quil-faut-savoir`     — practical     — visa, devise, pourboires, électricité, taxes, salutations utiles',
    "8. `hors-des-sentiers-battus` — context (ou concierge-tip) — secrets opérationnels d'initié",
    '9. `a-eviter`                — practical     — pièges touristiques, arnaques, quartiers à zapper, dates à fuir',
    '',
    'RÈGLES DE PRODUCTION',
    '- 6 sections minimum pour une destination plus petite, 7-8 pour une ville, 9 pour un pays/région large.',
    '- Chaque body_fr : 400 à 700 mots (≈ 1800-4500 caractères), prose dense, 4-7 paragraphes séparés par UNE ligne vide.',
    '- Toutes les phrases ≤ 25 mots STRICT. Hard rule. Compte avant de rendre.',
    "- `anchor` : kebab-case, doit matcher le slug du catalogue (`pourquoi-y-aller`, `quand-y-aller`, etc.). Pas d'accents.",
    '- `title_fr` : 4-9 mots français lisibles (ex. « Quand partir à Paris », « Que voir absolument à Florence », « Bouger en Toscane sans louer de voiture »).',
    "- `position` : 1-based monotonic (1, 2, 3 …) dans l'ordre de lecture.",
    '- `kind` : un des enums du catalogue. Optionnel mais recommandé pour le rendu UI.',
    '- Chaque section doit citer AU MOINS 2 noms propres (lieu, institution, festival, chef, monument).',
    '- La section `ou-manger` cite OBLIGATOIREMENT une distinction Michelin avec étoiles + millésime si pertinent ; `ou-loger` cite Atout France (ou équivalent local) si pertinent.',
    '- AUCUN superlatif vide. AUCUN lexique banni. AUCUNE ouverture banni. Cf. system prompt.',
    "- Pour `a-eviter` : sois concret (« la file d'attente Tour Eiffel en juillet à 14 h », « les taxis non-officiels gare de Rome Termini »).",
    '- Pour `hors-des-sentiers-battus` : 1ʳᵉ personne (« Mon conseil : … ») autorisée.',
    '',
    "FORMAT DE SORTIE — JSON STRICT, RIEN D'AUTRE",
    '{',
    '  "sections": [',
    '    { "anchor": "pourquoi-y-aller", "title_fr": "…", "body_fr": "…paragraphes séparés par \\n\\n…", "position": 1, "kind": "overview" },',
    '    { "anchor": "…", "title_fr": "…", "body_fr": "…", "position": 2, "kind": "…" },',
    '    …',
    '  ]',
    '}',
  ].join('\n');
}

// ─────────────────────────── per-row pipeline ───────────────────────────

interface RunOutcome {
  readonly slug: string;
  readonly status: 'ok' | 'skipped' | 'failed' | 'dry-run';
  readonly summaryChars: number;
  readonly sectionsCount: number;
  readonly sectionsWordsTotal: number;
  readonly retries: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly elapsedMs: number;
  readonly error: string | null;
}

async function generateSummaryLong(
  row: GuideRow,
  prevViolations: ReadonlyArray<string>,
): Promise<{ summary: string; tokens: { input: number; output: number }; finish: string | null }> {
  const reminder =
    prevViolations.length > 0
      ? [
          '',
          '=== TENTATIVE PRÉCÉDENTE INVALIDE ===',
          'Corrige strictement les violations suivantes :',
          ...prevViolations.slice(0, 8).map((v) => `- ${v}`),
          'Reproduis intégralement la sortie JSON, conforme cette fois.',
        ].join('\n')
      : '';
  const userPrompt = buildSummaryUserPrompt(row) + reminder;
  const resp = await callOpenAi({ userPrompt, maxTokens: 4000 });
  const parsed = SummarySchema.parse(safeParseJson(resp.raw));
  return {
    summary: parsed.summary_long_fr.trim(),
    tokens: { input: resp.inputTokens, output: resp.outputTokens },
    finish: resp.finishReason,
  };
}

async function generateSections(
  row: GuideRow,
  summaryLong: string,
  prevViolations: ReadonlyArray<string>,
): Promise<{
  sections: ReadonlyArray<Section>;
  tokens: { input: number; output: number };
  finish: string | null;
}> {
  const reminder =
    prevViolations.length > 0
      ? [
          '',
          '=== TENTATIVE PRÉCÉDENTE INVALIDE ===',
          'Corrige strictement les violations suivantes :',
          ...prevViolations.slice(0, 10).map((v) => `- ${v}`),
          'Reproduis intégralement la sortie JSON, conforme cette fois.',
        ].join('\n')
      : '';
  const userPrompt = buildSectionsUserPrompt(row, summaryLong) + reminder;
  // 8000 par défaut (cf. spec). On force >= 8000 même si l'override env est plus court.
  const resp = await callOpenAi({ userPrompt, maxTokens: 8000 });
  const parsed = SectionsSchema.parse(safeParseJson(resp.raw));
  return {
    sections: parsed.sections,
    tokens: { input: resp.inputTokens, output: resp.outputTokens },
    finish: resp.finishReason,
  };
}

function describeIssues(label: string, check: VoiceCheck): ReadonlyArray<string> {
  const out: string[] = [];
  for (const sent of check.longSentences.slice(0, 5)) {
    const w = countWords(sent);
    out.push(`[${label}] phrase de ${w} mots > 25 (max). À découper : « ${sent.slice(0, 140)}… »`);
  }
  for (const hit of check.banned.slice(0, 5)) {
    out.push(`[${label}] terme banni « ${hit.term} » (${hit.count} occurrence·s). Supprime-le.`);
  }
  return out;
}

async function processGuide(row: GuideRow): Promise<RunOutcome> {
  const started = Date.now();
  let retries = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // ─── Call 1 : summary_long_fr (avec retry tone-driven) ───
    let summary: string | null = null;
    let summaryViolations: ReadonlyArray<string> = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { summary: out, tokens } = await generateSummaryLong(row, summaryViolations);
      totalInputTokens += tokens.input;
      totalOutputTokens += tokens.output;
      const check = checkVoice(out);
      if (check.ok) {
        summary = out;
        break;
      }
      summaryViolations = describeIssues('summary_long_fr', check);
      retries += 1;
      if (attempt === 2) {
        throw new Error(
          `summary_long_fr voice check failed after 3 attempts. Issues: ${summaryViolations
            .slice(0, 3)
            .join(' | ')}`,
        );
      }
    }
    if (summary === null) {
      // Defensive — unreachable thanks to the throw above, but the type system asks.
      throw new Error('summary_long_fr unset after retries');
    }

    // ─── Call 2 : editorial_sections ───
    let sections: ReadonlyArray<Section> | null = null;
    let sectionViolations: ReadonlyArray<string> = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { sections: out, tokens } = await generateSections(row, summary, sectionViolations);
      totalInputTokens += tokens.input;
      totalOutputTokens += tokens.output;
      // Vérification voix sur chaque body_fr + chaque title_fr.
      const allViolations: string[] = [];
      const anchorsSeen = new Set<string>();
      for (const sec of out) {
        if (anchorsSeen.has(sec.anchor)) {
          allViolations.push(
            `[section] anchor dupliqué « ${sec.anchor} ». Chaque anchor doit être unique.`,
          );
        }
        anchorsSeen.add(sec.anchor);
        const c = checkVoice(sec.body_fr);
        for (const issue of describeIssues(`section "${sec.anchor}"`, c)) {
          allViolations.push(issue);
        }
        const titleCheck = checkVoice(sec.title_fr);
        for (const issue of describeIssues(`section "${sec.anchor}" title`, titleCheck)) {
          allViolations.push(issue);
        }
      }
      if (allViolations.length === 0) {
        // Vérifie monotonie positions
        const sorted = [...out].sort((a, b) => a.position - b.position);
        sections = sorted;
        break;
      }
      sectionViolations = allViolations;
      retries += 1;
      if (attempt === 2) {
        throw new Error(
          `editorial_sections voice check failed after 3 attempts. Issues: ${sectionViolations
            .slice(0, 3)
            .join(' | ')}`,
        );
      }
    }
    if (sections === null) {
      throw new Error('editorial_sections unset after retries');
    }

    const sectionsWordsTotal = sections.reduce((acc, s) => acc + countWords(s.body_fr), 0);

    if (args.dryRun) {
      const ms = Date.now() - started;
      return {
        slug: row.slug,
        status: 'dry-run',
        summaryChars: summary.length,
        sectionsCount: sections.length,
        sectionsWordsTotal,
        retries,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        elapsedMs: ms,
        error: null,
      };
    }

    // ─── DB write (single statement = atomic) ───
    await db.query(
      `update public.editorial_guides
          set summary_long_fr = $1,
              editorial_sections = $2::jsonb,
              updated_at = now()
        where slug = $3`,
      [summary, JSON.stringify(sections), row.slug],
    );

    const ms = Date.now() - started;
    return {
      slug: row.slug,
      status: 'ok',
      summaryChars: summary.length,
      sectionsCount: sections.length,
      sectionsWordsTotal,
      retries,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      elapsedMs: ms,
      error: null,
    };
  } catch (e) {
    const ms = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      slug: row.slug,
      status: 'failed',
      summaryChars: 0,
      sectionsCount: 0,
      sectionsWordsTotal: 0,
      retries,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      elapsedMs: ms,
      error: msg,
    };
  }
}

// ─────────────────────────── main ───────────────────────────

async function main(): Promise<void> {
  await db.connect();

  // SQL filter : incomplete rows. `--force` outrepasse via la clause OR true.
  const baseSql = `
    select slug,
           name_fr,
           scope,
           country_code,
           summary_fr,
           coalesce(char_length(summary_long_fr), 0)             as summary_long_chars,
           coalesce(jsonb_array_length(editorial_sections), 0)   as sections_count,
           (summary_long_fr is not null and char_length(summary_long_fr) >= 2500)
             as has_summary_long,
           (jsonb_array_length(coalesce(editorial_sections, '[]'::jsonb)) >= 6)
             as has_editorial_sections
      from public.editorial_guides
     where (
             $1::boolean = true
          or summary_long_fr is null
          or char_length(summary_long_fr) < 2500
          or editorial_sections is null
          or jsonb_array_length(editorial_sections) < 6
           )
       and ($2::text is null or scope = $2)
       and char_length(coalesce(summary_fr, '')) >= 60
     order by
       case scope when 'country' then 0 when 'region' then 1 when 'cluster' then 2 else 3 end,
       slug
  `;

  const res = await db.query<BaseRow>(baseSql, [args.force, args.scope]);

  const all: ReadonlyArray<GuideRow> = res.rows.map((r) => ({
    slug: r.slug,
    name_fr: r.name_fr,
    scope: r.scope,
    country_code: r.country_code,
    summary_fr: r.summary_fr,
    summary_long_chars: toNumber(r.summary_long_chars),
    sections_count: toNumber(r.sections_count),
    has_summary_long: r.has_summary_long,
    has_editorial_sections: r.has_editorial_sections,
  }));

  const filtered: ReadonlyArray<GuideRow> = (
    args.slugs === null ? all : all.filter((r) => args.slugs?.includes(r.slug) === true)
  ).slice(0, Number.isFinite(args.limit) ? args.limit : all.length);

  console.log(
    `[guides-sections] model=${MODEL} concurrency=${args.concurrency} dry-run=${args.dryRun} force=${args.force}`,
  );
  console.log(
    `[guides-sections] ${filtered.length} guides to enrich` +
      (args.slugs !== null ? ` (slugs=${args.slugs.join(',')})` : '') +
      (args.scope !== null ? ` (scope=${args.scope})` : '') +
      (Number.isFinite(args.limit) ? ` (limit=${args.limit})` : ''),
  );

  if (filtered.length === 0) {
    console.log('[guides-sections] Nothing to do. Exiting.');
    await db.end();
    return;
  }

  // Per-row log header.
  console.log(
    'slug                                 | scope    | summary_chars | sections | words   | retries | tokens (in/out)  | status',
  );

  const outcomes = await runWithConcurrency(filtered, args.concurrency, async (row) => {
    const outcome = await processGuide(row);
    const slugPad = row.slug.padEnd(36).slice(0, 36);
    const scopePad = row.scope.padEnd(8).slice(0, 8);
    const charsPad = String(outcome.summaryChars).padStart(13);
    const secPad = String(outcome.sectionsCount).padStart(8);
    const wordsPad = String(outcome.sectionsWordsTotal).padStart(7);
    const retriesPad = String(outcome.retries).padStart(7);
    const tokensPad = `${outcome.inputTokens}/${outcome.outputTokens}`.padStart(16);
    const status =
      outcome.status === 'ok'
        ? `OK (${outcome.elapsedMs}ms)`
        : outcome.status === 'dry-run'
          ? `DRY (${outcome.elapsedMs}ms)`
          : outcome.error !== null
            ? `FAIL: ${outcome.error.slice(0, 160)}`
            : 'FAIL';
    console.log(
      `${slugPad} | ${scopePad} | ${charsPad} | ${secPad} | ${wordsPad} | ${retriesPad} | ${tokensPad} | ${status}`,
    );
    return outcome;
  });

  const ok = outcomes.filter((o) => o.status === 'ok').length;
  const dry = outcomes.filter((o) => o.status === 'dry-run').length;
  const failed = outcomes.filter((o) => o.status === 'failed').length;
  const totalIn = outcomes.reduce((a, o) => a + o.inputTokens, 0);
  const totalOut = outcomes.reduce((a, o) => a + o.outputTokens, 0);

  console.log('');
  console.log(
    `[guides-sections] DONE — ok=${ok} dry-run=${dry} failed=${failed} (of ${filtered.length})`,
  );
  console.log(`[guides-sections] tokens — input=${totalIn} output=${totalOut} (model=${MODEL})`);

  if (failed > 0) {
    console.log('');
    console.log('[guides-sections] Failed slugs (re-run with --slugs to retry):');
    for (const o of outcomes) {
      if (o.status === 'failed') {
        console.log(`  - ${o.slug} :: ${o.error ?? 'unknown error'}`);
      }
    }
  }

  await db.end();
}

main().catch(async (err) => {
  console.error('[guides-sections] FATAL', err);
  try {
    await db.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
