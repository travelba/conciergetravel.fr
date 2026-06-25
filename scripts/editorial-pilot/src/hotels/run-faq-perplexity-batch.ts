/**
 * run-faq-perplexity-batch.ts — catalogue-wide FAQ Perplexity kit enrichment.
 *
 * Closes the catalogue-wide gap (audit 2026-06-25: only 8/2985 published
 * fiches carry the two-tier Perplexity kit). For each candidate hotel it:
 *   1. generates the FR factual kit (40–60) + concierge Q&A (20–30) via the
 *      Perplexity API (sonar, web-grounded, JSON-schema structured output);
 *   2. translates each item to EN (gpt-4o-mini, faithful, informative tone);
 *   3. transforms → kit / promote (10 CDC canonical) / concierge payloads;
 *   4. runs the coverage + row-enrichment gates and the shared `hasLeak()`
 *      anti-scaffolding gate on every generated string;
 *   5. pushes `faq_content_kit` + `faq_content` + `concierge_questions` to
 *      Supabase via PostgREST (service-role).
 *
 * Robustness (llm-output-robustness §Rule 20): EVERY network/LLM call is
 * wrapped in `withTimeout` + the per-item work runs under `Promise.allSettled`
 * so a single stuck hotel can never hang a wave. Cost is tracked from the
 * Perplexity API's own `usage.cost` field + an estimate for the OpenAI EN pass.
 *
 * Idempotent: the candidate query excludes any fiche that already has a
 * kit (`faq_content_kit` non-null) — re-running continues with the residual.
 *
 * CLI
 * ---
 *   --segment=netnew|heads|rest|all   priority cohort (default all, ordered)
 *   --limit=N                         max fiches this wave (default 60)
 *   --concurrency=N                   parallel fiches (default 4, max 8)
 *   --model=sonar                     Perplexity model (sonar | sonar-pro)
 *   --slugs=a,b,c                     explicit slug list (overrides segment)
 *   --dry-run                         generate + gate, do NOT write DB
 *   --skip-en                         FR-only push (EN parity left to follow-up)
 *
 * Examples
 * --------
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=netnew --limit=1 --dry-run
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/run-faq-perplexity-batch.ts -- --segment=netnew --limit=120 --concurrency=4
 *
 * Skill: hotel-faq-perplexity-enrichment, llm-output-robustness, geo-llm-optimization.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { CANONICAL_FAQ_QUESTIONS } from './canonical-faq-questions.js';
import { evaluateFaqKitCoverage } from './faq-perplexity-gates.js';
import { evaluateFaqKitRowEnrichment } from './faq-kit-row-enrichment.js';
import {
  CONCIERGE_CATEGORY_EN,
  CONCIERGE_QUESTION_CATEGORIES_FR,
  CONCIERGE_QUESTIONS_MAX,
  FAQ_CATEGORY_EN,
  FAQ_CATEGORY_TO_BUCKET,
  FAQ_FACTUAL_CATEGORIES_FR,
  FAQ_KIT_MAX_ITEMS,
  type FaqFactualCategoryFr,
  type ConciergeQuestionCategoryFr,
  type NormalisedConciergeQuestion,
  type NormalisedFaqKitItem,
} from './faq-perplexity-taxonomy.js';
import { selectPromoteSubset } from './faq-perplexity-transform.js';

type MutableKitItem = { -readonly [K in keyof NormalisedFaqKitItem]: NormalisedFaqKitItem[K] };
type MutableConcierge = {
  -readonly [K in keyof NormalisedConciergeQuestion]: NormalisedConciergeQuestion[K];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';
const EN_MODEL = 'gpt-4o-mini-2024-07-18';
const PERPLEXITY_TIMEOUT_MS = Number(process.env['PERPLEXITY_TIMEOUT_MS'] ?? '120000');
const OPENAI_TIMEOUT_MS = 90_000;
/** gpt-4o-mini pricing (USD / 1M tokens) — for the EN-pass cost estimate. */
const EN_INPUT_PER_M = 0.15;
const EN_OUTPUT_PER_M = 0.6;

/* ── timeout + concurrency helpers (Rule 20) ─────────────────────────────── */

