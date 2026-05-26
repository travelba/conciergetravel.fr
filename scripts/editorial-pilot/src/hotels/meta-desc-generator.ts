/**
 * LLM-driven `meta_desc_{fr,en}` generator with strict format gate.
 *
 * Targets the SEO `meta_desc` column on `public.hotels`. Different
 * audience from `factual_summary` (which targets LLM citation): the
 * meta_desc is what Google shows under the page title in the SERPs,
 * so the optimisation function is click-through rate, not LLM
 * citeability.
 *
 * Same robustness pattern as `factual-summary-generator.ts`: ONE LLM
 * call per hotel, 3 layers of validation (JSON parse → Zod →
 * format gate), retry × 3 with corrective suffix on failure.
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
const PROMPT_PATH = resolve(PROMPTS_DIR, 'hotel-meta-desc.md');

/**
 * 140-170 char band — Google displays meta descriptions up to
 * ~160 chars on desktop / ~120 chars on mobile in 2026. We target
 * the upper end of the desktop range, with a 10-char headroom either
 * side, because retrieving "too long → Google truncates with …" is
 * less bad than "too short → no signal".
 */
export const META_DESC_MIN_CHARS = 140;
export const META_DESC_MAX_CHARS = 170;

export const MAX_RETRIES = 3;

const MetaDescLlmOutputSchema = z.object({
  fr: z
    .string()
    .min(META_DESC_MIN_CHARS, {
      message: `fr too short (must be ≥ ${META_DESC_MIN_CHARS} chars)`,
    })
    .max(META_DESC_MAX_CHARS, {
      message: `fr too long (must be ≤ ${META_DESC_MAX_CHARS} chars)`,
    }),
  en: z
    .string()
    .min(META_DESC_MIN_CHARS, {
      message: `en too short (must be ≥ ${META_DESC_MIN_CHARS} chars)`,
    })
    .max(META_DESC_MAX_CHARS, {
      message: `en too long (must be ≤ ${META_DESC_MAX_CHARS} chars)`,
    }),
});

export type MetaDescOutput = z.infer<typeof MetaDescLlmOutputSchema>;

/**
 * Format gate — runs after Zod length validation. Catches the
 * non-length rules from `hotel-meta-desc.md` "Règles dures":
 *  - no commercial CTA verbs at sentence start
 *  - no banned superlatives (mirrors the editorial-voice ban list)
 *  - must contain ≥ 1 comma, must end with `.`
 *  - EN must not be a literal translation of FR (first 30 chars
 *    after diacritic stripping)
 */
export function gateMetaDescFormat(output: MetaDescOutput): string | null {
  const failed: string[] = [];

  const ctaStartsFr = /^(découvrez|réservez|profitez|bienvenue|venez|laissez-vous)\b/iu;
  const ctaStartsEn = /^(discover|book|enjoy|welcome|come|let yourself)\b/iu;
  if (ctaStartsFr.test(output.fr.trim())) {
    failed.push('FR must not start with a commercial CTA verb');
  }
  if (ctaStartsEn.test(output.en.trim())) {
    failed.push('EN must not start with a commercial CTA verb');
  }

  if (!output.fr.includes(',')) failed.push('FR must contain at least one comma');
  if (!output.en.includes(',')) failed.push('EN must contain at least one comma');

  if (!output.fr.trimEnd().endsWith('.')) failed.push('FR must end with "."');
  if (!output.en.trimEnd().endsWith('.')) failed.push('EN must end with "."');

  const bannedFr = [
    'incroyable',
    'magnifique',
    'sublime',
    'magique',
    'véritable joyau',
    'art de vivre',
    'écrin',
    'cocon',
    'bulle',
  ];
  const bannedEn = ['unforgettable', 'magical', 'breathtaking', 'world-class', 'truly unique'];

  // Word-boundary + case-sensitive match for single words — empirical
  // smoke test 2026-05-26 caught false positives on proper nouns like
  // `Bulle d'Osier` (restaurant name at Le Clos Vauban). Capitalised
  // single-word occurrences in French long-form text are almost always
  // proper nouns; the gate accepts them. Multi-word phrases stay
  // case-insensitive because they're rarely capitalised.
  const matchesBanned = (text: string, word: string): boolean => {
    if (/\s/u.test(word)) {
      return new RegExp(`\\b${escapeRegex(word)}\\b`, 'iu').test(text);
    }
    return new RegExp(`\\b${escapeRegex(word)}\\b`, 'u').test(text);
  };
  const bannedFrHits = bannedFr.filter((w) => matchesBanned(output.fr, w));
  const bannedEnHits = bannedEn.filter((w) => matchesBanned(output.en, w));
  if (bannedFrHits.length > 0) {
    failed.push(`FR banned superlatives detected: ${bannedFrHits.join(', ')}`);
  }
  if (bannedEnHits.length > 0) {
    failed.push(`EN banned superlatives detected: ${bannedEnHits.join(', ')}`);
  }

  // EN must not be a literal translation of FR — compare the first 30
  // chars after stripping diacritics, casing and punctuation.
  const norm = (s: string): string =>
    s
      .slice(0, 30)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[\s,.;:'"`-]/g, '');
  if (norm(output.fr) === norm(output.en) && norm(output.fr).length > 0) {
    failed.push('EN appears to be a literal translation of FR (first 30 chars match)');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class MetaDescGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{
    readonly raw: string;
    readonly reason: string;
  }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[meta-desc:${slug}] failed after ${attempts.length} attempts. Last reason: ${
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

export interface GenerateMetaDescResult {
  readonly output: MetaDescOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export async function generateMetaDesc(
  client: LlmClient,
  hotel: HotelLlmInput,
): Promise<GenerateMetaDescResult> {
  const systemPrompt = await loadPrompt();
  const userBase = `=== HOTEL ===\n${JSON.stringify(hotel, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const correctiveSuffix =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${attempts[attempts.length - 1]?.raw}\nReason: ${attempts[attempts.length - 1]?.reason}\n\nFix the issue and retry. Stay inside the ${META_DESC_MIN_CHARS}-${META_DESC_MAX_CHARS} char envelope.`;

    const result = await client.call({
      systemPrompt,
      userPrompt: `${userBase}${correctiveSuffix}`,
      temperature: 0.4,
      maxOutputTokens: 600,
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

    const zod = MetaDescLlmOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const formatReason = gateMetaDescFormat(zod.data);
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

  throw new MetaDescGenerationError(hotel.slug, attempts);
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
