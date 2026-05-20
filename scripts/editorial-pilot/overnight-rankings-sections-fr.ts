/**
 * Generate `editorial_sections` (3–5 long-form sections × 300–500 words FR)
 * for rankings that still need their middle body. Voice = Le Concierge
 * (EDITORIAL_VOICE.md §3, ADR-0011, concierge-voice-pipeline/SKILL.md).
 *
 * Each section object stored in JSONB carries the user-spec fields
 * (anchor, position, title_fr, body_fr) AND mirrors the rendering Zod
 * shape used in `apps/web/src/server/rankings/get-ranking-by-slug.ts`
 * (key === anchor, type === anchor, title_en/body_en defaulted to '')
 * so the long-read page keeps rendering until a dedicated EN pass runs.
 *
 * Hard rules enforced post-LLM (style-guide.md §4-5 + EDITORIAL_VOICE.md
 * §3 + ADR-0011 §C2):
 *  - No banned superlatives / IA openings / marketing tics.
 *  - Every sentence ≤ 25 mots.
 *  - 300-500 words body (1500-3500 chars).
 *  - 3 to 5 sections per ranking.
 * Up to 2 retries with tightened feedback prompt, then SKIP.
 *
 * Idempotent : rows with ≥ 3 sections are skipped unless `--force`.
 *
 * Usage:
 *   pnpm exec tsx overnight-rankings-sections-fr.ts \
 *     [--limit N] [--slugs slugA,slugB] [--dry-run] [--force] [--concurrency 3]
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';
import pg from 'pg';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

// ──────────────────────────────────────────────────────────────────────────
// CLI parsing — mirrors overnight-rankings-{intro,faq}-fr.ts conventions.
// ──────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function readFlagValue(flag: string): string | null {
  const i = args.indexOf(flag);
  if (i < 0) return null;
  const v = args[i + 1];
  return typeof v === 'string' ? v : null;
}

function readBoolean(flag: string): boolean {
  return args.indexOf(flag) >= 0;
}

const limitArg = (() => {
  const v = readFlagValue('--limit');
  if (v === null) return Number.POSITIVE_INFINITY;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
})();

const slugsArg = (() => {
  const v = readFlagValue('--slugs') ?? readFlagValue('--slug');
  if (v === null) return null;
  const list = v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : null;
})();

const dryRun = readBoolean('--dry-run');
const force = readBoolean('--force');
const concurrencyArg = (() => {
  const v = readFlagValue('--concurrency');
  if (v === null) return 3;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 8) : 3;
})();

// ──────────────────────────────────────────────────────────────────────────
// DB + OpenAI clients — strict mirror of overnight-rankings-intro-fr.ts.
// ──────────────────────────────────────────────────────────────────────────

const conn = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  ''
).replace(/[?&]sslmode=[^&]*/giu, '');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY']! });
const MODEL = process.env['EDITORIAL_PILOT_OPENAI_MODEL'] ?? 'gpt-5.4';

// ──────────────────────────────────────────────────────────────────────────
// Banned lexicon — extracted from docs/editorial/style-guide.md §4–5 and
// EDITORIAL_VOICE.md §3. Word-boundary regex, case-insensitive, Unicode.
// We deliberately ban "exceptionnel" unconditionally (the Atout France
// callout can be phrased "classé Palace par Atout France" without the
// adjective) to keep the post-validator simple and robust.
// ──────────────────────────────────────────────────────────────────────────

