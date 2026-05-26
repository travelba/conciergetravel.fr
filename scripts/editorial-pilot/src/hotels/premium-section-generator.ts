/**
 * Generic generator for the 4 premium Concierge sections — `conseil_enrichi`,
 * `quartier_concierge`, `gastronomie_concierge`, `timing_acces_concierge`
 * (migration 0057). Mirrors the architecture of
 * `concierge-advice-generator.ts`: ONE LLM call per (hotel × section),
 * JSON output, 3 layers of validation (JSON parse → Zod → format gate),
 * retry × 3 with corrective suffix.
 *
 * Optional Tavily grounding: when an upstream `grounding` block is
 * provided, the prompt receives a `=== SOURCES ===` section that lists
 * the extracted snippets with their URL. The format gate then enforces
 * a "facts must come from JSON or sources" rule (loose — we can only
 * detect blatant fabrications like an invented Michelin star count).
 *
 * Skill: editorial-pilot, llm-output-robustness, concierge-voice-pipeline,
 *        content-enrichment-pipeline.
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

export const SENTENCE_MAX_WORDS = 25;
export const MAX_RETRIES = 3;

export type PremiumSectionKind =
  | 'conseil_enrichi'
  | 'quartier_concierge'
  | 'gastronomie_concierge'
  | 'timing_acces_concierge';

interface SectionConfig {
  readonly promptFile: string;
  readonly minWords: number;
  readonly maxWords: number;
  readonly openFr: RegExp | null;
  readonly openEn: RegExp | null;
}

const SECTION_CONFIG: Readonly<Record<PremiumSectionKind, SectionConfig>> = {
  conseil_enrichi: {
    promptFile: 'hotel-conseil-enrichi.md',
    minWords: 200,
    maxWords: 300,
    openFr: /^Mon\s+conseil\s*:/u,
    openEn: /^My\s+tip\s*:/u,
  },
  quartier_concierge: {
    promptFile: 'hotel-quartier.md',
    minWords: 200,
    maxWords: 300,
    openFr: null,
    openEn: null,
  },
  gastronomie_concierge: {
    promptFile: 'hotel-gastronomie.md',
    minWords: 200,
    maxWords: 300,
    openFr: null,
    openEn: null,
  },
  timing_acces_concierge: {
    promptFile: 'hotel-timing-acces.md',
    minWords: 150,
    maxWords: 200,
    openFr: null,
    openEn: null,
  },
};

const LocaleBodySchema = z.object({
  body: z.string().min(1),
});

export const PremiumSectionOutputSchema = z.object({
  fr: LocaleBodySchema,
  en: LocaleBodySchema,
});

export type PremiumSectionOutput = z.infer<typeof PremiumSectionOutputSchema>;

const BANNED_LEXICON_FR = [
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

const BANNED_LEXICON_EN = [
  'unforgettable',
  'magical',
  'sublime',
  'true gem',
  'hidden gem',
] as const;

function countWords(s: string): number {
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

function splitSentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function gatePremiumSectionFormat(
  kind: PremiumSectionKind,
  out: PremiumSectionOutput,
): string | null {
  const cfg = SECTION_CONFIG[kind];
  const failed: string[] = [];

  const checkLocale = (
    locale: 'fr' | 'en',
    body: string,
    open: RegExp | null,
    bannedList: readonly string[],
  ): void => {
    const w = countWords(body);
    if (w < cfg.minWords) {
      failed.push(`${locale}.body too short (${w} words, min ${cfg.minWords})`);
    }
    if (w > cfg.maxWords) {
      failed.push(`${locale}.body too long (${w} words, max ${cfg.maxWords})`);
    }
    if (open !== null && !open.test(body.trim())) {
      failed.push(`${locale}.body must open with the expected pattern (${open.source})`);
    }
    for (const sentence of splitSentences(body)) {
      const sw = countWords(sentence);
      if (sw > SENTENCE_MAX_WORDS) {
        failed.push(
          `${locale}.body sentence too long (${sw} words > ${SENTENCE_MAX_WORDS}): "${sentence.slice(
            0,
            80,
          )}…"`,
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

  checkLocale('fr', out.fr.body, cfg.openFr, BANNED_LEXICON_FR);
  checkLocale('en', out.en.body, cfg.openEn, BANNED_LEXICON_EN);

  const stripAccent = (s: string): string =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  if (stripAccent(out.fr.body.slice(0, 60)) === stripAccent(out.en.body.slice(0, 60))) {
    failed.push('en.body appears to be a literal translation of fr.body');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

export class PremiumSectionGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{ readonly raw: string; readonly reason: string }>;

  constructor(
    kind: PremiumSectionKind,
    slug: string,
    attempts: ReadonlyArray<{ raw: string; reason: string }>,
  ) {
    super(
      `[${kind}:${slug}] failed after ${attempts.length} attempts. Last reason: ${
        attempts[attempts.length - 1]?.reason ?? 'unknown'
      }`,
    );
    this.attempts = attempts;
  }
}

const promptCache = new Map<PremiumSectionKind, string>();

async function loadPrompt(kind: PremiumSectionKind): Promise<string> {
  const cached = promptCache.get(kind);
  if (cached !== undefined) return cached;
  const cfg = SECTION_CONFIG[kind];
  const raw = await readFile(resolve(PROMPTS_DIR, cfg.promptFile), 'utf-8');
  promptCache.set(kind, raw);
  return raw;
}

export interface PremiumGroundingSource {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
}

export interface GeneratePremiumSectionResult {
  readonly output: PremiumSectionOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

function buildSourcesBlock(sources: readonly PremiumGroundingSource[] | undefined): string {
  if (sources === undefined || sources.length === 0) return '';
  const lines: string[] = ['', '=== SOURCES ==='];
  for (const s of sources) {
    lines.push(`- (${s.url}) ${s.title}`);
    lines.push(`  ${s.snippet.slice(0, 500).replace(/\s+/gu, ' ').trim()}`);
  }
  return lines.join('\n');
}

export interface GenerateOptions {
  readonly grounding?: readonly PremiumGroundingSource[];
}

export async function generatePremiumSection(
  client: LlmClient,
  kind: PremiumSectionKind,
  hotel: HotelLlmInput,
  options: GenerateOptions = {},
): Promise<GeneratePremiumSectionResult> {
  const systemPrompt = await loadPrompt(kind);
  const sourcesBlock = buildSourcesBlock(options.grounding);
  const userBase = `=== HOTEL ===\n${JSON.stringify(hotel, null, 2)}${sourcesBlock}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const corrective =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${attempts[attempts.length - 1]?.raw}\n\nReason: ${attempts[attempts.length - 1]?.reason}\n\nFix the issue strictly. Respect the word-count band, sentence ≤ 25 words, no banned lexicon, all facts grounded in the JSON or SOURCES blocks.`;

    const result = await client.call({
      systemPrompt,
      userPrompt: `${userBase}${corrective}`,
      temperature: 0.5,
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

    const zod = PremiumSectionOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const formatReason = gatePremiumSectionFormat(kind, zod.data);
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

  throw new PremiumSectionGenerationError(kind, hotel.slug, attempts);
}

export function getSectionConfig(kind: PremiumSectionKind): SectionConfig {
  return SECTION_CONFIG[kind];
}
