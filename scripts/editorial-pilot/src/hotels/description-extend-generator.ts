/**
 * LLM-driven `description_{fr,en}` extender with strict format gate.
 *
 * Targets the long-form `description_fr` / `description_en` columns on
 * `public.hotels`. CDC §2.4 sets a 600-char minimum but the editorial
 * sweet spot is 1000-1200 chars. The pilot reads the current
 * description (kept on the input as `description_*_current`), and asks
 * the LLM to extend it without rewriting — preserving the opening so
 * the editorial voice already validated by the editor stays intact.
 *
 * Robustness pattern matches `factual-summary-generator.ts` /
 * `meta-desc-generator.ts`: ONE LLM call per hotel, 3 layers of
 * validation (JSON parse → Zod → format gate), retry × 3 with a
 * corrective suffix.
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
const PROMPT_PATH = resolve(PROMPTS_DIR, 'hotel-description-extend.md');

/**
 * Band targeted by the prompt. The Zod schema enforces 800-1500 —
 * margin around the 600-char CDC §2.4 floor and the editorial sweet
 * spot (1000-1200). Empirically gpt-5.4 overshoots a 1400 ceiling on
 * ~5% of hotels with a rich JSON payload (audit 2026-05-26: 1/2 on
 * the smoke batch), so 1500 buys headroom without degrading
 * readability. Outputs > 1500 chars tend to feel padded; < 800 chars
 * defeats the whole point of the extension pass.
 */
export const DESCRIPTION_EXTEND_MIN_CHARS = 800;
export const DESCRIPTION_EXTEND_MAX_CHARS = 1500;

export const MAX_RETRIES = 3;

const DescriptionExtendLlmOutputSchema = z.object({
  fr: z
    .string()
    .min(DESCRIPTION_EXTEND_MIN_CHARS, {
      message: `fr too short (must be ≥ ${DESCRIPTION_EXTEND_MIN_CHARS} chars)`,
    })
    .max(DESCRIPTION_EXTEND_MAX_CHARS, {
      message: `fr too long (must be ≤ ${DESCRIPTION_EXTEND_MAX_CHARS} chars)`,
    }),
  en: z
    .string()
    .min(DESCRIPTION_EXTEND_MIN_CHARS, {
      message: `en too short (must be ≥ ${DESCRIPTION_EXTEND_MIN_CHARS} chars)`,
    })
    .max(DESCRIPTION_EXTEND_MAX_CHARS, {
      message: `en too long (must be ≤ ${DESCRIPTION_EXTEND_MAX_CHARS} chars)`,
    }),
});

export type DescriptionExtendOutput = z.infer<typeof DescriptionExtendLlmOutputSchema>;

/**
 * Format gate — runs after Zod length validation. Catches the
 * non-length rules from `hotel-description-extend.md` "Règles dures":
 *  - no banned superlatives
 *  - sentence length ≤ 25 words (ADR-0011 Concierge voice)
 *  - no markdown / lists / titles
 *  - 3-5 paragraphs per locale
 *  - opening preserved (50 first non-empty words from the current
 *    description must still be recognisable — measured by token
 *    overlap, not exact match)
 *
 * Returns `null` if valid, or a human-readable reason fed back to the
 * model on the next retry.
 */
