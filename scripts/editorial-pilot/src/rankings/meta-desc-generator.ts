/**
 * LLM-driven `meta_desc_{fr,en}` generator for `editorial_rankings` rows.
 *
 * Targets the SEO meta_desc column on each ranking page. Mirrors the
 * hotel pipeline pattern (`scripts/editorial-pilot/src/hotels/meta-desc-generator.ts`)
 * with three differences:
 *
 *   - Input shape (`RankingLlmInput`) is shaped around the ranking
 *     row (title, kind, scope, intro excerpt, top hotel names).
 *   - Banned-word list is reused verbatim (same Concierge voice).
 *   - The format gate also rejects descs that list named hotels — the
 *     SERP card should tease the ranking, not preview the top.
 *
 * Same robustness pattern: ONE LLM call per ranking, 3 layers of
 * validation (JSON parse → Zod → format gate), retry × 5 with
 * reason-aware corrective suffix.
 *
 * Skill: editorial-pilot, llm-output-robustness, concierge-voice-pipeline.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import type { LlmClient } from '../llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = resolve(__dirname, '../../prompts');
const PROMPT_PATH = resolve(PROMPTS_DIR, 'ranking-meta-desc.md');

export const META_DESC_MIN_CHARS = 140;
export const META_DESC_MAX_CHARS = 170;
export const MAX_RETRIES = 5;

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
 * Shape passed to the LLM for one ranking. Kept narrow on purpose —
 * the prompt should not see the full intro_fr/outro_fr (those are
 * 2000-3500 char chunks that would blow the context window for a 600
 * token output) but enough to calibrate angle and depth.
 */
export interface RankingLlmInput {
  readonly slug: string;
  readonly title_fr: string;
  readonly title_en: string;
  readonly kind: string;
  readonly scope_label: string;
  readonly intro_excerpt_fr: string;
  readonly intro_excerpt_en: string;
  readonly top_hotel_names: readonly string[];
  readonly sections_count: number;
}

/**
 * Format gate — runs after Zod length validation. Catches the
 * non-length rules from `ranking-meta-desc.md` "Règles dures":
 *  - no commercial CTA verbs at sentence start
 *  - no banned superlatives (mirrors editorial-voice ban list)
 *  - must contain ≥ 1 comma, must end with `.`
 *  - EN must not be a literal translation of FR (descriptor segment)
 *  - must not list any of `top_hotel_names` (rankings tease the topic,
 *    not the answer)
 */
export function gateMetaDescFormat(
  output: MetaDescOutput,
  topHotelNames: readonly string[],
): string | null {
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

  // Forbid named hotels in the meta_desc — the SERP card should tease,
  // not preview the ranking content. Case-insensitive substring match
  // because hotel names are proper nouns with capitalisation that does
  // not survive a typo-tolerant model.
  const namedHits = topHotelNames.filter(
    (name) => name.length >= 4 && output.fr.toLowerCase().includes(name.toLowerCase()),
  );
  const namedHitsEn = topHotelNames.filter(
    (name) => name.length >= 4 && output.en.toLowerCase().includes(name.toLowerCase()),
  );
  if (namedHits.length > 0) {
    failed.push(`FR must not name hotels (found: ${namedHits.slice(0, 3).join(', ')})`);
  }
  if (namedHitsEn.length > 0) {
    failed.push(`EN must not name hotels (found: ${namedHitsEn.slice(0, 3).join(', ')})`);
  }

  // EN must not be a literal translation of FR — compare descriptor
  // segment after the first comma (60 chars, diacritic-stripped).
  const descriptor = (s: string): string => {
    const commaIdx = s.indexOf(',');
    const tail = commaIdx === -1 ? s : s.slice(commaIdx + 1);
    return tail
      .slice(0, 60)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[\s,.;:'"`-]/g, '');
  };
  const frDesc = descriptor(output.fr);
  const enDesc = descriptor(output.en);
  if (frDesc.length > 0 && frDesc === enDesc) {
    failed.push('EN appears to be a literal translation of FR (descriptor segment matches)');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class RankingMetaDescError extends Error {
  public readonly attempts: ReadonlyArray<{
    readonly raw: string;
    readonly reason: string;
  }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[ranking-meta-desc:${slug}] failed after ${attempts.length} attempts. Last reason: ${
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

export interface GenerateRankingMetaDescResult {
  readonly output: MetaDescOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export async function generateRankingMetaDesc(
  client: LlmClient,
  ranking: RankingLlmInput,
): Promise<GenerateRankingMetaDescResult> {
  const systemPrompt = await loadPrompt();
  const userBase = `=== RANKING ===\n${JSON.stringify(ranking, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const last = attempts[attempts.length - 1];
    let lengthHint = '';
    if (last) {
      const reason = last.reason;
      if (reason.includes('too short')) {
        lengthHint = `\nThe previous attempt was BELOW ${META_DESC_MIN_CHARS} chars. Add ONE concrete criterion (the selection axis, the scope, the editorial angle). Do NOT pad with vague adjectives.`;
      } else if (reason.includes('too long')) {
        lengthHint = `\nThe previous attempt was ABOVE ${META_DESC_MAX_CHARS} chars. Remove one secondary clause; keep the topic + criterion.`;
      } else if (reason.includes('literal translation')) {
        lengthHint = `\nThe previous EN looked like a literal calque of the FR. Restructure the EN sentence — change clause order, swap synonyms, lead with a different fact. Same content, different shape.`;
      } else if (reason.includes('must not name hotels')) {
        lengthHint = `\nThe previous attempt named one or more hotels. Remove every named hotel — the SERP card should tease the topic, not preview the ranking content.`;
      }
    }
    const correctiveSuffix =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${last?.raw}\nReason: ${last?.reason}\n\nFix the issue and retry. Stay inside the ${META_DESC_MIN_CHARS}-${META_DESC_MAX_CHARS} char envelope.${lengthHint}`;

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

    const formatReason = gateMetaDescFormat(zod.data, ranking.top_hotel_names);
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

  throw new RankingMetaDescError(ranking.slug, attempts);
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
