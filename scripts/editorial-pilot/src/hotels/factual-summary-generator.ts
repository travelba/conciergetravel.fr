/**
 * LLM-driven `factual_summary_{fr,en}` generator with strict format
 * gate. Runs ONE LLM call per hotel and validates the output against
 * the 110-165 char envelope (see ADR-0011 + CDC §2.3 + the production
 * test `apps/web/src/server/hotels/factual-summary.test.ts`).
 *
 * Public contract:
 *  - `generateFactualSummary(client, hotel)` resolves to a strict
 *    `{ fr, en }` pair OR throws `FactualSummaryGenerationError` after
 *    exhausting all retries.
 *  - `MAX_RETRIES = 3` matches the user-chosen "strict" voice gate
 *    answer (refonte fiche hotel session 2026-05-20).
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
const PROMPT_PATH = resolve(PROMPTS_DIR, 'hotel-factual-summary.md');

/** Envelope matches `isWithinTarget` in `factual-summary.ts` reader. */
export const FACTUAL_SUMMARY_MIN_CHARS = 110;
export const FACTUAL_SUMMARY_MAX_CHARS = 165;

export const MAX_RETRIES = 5;

const FactualSummaryLlmOutputSchema = z.object({
  fr: z
    .string()
    .min(FACTUAL_SUMMARY_MIN_CHARS, {
      message: `fr too short (must be ≥ ${FACTUAL_SUMMARY_MIN_CHARS} chars)`,
    })
    .max(FACTUAL_SUMMARY_MAX_CHARS, {
      message: `fr too long (must be ≤ ${FACTUAL_SUMMARY_MAX_CHARS} chars)`,
    }),
  en: z
    .string()
    .min(FACTUAL_SUMMARY_MIN_CHARS, {
      message: `en too short (must be ≥ ${FACTUAL_SUMMARY_MIN_CHARS} chars)`,
    })
    .max(FACTUAL_SUMMARY_MAX_CHARS, {
      message: `en too long (must be ≤ ${FACTUAL_SUMMARY_MAX_CHARS} chars)`,
    }),
});

export type FactualSummaryOutput = z.infer<typeof FactualSummaryLlmOutputSchema>;

/**
 * Format gate — runs AFTER Zod length validation, checks the
 * non-length rules from `hotel-factual-summary.md` "CHECKLIST"
 * section. Returns `null` if valid, or a human-readable reason that
 * gets fed back to the model in the retry prompt.
 */
export function gateFactualSummaryFormat(output: FactualSummaryOutput): string | null {
  const checks: Array<[string, boolean]> = [
    ['FR must start with "Palace " or "Hôtel "', /^(Palace|Hôtel) /u.test(output.fr)],
    ['EN must start with "Palace " or "Hotel "', /^(Palace|Hotel) /u.test(output.en)],
    ['FR must end with "."', output.fr.trimEnd().endsWith('.')],
    ['EN must end with "."', output.en.trimEnd().endsWith('.')],
    ['FR must contain at least one comma', output.fr.includes(',')],
    ['EN must contain at least one comma', output.en.includes(',')],
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([msg]) => msg);

  const banned = [
    'incroyable',
    'magnifique',
    'sublime',
    'véritable joyau',
    'art de vivre',
    'écrin',
    'cocon',
    'bulle',
    'magique',
  ];
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
  const bannedHits = banned.filter(
    (w) => matchesBanned(output.fr, w) || matchesBanned(output.en, w.replace('é', 'e')),
  );

  if (bannedHits.length > 0) {
    failed.push(`Banned superlatives detected: ${bannedHits.join(', ')}`);
  }

  // EN must not be a literal translation of FR — first 30 chars
  // shouldn't be identical to the FR first 30 chars after stripping
  // accents.
  if (
    output.fr
      .slice(0, 30)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') ===
    output.en
      .slice(0, 30)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
  ) {
    failed.push('EN appears to be a literal translation of FR (first 30 chars match)');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class FactualSummaryGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{
    readonly raw: string;
    readonly reason: string;
  }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[factual-summary:${slug}] failed after ${attempts.length} attempts. Last reason: ${
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

export interface GenerateFactualSummaryResult {
  readonly output: FactualSummaryOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface GenerateFactualSummaryOptions {
  /**
   * Tighter accept band requested on top of the production envelope
   * [110, 165]. When provided, an output that passes Zod + format gate
   * but lands outside this tighter band triggers a retry with a band-
   * specific hint in the corrective prompt. If all retries miss the
   * tighter band, the last in-envelope attempt is accepted (fallback)
   * so the run never throws purely on band misses — partial improvement
   * still beats a hard failure. Use `{ min: 130, max: 150 }` for CDC
   * §2.3 ideal-band tightening passes.
   */
  readonly idealBand?: { readonly min: number; readonly max: number };
}

export async function generateFactualSummary(
  client: LlmClient,
  hotel: HotelLlmInput,
  options: GenerateFactualSummaryOptions = {},
): Promise<GenerateFactualSummaryResult> {
  const systemPrompt = await loadPrompt();
  const userBase = `=== HOTEL ===\n${JSON.stringify(hotel, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;
  let fallback: GenerateFactualSummaryResult | null = null;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const correctiveSuffix =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${attempts[attempts.length - 1]?.raw}\nReason: ${attempts[attempts.length - 1]?.reason}\n\nFix the issue and retry. Stay inside the 110-165 char envelope.${
            options.idealBand !== undefined
              ? ` STRICT TARGET: aim for ${options.idealBand.min}-${options.idealBand.max} chars for FR and EN (CDC §2.3 ideal band).`
              : ''
          }`;

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

    const zod = FactualSummaryLlmOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const formatReason = gateFactualSummaryFormat(zod.data);
    if (formatReason !== null) {
      attempts.push({ raw, reason: formatReason });
      continue;
    }

    // At this point the output passes Zod (production envelope) +
    // format gate. If a tighter idealBand was requested, retry on miss
    // but stash the current attempt as fallback so we don't throw away
    // a valid envelope output just because it missed the ideal band.
    if (options.idealBand !== undefined) {
      const frLen = zod.data.fr.length;
      const enLen = zod.data.en.length;
      const frOff = frLen < options.idealBand.min || frLen > options.idealBand.max;
      const enOff = enLen < options.idealBand.min || enLen > options.idealBand.max;
      if (frOff || enOff) {
        const reason = `fr=${frLen}c en=${enLen}c outside ideal band [${options.idealBand.min}, ${options.idealBand.max}]`;
        attempts.push({ raw, reason });
        // Keep the most recent in-envelope attempt as fallback.
        fallback = {
          output: zod.data,
          attempts: attempts.length,
          inputTokens: totalInput,
          outputTokens: totalOutput,
        };
        continue;
      }
    }

    return {
      output: zod.data,
      attempts: attempts.length + 1,
      inputTokens: totalInput,
      outputTokens: totalOutput,
    };
  }

  // Tight-band miss across all retries — return the best in-envelope
  // attempt instead of failing hard. This keeps tightening passes
  // productive (partial gain) even on stubborn rows.
  if (fallback !== null) {
    return fallback;
  }

  throw new FactualSummaryGenerationError(hotel.slug, attempts);
}

function stripCodeFences(s: string): string {
  // Some models still wrap JSON in ```json fences despite the prompt.
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