const BANNED_TERMS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  // Superlatives explicitly called out in EDITORIAL_VOICE.md §3.
  { pattern: /\bincroyable[s]?\b/iu, label: 'incroyable' },
  { pattern: /\bmagnifique[s]?\b/iu, label: 'magnifique' },
  { pattern: /\bmagique[s]?\b/iu, label: 'magique' },
  { pattern: /\bsublime[s]?\b/iu, label: 'sublime' },
  { pattern: /\bexceptionnel(?:le|s|les)?\b/iu, label: 'exceptionnel' },
  // Cat A (Clichés voyage premium).
  { pattern: /\bincontournable[s]?\b/iu, label: 'incontournable' },
  { pattern: /\bjoyau[x]?\b/iu, label: 'joyau' },
  { pattern: /\bécrin[s]?\b/iu, label: 'écrin' },
  { pattern: /\bhavre[s]? de paix\b/iu, label: 'havre de paix' },
  { pattern: /\bdépaysement\b/iu, label: 'dépaysement' },
  { pattern: /\bescapade[s]?\b/iu, label: 'escapade' },
  { pattern: /\benchanteur\b|\benchanteresse\b|\benchanteurs\b/iu, label: 'enchanteur' },
  { pattern: /\bféerique[s]?\b/iu, label: 'féerique' },
  { pattern: /\bunique en son genre\b/iu, label: 'unique en son genre' },
  { pattern: /\bcomme nulle part ailleurs\b/iu, label: 'comme nulle part ailleurs' },
  { pattern: /\badresse[s]? confidentielle[s]?\b/iu, label: 'adresse confidentielle' },
  { pattern: /\bsecret[s]? bien gardé[s]?\b/iu, label: 'secret bien gardé' },
  { pattern: /\bcoup[s]? de c(?:œ|oe)ur\b/iu, label: 'coup de cœur' },
  { pattern: /\bclassique[s]? indémodable[s]?\b/iu, label: 'classique indémodable' },
  { pattern: /\b(?:atmosphère|ambiance) feutrée\b/iu, label: 'atmosphère/ambiance feutrée' },
  { pattern: /\bcocon[s]?\b/iu, label: 'cocon' },
  { pattern: /\bsanctuaire[s]?\b/iu, label: 'sanctuaire' },
  {
    pattern: /\btemple du (?:bien-être|spa|luxe|repos|raffinement|goût)\b/iu,
    label: 'temple du …',
  },
  { pattern: /\bbulle de (?:luxe|calme|sérénité|tranquillité)\b/iu, label: 'bulle de …' },
  // Cat B (IA-typical openings).
  { pattern: /\bniché[e]?[s]? au c(?:œ|oe)ur\b/iu, label: 'niché au cœur' },
  { pattern: /\bniché[e]?[s]? entre\b/iu, label: 'niché entre' },
  { pattern: /\bau c(?:œ|oe)ur battant\b/iu, label: 'au cœur battant' },
  { pattern: /^découvrez\b|\. découvrez\b/iu, label: 'découvrez (ouverture)' },
  { pattern: /\bplongez dans\b/iu, label: 'plongez dans' },
  { pattern: /\bbienvenue dans\b/iu, label: 'bienvenue dans' },
  {
    pattern: /\blaissez-vous (?:porter|séduire|guider|emporter|tenter)\b/iu,
    label: 'laissez-vous',
  },
  { pattern: /\bimaginez(?:-vous)?\b/iu, label: 'imaginez' },
  // Cat C (Adverbs).
  { pattern: /\bvéritablement\b/iu, label: 'véritablement' },
  { pattern: /\bnotablement\b/iu, label: 'notablement' },
  { pattern: /\bremarquablement\b/iu, label: 'remarquablement' },
  { pattern: /\bharmonieusement\b/iu, label: 'harmonieusement' },
  { pattern: /\bélégamment\b/iu, label: 'élégamment' },
  { pattern: /\bdivinement\b/iu, label: 'divinement' },
  { pattern: /\bsublimement\b/iu, label: 'sublimement' },
  { pattern: /\bmerveilleusement\b/iu, label: 'merveilleusement' },
  { pattern: /\bmagnifiquement\b/iu, label: 'magnifiquement' },
  { pattern: /\broyalement\b/iu, label: 'royalement' },
  { pattern: /\brésolument\b/iu, label: 'résolument' },
  { pattern: /\bdéfinitivement\b/iu, label: 'définitivement' },
  { pattern: /\bassurément\b/iu, label: 'assurément' },
  // Cat D (IA-typical verbs).
  { pattern: /\bse dresse fièrement\b/iu, label: 'se dresse fièrement' },
  { pattern: /\bmarie subtilement\b/iu, label: 'marie subtilement' },
  { pattern: /\bs'illustre par\b/iu, label: "s'illustre par" },
  { pattern: /\bse distingue par\b/iu, label: 'se distingue par' },
  { pattern: /\b(?:il|elle|cet hôtel|ce palace) incarne\b/iu, label: 'incarne' },
  // Cat E (Marketing creux).
  { pattern: /\bart de recevoir\b/iu, label: 'art de recevoir' },
  { pattern: /\bart de vivre\b/iu, label: 'art de vivre' },
  { pattern: /\bsavoir-faire ancestral\b/iu, label: 'savoir-faire ancestral' },
  { pattern: /\bquintessence\b/iu, label: 'quintessence' },
  { pattern: /\bcrème de la crème\b/iu, label: 'crème de la crème' },
  { pattern: /\braffinement à la française\b/iu, label: 'raffinement à la française' },
  { pattern: /\bdouceur de vivre\b/iu, label: 'douceur de vivre' },
  { pattern: /\bélégance intemporelle\b/iu, label: 'élégance intemporelle' },
  { pattern: /\bcharme (?:désuet|intemporel)\b/iu, label: 'charme désuet/intemporel' },
  // EDITORIAL_VOICE.md §3 — tics rédactionnels.
  { pattern: /\bn'hésitez pas à\b/iu, label: "n'hésitez pas à" },
  { pattern: /\bil est à noter que\b/iu, label: 'il est à noter que' },
  { pattern: /\bdans le cadre de\b/iu, label: 'dans le cadre de' },
  // Style-guide §5 — patterns IA.
  { pattern: /\bque vous soyez\b/iu, label: 'que vous soyez …' },
  { pattern: /\bque ce soit pour\b/iu, label: 'que ce soit pour …' },
  { pattern: /\bcomment ne pas\b/iu, label: 'comment ne pas …' },
  { pattern: /\bqui ne rêverait pas\b/iu, label: 'qui ne rêverait pas …' },
  { pattern: /\ben définitive\b/iu, label: 'en définitive' },
  { pattern: /\bune chose est sûre\b/iu, label: 'une chose est sûre' },
  { pattern: /\bplus qu'un hôtel\b/iu, label: "plus qu'un hôtel" },
];

function findBannedTerms(text: string): string[] {
  const hits = new Set<string>();
  for (const { pattern, label } of BANNED_TERMS) {
    if (pattern.test(text)) hits.add(label);
  }
  return [...hits];
}

// ──────────────────────────────────────────────────────────────────────────
// Sentence + word helpers — kept in lockstep with linter.ts countWords
// (concierge-voice-pipeline/SKILL.md Rule 6 ⚠).
// ──────────────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function countWords(text: string): number {
  return text
    .split(/\s+/u)
    .map((tok) => tok.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((tok) => tok.length > 0).length;
}

function findLongSentences(text: string, max = 25): { sentence: string; words: number }[] {
  const out: { sentence: string; words: number }[] = [];
  for (const s of splitSentences(text)) {
    const n = countWords(s);
    if (n > max) out.push({ sentence: s, words: n });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Zod schema (user-spec) + section validator.
// ──────────────────────────────────────────────────────────────────────────

const SectionSchema = z.object({
  anchor: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u),
  title_fr: z.string().min(8).max(120),
  body_fr: z.string().min(1500).max(3500),
  position: z.number().int().min(1).max(5),
});
type SectionLlm = z.infer<typeof SectionSchema>;

const Schema = z.object({
  sections: z.array(SectionSchema).min(3).max(5),
});

interface SectionViolation {
  readonly anchor: string;
  readonly banned: string[];
  readonly longSentences: { sentence: string; words: number }[];
  readonly wordCount: number;
}

function validateSections(sections: readonly SectionLlm[]): SectionViolation[] {
  const violations: SectionViolation[] = [];
  for (const s of sections) {
    const banned = findBannedTerms(s.body_fr).concat(findBannedTerms(s.title_fr));
    const longSentences = findLongSentences(s.body_fr);
    const wordCount = countWords(s.body_fr);
    const wordOk = wordCount >= 270 && wordCount <= 560;
    if (banned.length > 0 || longSentences.length > 0 || !wordOk) {
      violations.push({
        anchor: s.anchor,
        banned,
        longSentences,
        wordCount,
      });
    }
  }
  return violations;
}

// ──────────────────────────────────────────────────────────────────────────
// Prompts — voice contract + JSON contract + (on retry) targeted reminders.
// ──────────────────────────────────────────────────────────────────────────

const SYSTEM = `Tu es Le Concierge — expert complice, jamais commercial — pour MyConciergeHotel.com, agence IATA premium spécialisée dans les hôtels 5★ et Palaces.

CONTRAT DE VOIX (ADR-0011)
- Posture insider : tu partages un savoir opérationnel, tu n'argumentes pas comme un vendeur.
- Mostly à la 3ᵉ personne factuelle ; le « je » du Concierge n'apparaît qu'avec parcimonie pour signer une recommandation. Pas de « nous », pas de « notre équipe ».
- Phrases ≤ 25 mots. Toujours. Sans exception. C'est un gate dur.
- Aucun superlatif creux : pas d'« incroyable », « magnifique », « magique », « sublime », « exceptionnel », « joyau », « écrin », « havre de paix », « bulle de luxe », « quintessence », « art de vivre », « douceur de vivre », « élégance intemporelle », « charme intemporel », « refuge ».
- Pas d'ouvertures IA : pas de « Niché au cœur de », « Au cœur battant », « Découvrez », « Plongez dans », « Bienvenue dans », « Laissez-vous porter », « Imaginez ».
- Pas d'adverbes faibles : pas de « véritablement », « notablement », « remarquablement », « élégamment », « divinement », « sublimement », « merveilleusement », « magnifiquement », « royalement », « résolument », « définitivement », « assurément ».
- Pas de tics : pas de « n'hésitez pas à », « il est à noter que », « dans le cadre de », « que vous soyez X, Y ou Z », « en définitive », « plus qu'un hôtel », « comment ne pas… », « qui ne rêverait pas ».
- Pas d'emoji, pas d'exclamation, pas de markdown gras/italique, pas de balise HTML.

RIGUEUR FACTUELLE (style-guide §6.2)
- Si tu cites un classement : Atout France avec millésime, Michelin avec nombre d'étoiles, Relais & Châteaux, Leading Hotels of the World (LHW), Forbes Travel Guide, Condé Nast Gold List, Travel + Leisure World's Best — pas de mention vague.
- Toujours TTC en euros. Pas de prix exact si tu n'en as pas.
- Chiffres précis (« 342 m² », « 1908 », « 87 suites ») plutôt qu'arrondis.
- Si tu mentionnes un hôtel précis, reprends le nom verbatim depuis la liste fournie.

STRUCTURE D'UNE SECTION
- Une section = 350 à 500 mots de prose dense (≈ 1700-2800 caractères). MINIMUM 320 mots, c'est un gate dur — sous ce seuil, la section est rejetée.
- Structure interne : 1 phrase d'amorce → 3 paragraphes d'évidence factuelle → 1 phrase de clôture qui ouvre la suivante. Aucune liste à puces.
- Densité factuelle obligatoire dans chaque section : au moins 3 repères concrets (millésime, chiffre, surface, distance précise, nom de chef, classement nommé, prix indicatif TTC en euros). C'est la condition pour atteindre 350+ mots sans verbiage marketing.
- Le titre fait 4 à 9 mots, sans superlatif, descriptif.
- L'anchor est un slug kebab-case, en français sans accent ni espace (ex : « notre-methode », « ce-qui-fait-la-difference », « quand-y-aller », « comment-choisir », « le-conseil-du-concierge », « pour-quel-voyage »).

THÉMATIQUES À CONSIDÉRER (le Concierge choisit 3 à 5 sections selon la nature du classement)
- notre-methode : critères, sources, méthodologie. Cite Atout France, Michelin, R&C, LHW, Forbes selon pertinence.
- ce-qui-fait-la-difference : ce que les propriétés retenues partagent vraiment, au-delà du marketing.
- quand-y-aller : saisonnalité, fenêtres tarifaires, météo, événements locaux (si pertinent pour le classement).
- comment-choisir : grille de décision selon profil voyageur (couple, famille, affaires, anniversaire, gastronomie).
- le-conseil-du-concierge : SECRET OPÉRATIONNEL concret (numéro de chambre, contact direct du Chef Concierge, accès discret, timing de réservation). Distinct du bloc ConciergeAdvice fiche hôtel : ici c'est une section long-form.

CONTRAT DE FORMAT — JSON STRICT
Tu retournes EXACTEMENT ce JSON, sans aucune prose autour, sans markdown :
{
  "sections": [
    {
      "anchor": "notre-methode",
      "title_fr": "Comment cette sélection a été constituée",
      "body_fr": "...300-500 mots de prose dense...",
      "position": 1
    },
    ... 2 à 4 autres sections ...
  ]
}

Le nombre de sections est de 3 à 5. Pour un classement court et homogène (ex. « Top 10 palaces de Paris »), 3 suffisent. Pour un classement thématique riche (« Hôtels Spa de la Côte d'Azur »), monte à 4 ou 5.`;

interface RankingRow {
  readonly slug: string;
  readonly title_fr: string;
  readonly kind: string;
  readonly intro_fr: string | null;
  readonly outro_fr: string | null;
  readonly factual_summary_fr: string | null;
  readonly axes_label: string | null;
  readonly hotel_names: string | null;
}

function buildUserPrompt(row: RankingRow): string {
  const hotelNamesList = (row.hotel_names ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
  return [
    `Slug du classement : ${row.slug}`,
    `Titre FR : ${row.title_fr}`,
    `Nature (kind) : ${row.kind}`,
    `Résumé factuel : ${row.factual_summary_fr ?? '(absent)'}`,
    row.axes_label ? `Axes : ${row.axes_label}` : 'Axes : aucun défini',
    '',
    'Intro existante (extrait, pour calibrer la continuité de voix) :',
    (row.intro_fr ?? '').slice(0, 1400),
    '',
    hotelNamesList.length > 0
      ? `Hôtels représentatifs (à citer verbatim si pertinent, dans le désordre) :\n- ${hotelNamesList.join('\n- ')}`
      : 'Hôtels représentatifs : aucun fourni — reste général.',
    '',
    'Génère 3 à 5 sections (chacune 350-500 mots, MINIMUM 320 mots, sinon rejet automatique) qui constituent le corps long du classement.',
    'Choisis les thématiques selon la nature du classement (best_of, awarded, thematic, geographic) — voir la liste suggérée du system prompt.',
    "Chaque section doit ouvrir par une amorce factuelle, dérouler 3 paragraphes d'évidence (chiffres précis, sources nommées, repères géographiques, prix indicatifs TTC en euros), conclure sur une transition naturelle.",
    "Pour atteindre 350+ mots sans tomber dans le marketing creux : multiplie les FAITS concrets (date d'ouverture, surface en m², distance en km, étoiles Michelin, millésime Atout France, prix indicatif, nom de chef, numéro d'arrondissement, marque hôtelière mère).",
    'Retourne UNIQUEMENT le JSON.',
  ].join('\n');
}

function buildRetryPrompt(
  row: RankingRow,
  violations: SectionViolation[],
  attempt: number,
): string {
  const base = buildUserPrompt(row);
  const reminder: string[] = [
    '',
    '---',
    `TENTATIVE PRÉCÉDENTE INVALIDE — attempt #${attempt}. Corrige STRICTEMENT ces violations sans changer la longueur globale :`,
  ];
  for (const v of violations) {
    const lines: string[] = [`  • section "${v.anchor}" :`];
    if (v.banned.length > 0) {
      lines.push(
        `      - termes bannis détectés : ${v.banned.join(', ')} — réécris ces passages sans ces mots.`,
      );
    }
    if (v.longSentences.length > 0) {
      const samples = v.longSentences
        .slice(0, 3)
        .map((s) => `        · ${s.words} mots : "${s.sentence.slice(0, 140)}…"`);
      lines.push(
        `      - ${v.longSentences.length} phrase(s) > 25 mots, ex :\n${samples.join('\n')}`,
      );
      lines.push('        Coupe-les en phrases ≤ 25 mots, conserve les chiffres et noms propres.');
    }
    if (v.wordCount < 270) {
      lines.push(
        `      - body trop court (${v.wordCount} mots, cible 350-500) — ajoute des faits CONCRETS (millésime classement, surface suite m², distance km, prix TTC €, nom chef étoilé, marque hôtelière mère, arrondissement). PAS de chevilles.`,
      );
    } else if (v.wordCount > 560) {
      lines.push(
        `      - body trop long (${v.wordCount} mots, cible 350-500) — resserre, retire le verbiage.`,
      );
    }
    reminder.push(lines.join('\n'));
  }
  reminder.push('');
  reminder.push('Règles de récupération :');
  reminder.push('- Toutes les phrases ≤ 25 mots (compte les mots).');
  reminder.push('- Aucun terme banni de la liste system prompt.');
  reminder.push('- 300-500 mots par section, 3 à 5 sections au total.');
  reminder.push(
    '- Retourne UNIQUEMENT le JSON complet (toutes les sections, pas seulement les fautives).',
  );
  return [base, ...reminder].join('\n');
}

// ──────────────────────────────────────────────────────────────────────────
// LLM call wrapper — handles GPT-5.x / O-series param migration (Rule 12).
// ──────────────────────────────────────────────────────────────────────────

const USE_NEW_PARAMS = /^(gpt-5|o3$|o3-(?!pro)|o4-mini)/.test(MODEL);
const IS_REASONING = /^(o3$|o3-(?!pro)|o4-mini)/.test(MODEL);

async function callLlm(userPrompt: string, temperature: number): Promise<string> {
  const params: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' as const },
  };
  if (USE_NEW_PARAMS) {
    params['max_completion_tokens'] = IS_REASONING ? 8000 : 6000;
    if (!IS_REASONING) params['temperature'] = temperature;
  } else {
    params['max_tokens'] = 6000;
    params['temperature'] = temperature;
  }
  const resp = await openai.chat.completions.create(params as never);
  const choice = resp.choices[0];
  if (!choice || !choice.message.content) {
    throw new Error(
      `empty response (finish_reason=${choice?.finish_reason ?? '?'}, usage=${JSON.stringify(resp.usage ?? {})})`,
    );
  }
  if (choice.finish_reason === 'length') {
    throw new Error(`response truncated (finish_reason=length) — increase max_completion_tokens`);
  }
  return choice.message.content;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-ranking generation with up to 2 retries.
// ──────────────────────────────────────────────────────────────────────────

interface GenerationOutcome {
  readonly status: 'OK' | 'SKIP' | 'FAIL';
  readonly retries: number;
  readonly sectionsCount: number;
  readonly totalWords: number;
  readonly sections: ReadonlyArray<SectionLlm>;
  readonly reason?: string;
}

async function generateForRanking(row: RankingRow): Promise<GenerationOutcome> {
  let userPrompt = buildUserPrompt(row);
  let lastViolations: SectionViolation[] = [];
  let lastRawError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    // gpt-4o tends to produce compact prose; we keep temperature
    // moderate-to-high on every attempt to avoid the model collapsing to a
    // shorter "safe" answer when shown the previous violations.
    const temperature = attempt === 1 ? 0.6 : attempt === 2 ? 0.55 : 0.5;
    let raw: string;
    try {
      raw = await callLlm(userPrompt, temperature);
    } catch (err) {
      lastRawError = (err as Error).message;
      // network / truncation errors don't benefit from a feedback retry; keep going on the same prompt.
      continue;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch (err) {
      lastRawError = `JSON.parse failed: ${(err as Error).message.slice(0, 200)}`;
      continue;
    }
    const safe = Schema.safeParse(parsedJson);
    if (!safe.success) {
      lastRawError = `schema-fail: ${safe.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join(' | ')}`;
      // Schema-fail benefits from explicit feedback : feed the issues back.
      const tooShort = safe.error.issues.some(
        (i) => i.path.includes('body_fr') && /at least 1500/.test(i.message),
      );
      const extraGuidance = tooShort
        ? [
            '',
            'CAUSE PROBABLE : tu as écrit des bodies trop courts (< 1500 caractères ≈ < 300 mots).',
            'Étoffe CHAQUE body_fr à 350-500 mots en ajoutant DES FAITS CONCRETS :',
            "  - millésime du classement Atout France ou Michelin, nombre exact d'étoiles ;",
            '  - surface des suites en m², millésime de la dernière rénovation ;',
            '  - distance précise (en km) à un POI nommé (aéroport, gare, monument) ;',
            '  - prix indicatif TTC en euros sur une nuit en basse / haute saison ;',
            '  - nom du chef étoilé, intitulé du restaurant, spécialité régionale citée ;',
            '  - marque hôtelière mère (LVMH, Accor Raffles, Belmond, Mandarin Oriental, etc.) ;',
            '  - arrondissement parisien ou quartier identifié.',
            'Ne rajoute JAMAIS de cheville (« qui plus est », « par ailleurs », « il convient de souligner ») — uniquement des faits.',
          ].join('\n')
        : '';
      userPrompt = [
        buildUserPrompt(row),
        '',
        '---',
        `TENTATIVE PRÉCÉDENTE INVALIDE (schema Zod, attempt #${attempt}). Corrige strictement :`,
        ...safe.error.issues.slice(0, 15).map((i) => `  • ${i.path.join('.')}: ${i.message}`),
        extraGuidance,
        '',
        'Retourne UNIQUEMENT le JSON corrigé, structure { "sections": [ … ] } avec 3 à 5 sections complètes.',
      ].join('\n');
      continue;
    }
    const sections = safe.data.sections.map((s, i) => ({
      ...s,
      position: i + 1,
    }));
    const violations = validateSections(sections);
    if (violations.length === 0) {
      const totalWords = sections.reduce((acc, s) => acc + countWords(s.body_fr), 0);
      return {
        status: 'OK',
        retries: attempt - 1,
        sectionsCount: sections.length,
        totalWords,
        sections,
      };
    }
    lastViolations = violations;
    if (attempt < 3) {
      userPrompt = buildRetryPrompt(row, violations, attempt + 1);
    }
  }
  const reasonParts: string[] = [];
  if (lastRawError !== null) reasonParts.push(lastRawError);
  if (lastViolations.length > 0) {
    const summary = lastViolations
      .map((v) => {
        const bits: string[] = [];
        if (v.banned.length > 0) bits.push(`banned=${v.banned.join('/')}`);
        if (v.longSentences.length > 0) bits.push(`long=${v.longSentences.length}`);
        if (v.wordCount < 270 || v.wordCount > 560) bits.push(`words=${v.wordCount}`);
        return `${v.anchor}[${bits.join(',')}]`;
      })
      .join('; ');
    reasonParts.push(summary);
  }
  return {
    status: 'SKIP',
    retries: 2,
    sectionsCount: 0,
    totalWords: 0,
    sections: [],
    reason: reasonParts.join(' | ').slice(0, 320) || 'unknown validation failure',
  };
}

// ──────────────────────────────────────────────────────────────────────────
// DB write — JSONB array. Mirrors get-ranking-by-slug.ts EditorialSectionSchema
// (key, type, body_en, title_en) so the rendering layer stays happy, while
// preserving the user-spec fields (anchor, position, title_fr, body_fr).
// ──────────────────────────────────────────────────────────────────────────

interface JsonbSection {
  readonly anchor: string;
  readonly position: number;
  readonly title_fr: string;
  readonly body_fr: string;
  readonly key: string;
  readonly type: string;
  readonly title_en: string;
  readonly body_en: string;
}

function toJsonbSections(sections: ReadonlyArray<SectionLlm>): JsonbSection[] {
  return sections.map((s, i) => ({
    anchor: s.anchor,
    position: i + 1,
    title_fr: s.title_fr.trim(),
    body_fr: s.body_fr.trim(),
    // Rendering-layer compat (apps/web/src/server/rankings/get-ranking-by-slug.ts).
    key: s.anchor,
    type: s.anchor,
    title_en: '',
    body_en: '',
  }));
}

async function writeRanking(slug: string, sections: ReadonlyArray<SectionLlm>): Promise<void> {
  const jsonb = JSON.stringify(toJsonbSections(sections));
  await client.query(
    `update public.editorial_rankings
        set editorial_sections = $1::jsonb,
            updated_at = timezone('utc', now())
      where slug = $2`,
    [jsonb, slug],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Concurrency helper (Rule 7 of llm-output-robustness).
// ──────────────────────────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (cursor < items.length) {
        const i = cursor;
        cursor += 1;
        const item = items[i];
        if (item === undefined) continue;
        results[i] = await fn(item, i);
      }
    }),
  );
  return results;
}

// ──────────────────────────────────────────────────────────────────────────
// Main.
// ──────────────────────────────────────────────────────────────────────────

await client.connect();

const filterClause = force
  ? ''
  : `and (
       editorial_sections is null
    or jsonb_typeof(editorial_sections) <> 'array'
    or jsonb_array_length(editorial_sections) < 3
   )`;

const slugsClause = slugsArg !== null ? 'and er.slug = any($1::text[])' : '';
const queryParams: unknown[] = slugsArg !== null ? [slugsArg] : [];

const sql = `
  with axes_summary as (
    select er.slug,
           coalesce(string_agg(distinct (a->>'label_fr'), ', '), '') as axes_label
      from public.editorial_rankings er
      left join lateral jsonb_array_elements(
        case when jsonb_typeof(er.axes) = 'array' then er.axes else '[]'::jsonb end
      ) a on true
     group by er.slug
  ),
  hotels_summary as (
    select e.ranking_id,
           string_agg(h.name, '|' order by e.rank) filter (where e.rank <= 5) as hotel_names
      from public.editorial_ranking_entries e
      join public.hotels h on h.id = e.hotel_id
     group by e.ranking_id
  )
  select er.slug,
         er.title_fr,
         er.kind,
         er.intro_fr,
         er.outro_fr,
         er.factual_summary_fr,
         ax.axes_label,
         hs.hotel_names
    from public.editorial_rankings er
    left join axes_summary ax on ax.slug = er.slug
    left join hotels_summary hs on hs.ranking_id = er.id
   where er.factual_summary_fr is not null
     and er.intro_fr is not null
     ${filterClause}
     ${slugsClause}
   order by er.slug;
`;

const { rows } = await client.query<RankingRow>(sql, queryParams);
const targets: ReadonlyArray<RankingRow> = rows.slice(
  0,
  Number.isFinite(limitArg) ? limitArg : rows.length,
);

console.log(
  `[rankings-sections] eligible=${rows.length} target=${targets.length} ` +
    `limit=${limitArg === Number.POSITIVE_INFINITY ? '∞' : limitArg} ` +
    `slugs=${slugsArg === null ? '*' : slugsArg.join(',')} ` +
    `force=${force} dry-run=${dryRun} concurrency=${concurrencyArg} model=${MODEL}`,
);

if (targets.length === 0) {
  console.log('[rankings-sections] nothing to do.');
  await client.end();
  process.exit(0);
}

interface RowResult {
  readonly slug: string;
  readonly outcome: GenerationOutcome;
  readonly ms: number;
}

const results = await runWithConcurrency(targets, concurrencyArg, async (row) => {
  const t0 = Date.now();
  try {
    const outcome = await generateForRanking(row);
    if (outcome.status === 'OK') {
      if (dryRun) {
        const preview = outcome.sections
          .map(
            (s) => `   - [${s.position}] ${s.anchor} | "${s.title_fr}" | ${countWords(s.body_fr)}w`,
          )
          .join('\n');
        console.log(
          `  ✓ ${row.slug} (${outcome.sectionsCount} sections, ${outcome.totalWords}w, retries=${outcome.retries}, ${Date.now() - t0}ms) DRY-RUN\n${preview}`,
        );
      } else {
        await writeRanking(row.slug, outcome.sections);
        console.log(
          `  ✓ ${row.slug} | ${outcome.sectionsCount} sections | ${outcome.totalWords}w | retries=${outcome.retries} | ${Date.now() - t0}ms | OK`,
        );
      }
    } else {
      console.warn(
        `  ⚠ ${row.slug} | 0 sections | 0w | retries=${outcome.retries} | ${Date.now() - t0}ms | SKIP — ${outcome.reason}`,
      );
    }
    return { slug: row.slug, outcome, ms: Date.now() - t0 } satisfies RowResult;
  } catch (err) {
    const reason = (err as Error).message.slice(0, 280);
    console.error(`  ✗ ${row.slug} | retries=? | ${Date.now() - t0}ms | FAIL — ${reason}`);
    return {
      slug: row.slug,
      outcome: {
        status: 'FAIL',
        retries: 0,
        sectionsCount: 0,
        totalWords: 0,
        sections: [],
        reason,
      },
      ms: Date.now() - t0,
    } satisfies RowResult;
  }
});

const okCount = results.filter((r) => r.outcome.status === 'OK').length;
const skipCount = results.filter((r) => r.outcome.status === 'SKIP').length;
const failCount = results.filter((r) => r.outcome.status === 'FAIL').length;

console.log(
  `\n[rankings-sections] done — ok=${okCount} skip=${skipCount} fail=${failCount} of ${targets.length} (dry-run=${dryRun}).`,
);
if (skipCount > 0 || failCount > 0) {
  console.log('\n[rankings-sections] non-OK rows:');
  for (const r of results) {
    if (r.outcome.status !== 'OK') {
      console.log(`  ${r.outcome.status} ${r.slug} — ${r.outcome.reason ?? ''}`);
    }
  }
}

await client.end();