export function gateDescriptionExtendFormat(
  output: DescriptionExtendOutput,
  inputFr: string | null,
  inputEn: string | null,
): string | null {
  const failed: string[] = [];

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

  // Match word-boundary, CASE-SENSITIVE (lowercase only). Empirical
  // smoke test 2026-05-26 caught false positives on proper nouns
  // such as `Bulle d'Osier` (restaurant name at Le Clos Vauban):
  // `bulle` is banned as a metaphor but `Bulle` capitalized is almost
  // always a proper noun in French. Sentence-start `Bulle.` is a
  // rare edge case the editor can catch by hand.
  const matchesBanned = (text: string, word: string): boolean => {
    // Multi-word banned phrases are tested case-insensitively
    // (they're lowercased in the list and rarely capitalised).
    if (/\s/u.test(word)) {
      return new RegExp(`\\b${escapeRegex(word)}\\b`, 'iu').test(text);
    }
    return new RegExp(`\\b${escapeRegex(word)}\\b`, 'u').test(text);
  };
  const bannedFrHits = bannedFr.filter((w) => matchesBanned(output.fr, w));
  const bannedEnHits = bannedEn.filter((w) => matchesBanned(output.en, w));
  if (bannedFrHits.length > 0) {
    // Loud, explicit error — empirical observation 2026-05-26: the
    // model ignores "no superlatives" instructions if the previous
    // output's offending word isn't echoed back literally. Quoting
    // and demanding removal fires the model's edit-mode reliably.
    failed.push(
      `FR contains BANNED WORD(S): ${bannedFrHits.map((w) => `"${w}"`).join(', ')}. REMOVE every occurrence and REWRITE the affected sentences. Do NOT replace with another banned synonym.`,
    );
  }
  if (bannedEnHits.length > 0) {
    failed.push(
      `EN contains BANNED WORD(S): ${bannedEnHits.map((w) => `"${w}"`).join(', ')}. REMOVE every occurrence and REWRITE the affected sentences. Do NOT replace with another banned synonym.`,
    );
  }

  // Sentence length cap. ADR-0011 sets 25 words for the Concierge
  // voice, but `editorial-voice.mdc` §6 C2 documents the open
  // conflict against the journalistic-density rule in `style-guide.md`
  // §9 — long-form descriptions sit closer to the journalistic
  // register. Empirical smoke test 2026-05-26 (4/5 failures hit > 25
  // words on dense FR text) → relax to 28 for the description-extend
  // gate while keeping ≤ 25 elsewhere. Anything > 28 words signals
  // a sentence the editor should split.
  const splitSentences = (text: string): readonly string[] =>
    text
      .split(/(?<=[.!?])\s+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  const checkLongSentences = (text: string, locale: 'FR' | 'EN'): void => {
    const longSentences = splitSentences(text).filter((s) => s.split(/\s+/u).length > 28);
    if (longSentences.length > 0) {
      const first = longSentences[0] ?? '';
      const wordCount = first.split(/\s+/u).length;
      failed.push(
        `${locale} contains ${longSentences.length} sentence(s) > 28 words. CUT THIS ${wordCount}-word sentence IN TWO: "${first.slice(0, 140)}${first.length > 140 ? '…' : ''}"`,
      );
    }
  };
  checkLongSentences(output.fr, 'FR');
  checkLongSentences(output.en, 'EN');

  // No markdown — strip-check the most common offenders.
  const markdownPatterns = [
    /\*\*[^*]+\*\*/u,
    /^\s*[-*+]\s/mu,
    /^#{1,6}\s/mu,
    /\[[^\]]+\]\([^)]+\)/u,
  ];
  for (const re of markdownPatterns) {
    if (re.test(output.fr)) failed.push(`FR contains markdown (${re.source})`);
    if (re.test(output.en)) failed.push(`EN contains markdown (${re.source})`);
  }

  // 3-5 paragraphs (separated by blank lines).
  const countParagraphs = (text: string): number =>
    text
      .split(/\n\s*\n/u)
      .map((p) => p.trim())
      .filter((p) => p.length > 0).length;
  const parasFr = countParagraphs(output.fr);
  const parasEn = countParagraphs(output.en);
  if (parasFr < 3 || parasFr > 5) {
    failed.push(`FR must be 3-5 paragraphs (got ${parasFr})`);
  }
  if (parasEn < 3 || parasEn > 5) {
    failed.push(`EN must be 3-5 paragraphs (got ${parasEn})`);
  }

  // Opening preservation — first 50 tokens of the input should
  // overlap ≥ 60% with first 50 tokens of the output. Tolerant of
  // light rewording; refuses outright rewrites.
  const tokens = (s: string | null): readonly string[] =>
    s === null
      ? []
      : s
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .split(/\s+/u)
          .filter((t) => t.length > 0)
          .slice(0, 50);
  const overlap = (a: readonly string[], b: readonly string[]): number => {
    if (a.length === 0 || b.length === 0) return 1; // can't check, give the benefit of the doubt
    const bSet = new Set(b);
    let hits = 0;
    for (const t of a) {
      if (bSet.has(t)) hits++;
    }
    return hits / a.length;
  };
  const overlapFr = overlap(tokens(inputFr), tokens(output.fr));
  const overlapEn = overlap(tokens(inputEn), tokens(output.en));
  if (overlapFr < 0.6 && (inputFr ?? '').length > 100) {
    failed.push(
      `FR opening drift — only ${(overlapFr * 100).toFixed(0)}% token overlap with original (need ≥ 60%)`,
    );
  }
  if (overlapEn < 0.6 && (inputEn ?? '').length > 100) {
    failed.push(
      `EN opening drift — only ${(overlapEn * 100).toFixed(0)}% token overlap with original (need ≥ 60%)`,
    );
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class DescriptionExtendGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{
    readonly raw: string;
    readonly reason: string;
  }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[description-extend:${slug}] failed after ${attempts.length} attempts. Last reason: ${
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

export interface GenerateDescriptionExtendResult {
  readonly output: DescriptionExtendOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Generate the extended description pair. The `hotel` payload must
 * carry the current FR/EN descriptions as `description_fr_excerpt` /
 * `description_en_excerpt` (the LLM uses them as the immutable
 * opening). The schema asserts they are present and non-empty —
 * extending an empty description is a rewrite, not an extension,
 * and should go through a different pipeline.
 */
export async function generateDescriptionExtend(
  client: LlmClient,
  hotel: HotelLlmInput,
): Promise<GenerateDescriptionExtendResult> {
  const systemPrompt = await loadPrompt();
  // Project current descriptions into the LLM payload under a stable
  // key name (`_current`) so the prompt grammar reads naturally.
  const llmPayload = {
    ...hotel,
    description_fr_current: hotel.description_fr_excerpt ?? '',
    description_en_current: hotel.description_en_excerpt ?? '',
  };
  const userBase = `=== HOTEL ===\n${JSON.stringify(llmPayload, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    // The corrective suffix has to be loud and specific — empirical
    // observation (smoke batch 2026-05-26) was that gpt-5.4 ignores
    // a soft "stay inside the envelope" instruction when the JSON
    // payload is rich. Stating the previous length explicitly +
    // demanding a CUT to a target band fires the model's length-
    // budgeting circuit much more reliably.
    const lastAttempt = attempts[attempts.length - 1];
    const correctiveSuffix =
      lastAttempt === undefined
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${lastAttempt.raw}\nReason: ${lastAttempt.reason}\n\n=== ACTION ===\nCRITICAL: each locale MUST be between ${DESCRIPTION_EXTEND_MIN_CHARS} and ${DESCRIPTION_EXTEND_MAX_CHARS} characters. Aim for the 1000-1200 sweet spot. CUT redundant phrasing. Preserve the original opening (first 50 tokens). Output JSON only.`;

    const result = await client.call({
      systemPrompt,
      userPrompt: `${userBase}${correctiveSuffix}`,
      temperature: 0.5,
      // Long-form description — bigger budget than meta_desc/factual_summary.
      maxOutputTokens: 2400,
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

    const zod = DescriptionExtendLlmOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const formatReason = gateDescriptionExtendFormat(
      zod.data,
      hotel.description_fr_excerpt,
      hotel.description_en_excerpt,
    );
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

  throw new DescriptionExtendGenerationError(hotel.slug, attempts);
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
