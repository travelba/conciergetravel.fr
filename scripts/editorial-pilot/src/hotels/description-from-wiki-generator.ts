/**
 * LLM-driven `hotels.description_{fr,en}` generator from
 * Wikidata + Wikipedia source facts (skill: content-enrichment-pipeline).
 *
 * Per Rule 9 of the content-enrichment skill: refuse to write when the
 * source layer cannot produce ≥ 3 anchor facts. Better an absent
 * description than a hallucinated one.
 *
 * Workflow per hotel:
 *  1. Pull facts from Wikidata (if `wikidata_id` set) — single SPARQL
 *  2. Pull Wikipedia summary FR and EN (if URL set or article-name guess)
 *  3. Synthesise FR + EN descriptions via LLM with anti-hallucination prompt
 *  4. Gate the response — anchor_facts ≥ 3, no banned lexicon, word
 *     count in [300, 500]
 *  5. Caller writes to Supabase (the generator does NOT touch the DB —
 *     same separation of concerns as factual-summary-generator.ts).
 *
 * Skill: editorial-pilot, content-enrichment-pipeline, llm-output-robustness.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import type { LlmClient } from '../llm.js';
import { fetchHotelByQid, type WdHotel } from '../enrichment/wikidata.js';
import { fetchSummary, type WpSummary } from '../enrichment/wikipedia.js';
import type { HotelRow } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = resolve(__dirname, '../../prompts');
const PROMPT_PATH = resolve(PROMPTS_DIR, 'hotel-description-from-wiki.md');

/**
 * 200-mot floor (lowered from 300 after pilot 2026-05-20). Wikidata
 * entries for many international luxury hotels carry only basic
 * identity (QID + inception year, no architect / owner / heritage).
 * The LLM honestly tops out around 200-250 words on these and will
 * hallucinate to reach 300 — refused by the gate. Lower the floor +
 * keep the anchor-facts gate strict so we still refuse vacuous prose.
 */
export const DESCRIPTION_MIN_WORDS = 200;
export const DESCRIPTION_MAX_WORDS = 500;
export const MIN_ANCHOR_FACTS = 3;
export const MAX_RETRIES = 2; // wiki sources don't drift; one retry is enough

const LlmOutputSchema = z.object({
  fr: z.string(),
  en: z.string(),
  anchor_facts: z.array(z.string()),
  skip_reason: z.string().optional(),
});

export type LlmOutput = z.infer<typeof LlmOutputSchema>;

// ─── Source collection ──────────────────────────────────────────────

export interface CollectedSources {
  readonly wikidata?: {
    readonly qid: string;
    readonly inception_year?: number;
    readonly architects?: readonly string[];
    readonly owner?: string;
    readonly operator?: string;
    readonly part_of?: string;
    readonly heritage_designations?: readonly string[];
  };
  readonly wikipedia_fr?: {
    readonly url: string;
    readonly extract: string;
  };
  readonly wikipedia_en?: {
    readonly url: string;
    readonly extract: string;
  };
}

export interface CollectSourcesOptions {
  readonly skipWikidata?: boolean;
  readonly skipWikipedia?: boolean;
}

function wdHotelToBlock(wd: WdHotel): NonNullable<CollectedSources['wikidata']> {
  const block: {
    qid: string;
    inception_year?: number;
    architects?: readonly string[];
    owner?: string;
    operator?: string;
    part_of?: string;
    heritage_designations?: readonly string[];
  } = { qid: wd.qid };
  if (wd.inception !== null) block.inception_year = wd.inception.year;
  if (wd.architects.length > 0) block.architects = wd.architects;
  if (wd.owner !== null) block.owner = wd.owner;
  if (wd.operator !== null) block.operator = wd.operator;
  if (wd.partOf !== null) block.part_of = wd.partOf;
  if (wd.heritageDesignations.length > 0) {
    block.heritage_designations = wd.heritageDesignations;
  }
  return block;
}

