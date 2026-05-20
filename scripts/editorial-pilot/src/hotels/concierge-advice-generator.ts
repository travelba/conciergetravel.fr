/**
 * LLM-driven `hotels.concierge_advice` generator (CDC §2 bloc 16, ADR-0011).
 *
 * Mirrors the architecture of `factual-summary-generator.ts`: ONE LLM
 * call per hotel, 3 layers of validation (JSON parse → Zod → format
 * gate), retry × 3 with corrective suffix.
 *
 * Distinct from the editorial pipeline's Pass-8 humanizer
 * (`scripts/editorial-pilot/src/concierge/run-humanizer.ts`) which
 * operates on a rich BRIEF JSON for guides/rankings. This script
 * targets the 337 hotels that have a Supabase description but are
 * *not* in the editorial pipeline (no BRIEF), and produces the same
 * `concierge_advice` shape from the columns that exist in
 * `public.hotels`.
 *
 * Skill: editorial-pilot, llm-output-robustness, concierge-voice-pipeline.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import type { LlmClient } from '../llm.js';
import type { HotelLlmInput } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = resolve(__dirname, '../../prompts');
const PROMPT_PATH = resolve(PROMPTS_DIR, 'hotel-concierge-advice.md');

export const ADVICE_BODY_MIN_WORDS = 50;
export const ADVICE_BODY_MAX_WORDS = 110;
export const ADVICE_TITLE_MIN_WORDS = 6;
export const ADVICE_TITLE_MAX_WORDS = 16;
export const SENTENCE_MAX_WORDS = 25;
export const MAX_RETRIES = 3;

const TipForEnum = z.enum(['room', 'dining', 'timing', 'access', 'service', 'wellness']);

const LocaleAdviceSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tip_for: TipForEnum,
});

export const ConciergeAdviceOutputSchema = z.object({
  fr: LocaleAdviceSchema,
  en: LocaleAdviceSchema,
});

export type ConciergeAdviceOutput = z.infer<typeof ConciergeAdviceOutputSchema>;

const BANNED_LEXICON = [
  'incroyable',
  'magnifique',
  'sublime',
  'véritable joyau',
  'art de vivre',
  'écrin',
  'cocon',
  'bulle',
  'magique',
] as const;

const BANNED_LEXICON_EN_LOOSE = [
  'unforgettable',
  'magical',
  'sublime',
  'true gem',
  'hidden gem',
] as const;

function countWords(s: string): number {
  // Match the same heuristic used by the editorial linter — split on
  // whitespace runs after stripping punctuation that pads counts.
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

function splitSentences(s: string): string[] {
  // Coarse but adequate for FR/EN: split on `.`, `!`, `?` followed by
  // whitespace or EOL. Keeps the punctuation off the resulting chunks.
  return s
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function gateConciergeAdviceFormat(out: ConciergeAdviceOutput): string | null {
  const failed: string[] = [];

  if (out.fr.tip_for !== out.en.tip_for) {
    failed.push(`fr.tip_for (${out.fr.tip_for}) ≠ en.tip_for (${out.en.tip_for})`);
  }

  const checkLocale = (
    locale: 'fr' | 'en',
    body: string,
    title: string,
    openPattern: RegExp,
    bannedList: readonly string[],
  ): void => {
    const bodyWords = countWords(body);
    if (bodyWords < ADVICE_BODY_MIN_WORDS) {
      failed.push(`${locale}.body too short (${bodyWords} words, min ${ADVICE_BODY_MIN_WORDS})`);
    }
    if (bodyWords > ADVICE_BODY_MAX_WORDS) {
      failed.push(`${locale}.body too long (${bodyWords} words, max ${ADVICE_BODY_MAX_WORDS})`);
    }

    const titleWords = countWords(title);
    if (titleWords < ADVICE_TITLE_MIN_WORDS) {
      failed.push(`${locale}.title too short (${titleWords} words, min ${ADVICE_TITLE_MIN_WORDS})`);
    }
    if (titleWords > ADVICE_TITLE_MAX_WORDS) {
      failed.push(`${locale}.title too long (${titleWords} words, max ${ADVICE_TITLE_MAX_WORDS})`);
    }

    if (!openPattern.test(body.trim())) {
      failed.push(
        `${locale}.body must open with ${locale === 'fr' ? '"Mon conseil :"' : '"My tip:"'}`,
      );
    }

    for (const sentence of splitSentences(body)) {
      const w = countWords(sentence);
      if (w > SENTENCE_MAX_WORDS) {
        failed.push(
          `${locale}.body sentence too long (${w} words > ${SENTENCE_MAX_WORDS}): "${sentence.slice(0, 80)}…"`,
        );
        break;
      }
    }

    const lowered = body.toLowerCase();
    for (const banned of bannedList) {
      if (lowered.includes(banned.toLowerCase())) {
        failed.push(`${locale}.body contains banned lexicon: "${banned}"`);
      }
    }
  };

  checkLocale('fr', out.fr.body, out.fr.title, /^Mon\s+conseil\s*:/u, BANNED_LEXICON);
  checkLocale('en', out.en.body, out.en.title, /^My\s+tip\s*:/u, BANNED_LEXICON_EN_LOOSE);

  // EN must not be a literal translation of FR — first 40 chars
  // shouldn't be identical after stripping accents + lowercasing.
  const stripAccent = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  if (stripAccent(out.fr.body.slice(0, 40)) === stripAccent(out.en.body.slice(0, 40))) {
    failed.push('en.body appears to be a literal translation of fr.body');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class ConciergeAdviceGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{
    readonly raw: string;
    readonly reason: string;
  }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[concierge-advice:${slug}] failed after ${attempts.length} attempts. Last reason: ${
        attempts[attempts.length - 1]?.reason ?? 'unknown'
      }`,
    );
    this.attempts = attempts;
  }
}

let cachedPrompt: string | null = null;
async function loadPrompt(): Promise<string> {
  if (cachedPrompt !== null) return cachedPrompt;
  cachedPrompt = await readFile(PROMPT_PATH, 'utf-8');
  return cachedPrompt;
}

export interface GenerateConciergeAdviceResult {
  readonly output: ConciergeAdviceOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

export async function generateConciergeAdvice(
  client: LlmClient,
  hotel: HotelLlmInput,
): Promise<GenerateConciergeAdviceResult> {
  const systemPrompt = await loadPrompt();
  const userBase = `=== HOTEL ===\n${JSON.stringify(hotel, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const correctiveSuffix =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${attempts[attempts.length - 1]?.raw}\n\nReason: ${attempts[attempts.length - 1]?.reason}\n\nFix the issue strictly. Body must be 50-110 words, sentences ≤ 25 words, all facts grounded in the JSON source.`;

    const result = await client.call({
      systemPrompt,
      userPrompt: `${userBase}${correctiveSuffix}`,
      temperature: 0.5,
      maxOutputTokens: 1200,
      responseFormat: 'json',
    });

    totalInput += result.usage.inputTokens;
    totalOutput += result.usage.outputTokens;

    const raw = result.content.trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      attempts.push({ raw, reason: `JSON parse error: ${(err as Error).message}` });
      continue;
    }

    const zod = ConciergeAdviceOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const formatReason = gateConciergeAdviceFormat(zod.data);
    if (formatReason !== null) {
      attempts.push({ raw, reason: formatReason });
      continue;
    }

    return {
      output: zod.data,
      attempts: attempts.length + 1,
      inputTokens: totalInput,
      outputTokens: totalOutput,
    };
  }

  throw new ConciergeAdviceGenerationError(hotel.slug, attempts);
}