class TimeoutError extends Error {}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= items.length) return;
        const item = items[i];
        if (item === undefined) continue;
        results[i] = await fn(item, i);
      }
    }),
  );
  return results;
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ── text sanitisation ───────────────────────────────────────────────────── */

/**
 * Perplexity answers carry inline citation markers (`[1]`, `[3, 5]`) and
 * occasionally markdown/backticks. Strip them — backticks alone trip the
 * shared `hasLeak()` gate, and bracketed numerals look broken in the DOM.
 */
function sanitizeText(raw: string): string {
  return raw
    .replace(/\[[0-9]+(?:\s*,\s*[0-9]+)*\]/g, '')
    .replace(/`+/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
}

/* ── Perplexity FR generation ────────────────────────────────────────────── */

interface RawFaqItem {
  readonly category: string;
  readonly question: string;
  readonly answer: string;
}
interface RawConciergeItem {
  readonly category: string;
  readonly question: string;
  readonly concierge_reply: string;
}
interface RawResearch {
  readonly faq: readonly RawFaqItem[];
  readonly concierge_questions: readonly RawConciergeItem[];
}

const RAW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    faq: {
      type: 'array',
      minItems: 48,
      maxItems: 60,
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...FAQ_FACTUAL_CATEGORIES_FR] },
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['category', 'question', 'answer'],
      },
    },
    concierge_questions: {
      type: 'array',
      minItems: 24,
      maxItems: 28,
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...CONCIERGE_QUESTION_CATEGORIES_FR] },
          question: { type: 'string' },
          concierge_reply: { type: 'string' },
        },
        required: ['category', 'question', 'concierge_reply'],
      },
    },
  },
  required: ['faq', 'concierge_questions'],
} as const;

function buildSystemPrompt(): string {
  return [
    'Tu es documentaliste hôtelier pour MyConciergeHotel.com, agence de voyage IATA spécialisée dans les palaces et hôtels d’exception.',
    'Tu fais une recherche web exhaustive et CROISÉE (site officiel, TripAdvisor, Booking, Expedia, Hotels.com, Michelin, presse luxe, blogs, avis Google).',
    'Tu ne renvoies QUE des faits vérifiés. Si un chiffre/horaire n’est pas confirmé par au moins deux sources, n’invente rien : écris exactement « Contactez la conciergerie pour confirmer les modalités du jour. »',
    'INTERDICTIONS ABSOLUES : aucune méta-commentaire sur tes sources ou ta confiance, aucune mention « non vérifié », « pending », « placeholder », « wikidata », aucun identifiant Q…, aucune balise markdown, aucun backtick, aucune note interne. Réponses en phrases complètes, autonomes.',
    'Tu écris en FRANÇAIS, ton factuel et concis (fiche d’information). Tu renvoies UNIQUEMENT du JSON conforme au schéma.',
  ].join('\n');
}

function buildUserPrompt(hotel: CandidateHotel): string {
  const loc = [hotel.city, hotel.region, hotel.country_code]
    .filter((s) => s && s.length > 0)
    .join(', ');
  const canonicalVerbatim = CANONICAL_FAQ_QUESTIONS.map(
    (q) => `« ${q.question_fr.replaceAll('{{name}}', hotel.name)} »`,
  );
  return [
    `Hôtel : « ${hotel.name} »${loc.length > 0 ? ` à ${loc}` : ''}.`,
    '',
    '1) "faq" : EXACTEMENT 50 questions FACTUELLES (jamais moins de 48) qu’un client se pose avant et pendant son séjour.',
    `   Couvre exhaustivement ces 12 catégories (libellés exacts) avec ≥ 3 questions chacune : ${FAQ_FACTUAL_CATEGORIES_FR.join(', ')}.`,
    '   Les 10 questions suivantes doivent figurer TEXTUELLEMENT (au mot près) dans "faq", chacune avec une VRAIE réponse factuelle. La réponse ne doit JAMAIS répéter ou paraphraser la question : donne le fait (« Oui, un parking privé… », « Non, l’hôtel ne dispose pas de piscine… »). Ne les omets jamais, même si la réponse est négative :',
    ...canonicalVerbatim.map((q) => `     - ${q}`),
    '   Variations longue traîne et langage naturel (recherche vocale + moteurs IA) pour les ~40 autres.',
    '   Réponses CONCISES : 1 à 2 phrases, ≤ 45 mots, autonomes. Sois bref pour livrer les 50 questions sans te faire couper.',
    '',
    '2) "concierge_questions" : EXACTEMENT 25 questions (jamais moins de 24) nécessitant l’assistance de la conciergerie.',
    `   Catégories (libellés exacts) : ${CONCIERGE_QUESTION_CATEGORIES_FR.join(', ')}.`,
    '   Réponses CONCISES : 1 à 2 phrases, ≤ 45 mots.',
    '   TON INFORMATIF OBLIGATOIRE : ne JAMAIS commencer une réponse par « Je », « J’ », « Nous » ou « On ». Commence par le fait/sujet : « La conciergerie peut… », « Il est recommandé de… », « Les réservations s’effectuent… ».',
    '',
    'Renvoie UNIQUEMENT le JSON { "faq": [...], "concierge_questions": [...] }.',
  ].join('\n');
}

interface PerplexityUsage {
  readonly total_cost?: number;
  readonly cost?: { readonly total_cost?: number };
}

interface PerplexityResult {
  readonly research: RawResearch;
  readonly costUsd: number;
}

/**
 * Tolerant JSON extraction. Perplexity occasionally truncates the output at
 * the token ceiling mid-array. We first try a clean parse; on failure we
 * salvage every COMPLETE `{...}` object inside the `faq` and
 * `concierge_questions` arrays via a bracket-balanced scan — losing only the
 * partial trailing item instead of the whole call.
 */
function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const slice =
    firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    return {
      faq: salvageObjects(content, 'faq'),
      concierge_questions: salvageObjects(content, 'concierge_questions'),
    };
  }
}

/** Extract complete top-level objects from the array following `"<key>"`. */
function salvageObjects(content: string, key: string): unknown[] {
  const marker = content.indexOf(`"${key}"`);
  if (marker < 0) return [];
  const arrStart = content.indexOf('[', marker);
  if (arrStart < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;
  for (let i = arrStart + 1; i < content.length; i += 1) {
    const ch = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        try {
          out.push(JSON.parse(content.slice(objStart, i + 1)) as unknown);
        } catch {
          /* skip malformed object */
        }
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }
  return out;
}

const RawResearchSchema = z.object({
  faq: z
    .array(
      z.object({
        category: z.string(),
        question: z.string(),
        answer: z.string(),
      }),
    )
    .min(1),
  concierge_questions: z
    .array(
      z.object({
        category: z.string(),
        question: z.string(),
        concierge_reply: z.string(),
      }),
    )
    .min(1),
});

async function generateFaqFr(
  client: OpenAI,
  model: string,
  hotel: CandidateHotel,
): Promise<PerplexityResult> {
  const res = await withTimeout(
    client.chat.completions.create({
      model,
      // Big output: ~50 FAQ + ~25 concierge. A low cap truncates the JSON
      // mid-array; salvage recovers complete items but a high ceiling avoids
      // losing the concierge tail.
      max_tokens: 16000,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(hotel) },
      ],
      // Perplexity-specific structured-output passthrough (OpenAI-compatible API).
      response_format: {
        type: 'json_schema',
        json_schema: { schema: RAW_JSON_SCHEMA },
      },
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming),
    PERPLEXITY_TIMEOUT_MS,
    `perplexity:${hotel.slug}`,
  );
  const content = res.choices[0]?.message.content ?? '';
  const parsed = RawResearchSchema.parse(extractJson(content));
  const usage = res.usage as unknown as PerplexityUsage | undefined;
  const costUsd = usage?.cost?.total_cost ?? usage?.total_cost ?? 0;
  return { research: parsed, costUsd };
}

/* ── EN translation (gpt-4o-mini, informative tone) ──────────────────────── */

const COMMITMENT_FR = /^\s*(je|j['’]|nous\b|on\b)/i;
const COMMITMENT_EN = /^\s*(i|we)\b/i;

const KitEnSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        question_en: z.string().min(4).max(260),
        answer_en: z.string().min(10).max(1400),
      }),
    )
    .min(1),
});

const ConciergeEnSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        question_en: z.string().min(4).max(260),
        reply_en: z.string().min(10).max(1400),
      }),
    )
    .min(1),
});

const KIT_EN_SYSTEM = [
  'You are a faithful FR→EN (British English) translator for MyConciergeHotel.com.',
  'Translate question_fr→question_en and answer_fr→answer_en. Preserve EXACTLY all numbers, prices, hours, proper nouns, distances. Invent nothing absent from the French.',
  'Factual tone. No HTML, no emoji, no markdown, no backticks, no citation brackets.',
  'STRICT JSON: { "items": [{ "key": "<question_fr verbatim>", "question_en": "...", "answer_en": "..." }] }.',
].join('\n');

const CONCIERGE_EN_SYSTEM = [
  'You are a faithful FR→EN (British English) translator for MyConciergeHotel.com.',
  'For each item return question_en (translation of question_fr) and reply_en (translation of reply_fr).',
  'INFORMATIVE TONE (mandatory): reply_en must NEVER start with a first-person commitment ("I", "We"). Start with the subject/fact ("The concierge can…", "It is recommended to…", "Reservations are made…").',
  'Preserve all facts (numbers, names, hours). No HTML, no emoji, no markdown, no backticks, no citation brackets.',
  'STRICT JSON: { "items": [{ "key": "<question_fr verbatim>", "question_en": "...", "reply_en": "..." }] }.',
].join('\n');

async function callOpenAiJson(
  openai: OpenAI,
  system: string,
  user: string,
  label: string,
): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const res = await withTimeout(
    openai.chat.completions.create({
      model: EN_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    OPENAI_TIMEOUT_MS,
    label,
  );
  return {
    content: res.choices[0]?.message.content ?? '',
    promptTokens: res.usage?.prompt_tokens ?? 0,
    completionTokens: res.usage?.completion_tokens ?? 0,
  };
}

interface EnPassResult {
  readonly costUsd: number;
}

async function translateKitEn(
  openai: OpenAI,
  hotel: CandidateHotel,
  kit: MutableKitItem[],
): Promise<EnPassResult> {
  const byKey = new Map<string, MutableKitItem>();
  for (const it of kit) byKey.set(it.question_fr, it);
  const batches = chunk(kit, 10);
  let cost = 0;
  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const payload = batch.map((it) => ({
        key: it.question_fr,
        question_fr: it.question_fr,
        answer_fr: it.answer_fr,
      }));
      const user = `Hotel: ${hotel.name} (${hotel.city ?? '?'}). Translate these ${payload.length} FAQ:\n${JSON.stringify(payload)}`;
      const r = await callOpenAiJson(openai, KIT_EN_SYSTEM, user, `kit-en:${hotel.slug}`);
      cost += (r.promptTokens * EN_INPUT_PER_M + r.completionTokens * EN_OUTPUT_PER_M) / 1_000_000;
      const parsed = KitEnSchema.parse(JSON.parse(r.content));
      return parsed.items;
    }),
  );
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const out of s.value) {
      const target = byKey.get(out.key);
      if (target === undefined) continue;
      const qEn = sanitizeText(out.question_en);
      const aEn = sanitizeText(out.answer_en);
      if (qEn.length > 0 && aEn.length > 0 && !hasLeak(qEn) && !hasLeak(aEn)) {
        target.question_en = qEn;
        target.answer_en = aEn;
      }
    }
  }
  return { costUsd: cost };
}

async function translateConciergeEn(
  openai: OpenAI,
  hotel: CandidateHotel,
  concierge: MutableConcierge[],
): Promise<EnPassResult> {
  const byKey = new Map<string, MutableConcierge>();
  for (const it of concierge) byKey.set(it.question_fr, it);
  const batches = chunk(concierge, 10);
  let cost = 0;
  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const payload = batch.map((it) => ({
        key: it.question_fr,
        question_fr: it.question_fr,
        reply_fr: it.reply_fr,
      }));
      const user = `Hotel: ${hotel.name} (${hotel.city ?? '?'}). Translate these ${payload.length} concierge Q&A:\n${JSON.stringify(payload)}`;
      const r = await callOpenAiJson(
        openai,
        CONCIERGE_EN_SYSTEM,
        user,
        `concierge-en:${hotel.slug}`,
      );
      cost += (r.promptTokens * EN_INPUT_PER_M + r.completionTokens * EN_OUTPUT_PER_M) / 1_000_000;
      const parsed = ConciergeEnSchema.parse(JSON.parse(r.content));
      return parsed.items;
    }),
  );
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const out of s.value) {
      const target = byKey.get(out.key);
      if (target === undefined) continue;
      const qEn = sanitizeText(out.question_en);
      const rEn = sanitizeText(out.reply_en);
      if (
        qEn.length > 0 &&
        rEn.length > 0 &&
        !COMMITMENT_EN.test(rEn) &&
        !hasLeak(qEn) &&
        !hasLeak(rEn)
      ) {
        target.question_en = qEn;
        target.reply_en = rEn;
      }
    }
  }
  return { costUsd: cost };
}

/* ── per-fiche pipeline ──────────────────────────────────────────────────── */

interface CandidateHotel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly country_code: string | null;
}

interface FicheResult {
  readonly slug: string;
  readonly ok: boolean;
  readonly kit: number;
  readonly concierge: number;
  readonly promote: number;
  readonly perplexityCostUsd: number;
  readonly enCostUsd: number;
  readonly skipped: boolean;
  readonly reason?: string;
}

function isFactualCategory(v: string): v is FaqFactualCategoryFr {
  return (FAQ_FACTUAL_CATEGORIES_FR as readonly string[]).includes(v);
}
function isConciergeCategory(v: string): v is ConciergeQuestionCategoryFr {
  return (CONCIERGE_QUESTION_CATEGORIES_FR as readonly string[]).includes(v);
}

function normForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** True when the answer merely echoes/paraphrases the question (no real info). */
function answerEchoesQuestion(question: string, answer: string): boolean {
  const q = normForCompare(question);
  const a = normForCompare(answer);
  if (a.length === 0) return true;
  return (
    a === q || (a.length <= q.length + 4 && q.startsWith(a.slice(0, Math.min(a.length, q.length))))
  );
}

/** Map + sanitize + leak-drop the raw Perplexity research into FR payloads. */
function buildFrPayloads(raw: RawResearch): {
  kit: MutableKitItem[];
  concierge: MutableConcierge[];
} {
  const kit: MutableKitItem[] = [];
  const seenQ = new Set<string>();
  for (const item of raw.faq) {
    if (!isFactualCategory(item.category)) continue;
    const q = sanitizeText(item.question);
    const a = sanitizeText(item.answer);
    if (q.length < 8 || a.length < 20) continue;
    if (hasLeak(q) || hasLeak(a)) continue;
    if (answerEchoesQuestion(q, a)) continue;
    const dedupe = q.toLowerCase();
    if (seenQ.has(dedupe)) continue;
    seenQ.add(dedupe);
    kit.push({
      category: FAQ_CATEGORY_TO_BUCKET[item.category],
      group_fr: item.category,
      group_en: FAQ_CATEGORY_EN[item.category],
      question_fr: q,
      answer_fr: a,
    });
    if (kit.length >= FAQ_KIT_MAX_ITEMS) break;
  }

  const concierge: MutableConcierge[] = [];
  const seenC = new Set<string>();
  for (const item of raw.concierge_questions) {
    if (!isConciergeCategory(item.category)) continue;
    const q = sanitizeText(item.question);
    let reply = sanitizeText(item.concierge_reply);
    if (COMMITMENT_FR.test(reply)) {
      // Defensive: drop a first-person opener clause if the model slipped.
      reply = reply
        .replace(COMMITMENT_FR, '')
        .replace(/^[^A-ZÀ-Ý]*/u, '')
        .trim();
    }
    if (q.length < 8 || reply.length < 20) continue;
    if (COMMITMENT_FR.test(reply) || hasLeak(q) || hasLeak(reply)) continue;
    const dedupe = q.toLowerCase();
    if (seenC.has(dedupe)) continue;
    seenC.add(dedupe);
    concierge.push({
      category_fr: item.category,
      category_en: CONCIERGE_CATEGORY_EN[item.category],
      question_fr: q,
      reply_fr: reply,
    });
    if (concierge.length >= CONCIERGE_QUESTIONS_MAX) break;
  }
  return { kit, concierge };
}

async function processFiche(
  perplexity: OpenAI,
  openai: OpenAI,
  model: string,
  hotel: CandidateHotel,
  cfg: SupabaseRestConfig,
  opts: { readonly dryRun: boolean; readonly skipEn: boolean },
): Promise<FicheResult> {
  let perplexityCostUsd = 0;
  let enCostUsd = 0;

  // 1. Generate FR + validate coverage (incl. promote.canonical) IN the loop,
  //    so a thin output or a canonical gap is retried cheaply BEFORE the EN
  //    pass. Each retry is a fresh Perplexity call (bounded to 3).
  let kit: MutableKitItem[] = [];
  let concierge: MutableConcierge[] = [];
  let accepted = false;
  let lastErr = '';
  for (let attempt = 0; attempt < 3 && !accepted; attempt += 1) {
    try {
      const gen = await generateFaqFr(perplexity, model, hotel);
      perplexityCostUsd += gen.costUsd;
      const payloads = buildFrPayloads(gen.research);
      const promoteFr = selectPromoteSubset(payloads.kit, { hotelName: hotel.name });
      const coverage = evaluateFaqKitCoverage(
        payloads.kit,
        payloads.concierge,
        hotel.name,
        promoteFr,
      );
      if (coverage.ok) {
        kit = payloads.kit;
        concierge = payloads.concierge;
        accepted = true;
        break;
      }
      if (payloads.kit.length > kit.length) kit = payloads.kit;
      if (payloads.concierge.length > concierge.length) concierge = payloads.concierge;
      lastErr = `gate ${coverage.issues
        .filter((i) => i.severity === 'blocker')
        .map((i) => i.code)
        .join(',')} (kit=${payloads.kit.length}, concierge=${payloads.concierge.length})`;
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err.message.slice(0, 120) : String(err);
    }
  }
  if (!accepted) {
    return {
      slug: hotel.slug,
      ok: false,
      kit: kit.length,
      concierge: concierge.length,
      promote: 0,
      perplexityCostUsd,
      enCostUsd,
      skipped: true,
      reason: `not accepted${lastErr ? ` — ${lastErr}` : ''}`,
    };
  }

  // 2. EN translation (faithful, informative).
  if (!opts.skipEn) {
    const settled = await Promise.allSettled([
      translateKitEn(openai, hotel, kit),
      translateConciergeEn(openai, hotel, concierge),
    ]);
    for (const s of settled) if (s.status === 'fulfilled') enCostUsd += s.value.costUsd;
  }

  // 3. Promote subset (CDC 10 canonical) built from the now-bilingual kit.
  const promote = selectPromoteSubset(kit, { hotelName: hotel.name });

  // 4. Final row gate (kit + concierge + promote, EN parity).
  const rowGate = evaluateFaqKitRowEnrichment({
    hotelName: hotel.name,
    faq_content_kit: kit,
    faq_content: promote,
    concierge_questions: concierge,
  });
  const rowBlockers = rowGate.issues.filter((i) => i.severity === 'blocker');
  // EN-parity blockers are tolerated only when --skip-en is set.
  const fatal = rowBlockers.filter(
    (i) =>
      opts.skipEn === false || (i.code !== 'kit.en_parity' && i.code !== 'concierge.en_parity'),
  );
  if (fatal.length > 0) {
    return {
      slug: hotel.slug,
      ok: false,
      kit: kit.length,
      concierge: concierge.length,
      promote: promote.length,
      perplexityCostUsd,
      enCostUsd,
      skipped: true,
      reason: `row gate: ${fatal.map((i) => i.code).join(',')}`,
    };
  }

  // 5. Push.
  if (!opts.dryRun) {
    await withTimeout(
      patchHotelById(cfg, hotel.id, {
        faq_content_kit: kit,
        faq_content: promote,
        concierge_questions: concierge,
        updated_at: new Date().toISOString(),
      }),
      OPENAI_TIMEOUT_MS,
      `push:${hotel.slug}`,
    );
  }

  return {
    slug: hotel.slug,
    ok: true,
    kit: kit.length,
    concierge: concierge.length,
    promote: promote.length,
    perplexityCostUsd,
    enCostUsd,
    skipped: false,
  };
}

/* ── candidate selection + ordering ──────────────────────────────────────── */

type Segment = 'netnew' | 'heads' | 'rest' | 'all';

interface RawHotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly priority: string | null;
  readonly booking_mode: string | null;
  readonly is_palace: boolean | null;
  readonly created_at: string | null;
}

async function fetchRankedHotelIds(cfg: SupabaseRestConfig): Promise<Map<string, number>> {
  // Published ranking ids → entries → hotel_id min(rank).
  const ranks = new Map<string, number>();
  const rankingRes = await fetch(
    `${cfg.url}/rest/v1/editorial_rankings?select=id&is_published=eq.true`,
    { headers: restHeaders(cfg) },
  );
  if (!rankingRes.ok) return ranks;
  const rankingRows = (await rankingRes.json()) as ReadonlyArray<{ id: string }>;
  const ids = rankingRows.map((r) => r.id);
  for (const idBatch of chunk(ids, 100)) {
    const res = await fetch(
      `${cfg.url}/rest/v1/editorial_ranking_entries?select=hotel_id,rank&ranking_id=in.(${idBatch.join(',')})`,
      { headers: restHeaders(cfg) },
    );
    if (!res.ok) continue;
    const rows = (await res.json()) as ReadonlyArray<{ hotel_id: string; rank: number | null }>;
    for (const row of rows) {
      const r = row.rank ?? 999;
      const prev = ranks.get(row.hotel_id);
      if (prev === undefined || r < prev) ranks.set(row.hotel_id, r);
    }
  }
  return ranks;
}

function restHeaders(cfg: SupabaseRestConfig): Record<string, string> {
  return {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    Accept: 'application/json',
  };
}

function isNetNew(r: RawHotelRow): boolean {
  return (
    r.priority === 'P2' &&
    r.booking_mode === 'display_only' &&
    typeof r.created_at === 'string' &&
    r.created_at.slice(0, 10) === '2026-06-25'
  );
}

async function selectCandidates(
  cfg: SupabaseRestConfig,
  segment: Segment,
  explicitSlugs: readonly string[],
): Promise<CandidateHotel[]> {
  const columns =
    'id,slug,name,city,region,country_code,priority,booking_mode,is_palace,created_at';
  if (explicitSlugs.length > 0) {
    const rows = await selectHotels<RawHotelRow>(cfg, {
      columns,
      filters: [`slug=in.(${explicitSlugs.join(',')})`],
    });
    return rows.map(toCandidate);
  }

  // Idempotency: only fiches without a kit yet.
  const baseFilters = ['is_published=eq.true', 'faq_content_kit=is.null'];

  if (segment === 'netnew') {
    const rows = await selectHotels<RawHotelRow>(cfg, {
      columns,
      filters: [
        ...baseFilters,
        'priority=eq.P2',
        'booking_mode=eq.display_only',
        'created_at=gte.2026-06-25T00:00:00',
        'created_at=lt.2026-06-26T00:00:00',
      ],
    });
    return rows.map(toCandidate);
  }

  const allRows = await selectHotels<RawHotelRow>(cfg, { columns, filters: baseFilters });

  if (segment === 'rest') {
    return allRows.map(toCandidate);
  }

  // heads | all → order by acquisition priority.
  const ranked = await fetchRankedHotelIds(cfg);
  const tier = (r: RawHotelRow): number => {
    if (isNetNew(r)) return 0;
    if (r.is_palace === true) return 1;
    if (ranked.has(r.id)) return 2;
    return 3;
  };
  const ordered = [...allRows].sort((a, b) => {
    const ta = tier(a);
    const tb = tier(b);
    if (ta !== tb) return ta - tb;
    const ra = ranked.get(a.id) ?? 999;
    const rb = ranked.get(b.id) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.slug.localeCompare(b.slug);
  });
  const filtered = segment === 'heads' ? ordered.filter((r) => tier(r) <= 2) : ordered;
  return filtered.map(toCandidate);
}

function toCandidate(r: RawHotelRow): CandidateHotel {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    city: r.city,
    region: r.region,
    country_code: r.country_code,
  };
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

interface CliArgs {
  readonly segment: Segment;
  readonly limit: number;
  readonly concurrency: number;
  readonly model: string;
  readonly slugs: readonly string[];
  readonly dryRun: boolean;
  readonly skipEn: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let segment: Segment = 'all';
  let limit = 60;
  let concurrency = 4;
  let model = 'sonar-pro';
  let slugs: string[] = [];
  let dryRun = false;
  let skipEn = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--skip-en') skipEn = true;
    else if (a.startsWith('--segment=')) {
      const s = a.slice('--segment='.length);
      if (s === 'netnew' || s === 'heads' || s === 'rest' || s === 'all') segment = s;
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n > 0) concurrency = Math.min(8, Math.floor(n));
    } else if (a.startsWith('--model=')) {
      model = a.slice('--model='.length);
    } else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return { segment, limit, concurrency, model, slugs, dryRun, skipEn };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const perplexityKey = process.env['PERPLEXITY_API_KEY'] ?? '';
  const openaiKey = process.env['OPENAI_API_KEY'] ?? '';
  if (perplexityKey.length === 0) throw new Error('PERPLEXITY_API_KEY missing in .env.local');
  if (!args.skipEn && openaiKey.length === 0)
    throw new Error('OPENAI_API_KEY missing in .env.local');

  const url = (process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '').replace(/\/+$/u, '');
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || serviceRoleKey.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  const cfg: SupabaseRestConfig = { url, serviceRoleKey };

  const perplexity = new OpenAI({ apiKey: perplexityKey, baseURL: PERPLEXITY_BASE_URL });
  const openai = new OpenAI({ apiKey: openaiKey });

  console.log(
    `[faq-batch] segment=${args.segment} limit=${args.limit} concurrency=${args.concurrency} model=${args.model} dryRun=${args.dryRun} skipEn=${args.skipEn}`,
  );

  const candidates = (await selectCandidates(cfg, args.segment, args.slugs)).slice(0, args.limit);
  console.log(`[faq-batch] candidates this wave: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log('[faq-batch] nothing to do — segment exhausted.');
    return;
  }

  const t0 = Date.now();
  const results = await runWithConcurrency(candidates, args.concurrency, async (hotel) => {
    const tf = Date.now();
    try {
      const r = await processFiche(perplexity, openai, args.model, hotel, cfg, {
        dryRun: args.dryRun,
        skipEn: args.skipEn,
      });
      console.log(
        `  ${r.ok ? '✓' : '✗'} ${r.slug} kit=${r.kit} concierge=${r.concierge} promote=${r.promote} ` +
          `pplx=$${r.perplexityCostUsd.toFixed(4)} en=$${r.enCostUsd.toFixed(4)} (${((Date.now() - tf) / 1000).toFixed(1)}s)` +
          (r.ok ? '' : ` — ${r.reason ?? ''}`),
      );
      return r;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${hotel.slug} — FATAL ${reason}`);
      const failed: FicheResult = {
        slug: hotel.slug,
        ok: false,
        kit: 0,
        concierge: 0,
        promote: 0,
        perplexityCostUsd: 0,
        enCostUsd: 0,
        skipped: true,
        reason,
      };
      return failed;
    }
  });

  const ok = results.filter((r) => r.ok);
  const perplexityCost = results.reduce((s, r) => s + r.perplexityCostUsd, 0);
  const enCost = results.reduce((s, r) => s + r.enCostUsd, 0);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const RUNLOG_DIR = resolve(__dirname, '../../runs/faq-perplexity');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNLOG_DIR, `wave-${args.segment}-${ts}.json`);
  writeFileSync(
    logPath,
    `${JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        args,
        summary: {
          attempted: results.length,
          enriched: ok.length,
          failed: results.length - ok.length,
          perplexityCallsUsd: Number(perplexityCost.toFixed(4)),
          enCostUsd: Number(enCost.toFixed(4)),
          totalUsd: Number((perplexityCost + enCost).toFixed(4)),
          elapsedSec: Number(elapsed),
        },
        results,
      },
      null,
      2,
    )}\n`,
  );

  console.log('');
  console.log(
    `[faq-batch] DONE enriched=${ok.length}/${results.length} ` +
      `cost: perplexity=$${perplexityCost.toFixed(4)} en=$${enCost.toFixed(4)} total=$${(perplexityCost + enCost).toFixed(4)} ` +
      `elapsed=${elapsed}s`,
  );
  console.log(`[faq-batch] runlog → ${logPath}`);
}

main().catch((err: unknown) => {
  console.error('[faq-batch] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