function urlToWpTitle(url: string): string | null {
  try {
    const u = new URL(url);
    const match = /\/wiki\/(.+)$/u.exec(u.pathname);
    if (match === null || match[1] === undefined) return null;
    return decodeURIComponent(match[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

/**
 * Score how "rich" the collected sources are. 0 = useless,
 * higher = more grounded. Used by the caller to decide whether to
 * spend an LLM call at all.
 */
export function scoreSourceRichness(s: CollectedSources): number {
  let score = 0;
  if (s.wikidata !== undefined) {
    score += 1;
    if (s.wikidata.inception_year !== undefined) score += 1;
    if (s.wikidata.architects !== undefined) score += 1;
    if (s.wikidata.owner !== undefined) score += 1;
    if (s.wikidata.operator !== undefined) score += 1;
    if (s.wikidata.part_of !== undefined) score += 1;
    if (s.wikidata.heritage_designations !== undefined) score += 1;
  }
  if (s.wikipedia_fr !== undefined && s.wikipedia_fr.extract.length >= 200) {
    score += 3;
  } else if (s.wikipedia_fr !== undefined) {
    score += 1;
  }
  if (s.wikipedia_en !== undefined && s.wikipedia_en.extract.length >= 200) {
    score += 3;
  } else if (s.wikipedia_en !== undefined) {
    score += 1;
  }
  return score;
}

export async function collectSourcesForHotel(
  row: HotelRow,
  opts: CollectSourcesOptions = {},
): Promise<CollectedSources> {
  const collected: {
    wikidata?: NonNullable<CollectedSources['wikidata']>;
    wikipedia_fr?: { url: string; extract: string };
    wikipedia_en?: { url: string; extract: string };
  } = {};

  if (opts.skipWikidata !== true && row.wikidata_id !== null) {
    try {
      const wd = await fetchHotelByQid(row.wikidata_id);
      collected.wikidata = wdHotelToBlock(wd);
    } catch (err) {
      // Wikidata lookups occasionally 5xx — tolerate, move on
      console.warn(
        `[enrich:${row.slug}] wikidata fetch failed: ${(err as Error).message.slice(0, 120)}`,
      );
    }
  }

  if (opts.skipWikipedia !== true) {
    const titleFr =
      row.wikipedia_url_fr !== null ? urlToWpTitle(row.wikipedia_url_fr) : null;
    const titleEn =
      row.wikipedia_url_en !== null ? urlToWpTitle(row.wikipedia_url_en) : null;

    if (titleFr !== null) {
      try {
        const fr = await fetchSummary(titleFr, 'fr');
        if (fr !== null && fr.extract.length > 0) {
          collected.wikipedia_fr = { url: fr.url, extract: fr.extract };
        }
      } catch (err) {
        console.warn(
          `[enrich:${row.slug}] wikipedia FR failed: ${(err as Error).message.slice(0, 120)}`,
        );
      }
    }
    if (titleEn !== null) {
      try {
        const en = await fetchSummary(titleEn, 'en');
        if (en !== null && en.extract.length > 0) {
          collected.wikipedia_en = { url: en.url, extract: en.extract };
        }
      } catch (err) {
        console.warn(
          `[enrich:${row.slug}] wikipedia EN failed: ${(err as Error).message.slice(0, 120)}`,
        );
      }
    }
  }

  return collected;
}

// Re-export shape for the runner / tests
export type { WdHotel, WpSummary };

// ─── Generation ──────────────────────────────────────────────────────

export class DescriptionGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{ raw: string; reason: string }>;

  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[description:${slug}] failed after ${attempts.length} attempts. Last reason: ${
        attempts[attempts.length - 1]?.reason ?? 'unknown'
      }`,
    );
    this.attempts = attempts;
  }
}

export interface GenerateDescriptionResult {
  readonly output: LlmOutput;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly skipped: boolean;
}

let cachedPrompt: string | null = null;
async function loadPrompt(): Promise<string> {
  if (cachedPrompt !== null) return cachedPrompt;
  cachedPrompt = await readFile(PROMPT_PATH, 'utf-8');
  return cachedPrompt;
}

function countWords(s: string): number {
  return s
    .replace(/[\u2014\u2013—–]/g, ' ')
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

const BANNED_FR = [
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

const BANNED_EN = ['unforgettable', 'magical', 'sublime', 'true gem', 'hidden gem'] as const;

function gateOutput(out: LlmOutput): string | null {
  if (out.skip_reason !== undefined) return null;

  const failed: string[] = [];

  const frWords = countWords(out.fr);
  const enWords = countWords(out.en);
  if (frWords < DESCRIPTION_MIN_WORDS) {
    failed.push(`fr too short (${frWords} words, min ${DESCRIPTION_MIN_WORDS})`);
  }
  if (frWords > DESCRIPTION_MAX_WORDS) {
    failed.push(`fr too long (${frWords} words, max ${DESCRIPTION_MAX_WORDS})`);
  }
  if (enWords < DESCRIPTION_MIN_WORDS) {
    failed.push(`en too short (${enWords} words, min ${DESCRIPTION_MIN_WORDS})`);
  }
  if (enWords > DESCRIPTION_MAX_WORDS) {
    failed.push(`en too long (${enWords} words, max ${DESCRIPTION_MAX_WORDS})`);
  }
  if (out.anchor_facts.length < MIN_ANCHOR_FACTS) {
    failed.push(
      `anchor_facts.length < ${MIN_ANCHOR_FACTS} (got ${out.anchor_facts.length})`,
    );
  }

  const frLower = out.fr.toLowerCase();
  for (const w of BANNED_FR) {
    if (frLower.includes(w.toLowerCase())) {
      failed.push(`fr contains banned lexicon: "${w}"`);
    }
  }
  const enLower = out.en.toLowerCase();
  for (const w of BANNED_EN) {
    if (enLower.includes(w.toLowerCase())) {
      failed.push(`en contains banned lexicon: "${w}"`);
    }
  }

  // EN must not be a literal translation of FR — first 40 chars guard
  const stripAccent = (s: string): string =>
    s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (
    stripAccent(out.fr.slice(0, 40)) === stripAccent(out.en.slice(0, 40))
  ) {
    failed.push('en starts identically to fr — likely a literal translation');
  }

  return failed.length > 0 ? failed.join(' | ') : null;
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

export interface HotelDescriptionInput {
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string | null;
  readonly district: string | null;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly stars: number | null;
  readonly is_palace: boolean | null;
  readonly source_facts: CollectedSources;
}

export async function generateDescriptionFromWiki(
  client: LlmClient,
  input: HotelDescriptionInput,
): Promise<GenerateDescriptionResult> {
  const systemPrompt = await loadPrompt();
  const userBase = `=== HOTEL ===\n${JSON.stringify(input, null, 2)}`;

  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const correctiveSuffix =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\nPrevious output:\n${attempts[attempts.length - 1]?.raw.slice(0, 400)}\nReason: ${attempts[attempts.length - 1]?.reason}\n\nFix the issue. Stay within 200-500 words per locale. If facts are too thin to reach 200 words honestly, return skip_reason instead of padding.`;

    const result = await client.call({
      systemPrompt,
      userPrompt: `${userBase}${correctiveSuffix}`,
      temperature: 0.3,
      maxOutputTokens: 2500,
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

    const zod = LlmOutputSchema.safeParse(parsed);
    if (!zod.success) {
      const reason = zod.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(' | ');
      attempts.push({ raw, reason });
      continue;
    }

    const gateReason = gateOutput(zod.data);
    if (gateReason !== null) {
      attempts.push({ raw, reason: gateReason });
      continue;
    }

    return {
      output: zod.data,
      attempts: attempts.length + 1,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      skipped: zod.data.skip_reason !== undefined,
    };
  }

  throw new DescriptionGenerationError(input.slug, attempts);
}
