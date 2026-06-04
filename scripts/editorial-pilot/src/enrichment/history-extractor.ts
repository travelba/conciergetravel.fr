/**
 * history-extractor.ts — Tavily-driven extraction of historical & architectural
 * facts (opening year, founder, architect, style, heritage status, narrative).
 *
 * Why it exists: Wikidata / Wikipedia only cover landmark hotels. For the long
 * tail (non-listed international 5★, recent resorts) the `histoire` and
 * `architecture` sections were perpetually skipped by the EEAT gate because no
 * encyclopedic source carried ≥ 2 facts. This extractor falls back to a broad
 * web search (editorial tiers + the hotel's own "about/our story" page),
 * excluding OTA aggregators, then pulls typed facts with the anti-hallucination
 * `llmExtract` contract.
 *
 * Pattern mirrors dining/wellness/services extractors (Rule 5 + Rule 6 of the
 * content-enrichment-pipeline skill).
 */

import { z } from 'zod';
import { tavilySearchAndExtract } from './tavily-client.js';
import { llmExtract } from './llm-extract.js';

// ─── Public types ──────────────────────────────────────────────────────────

export interface HistoryFacts {
  readonly openingYear: number | null;
  /** Founder, first operator, or notable owner literally named. */
  readonly founder: string | null;
  readonly architect: string | null;
  /** e.g. "Belle Époque", "Art Déco", "Haussmannian", "Palladian villa". */
  readonly architecturalStyle: string | null;
  /** e.g. "classé Monument Historique", "UNESCO", "Bâtiment de France". */
  readonly heritageStatus: string | null;
  /** One notable historical fact/anecdote (verbatim, ≤ 200 chars). */
  readonly notableEvent: string | null;
  /** 1-3 sentence factual historical summary (≤ 500 chars). */
  readonly narrative: string | null;
  readonly evidenceQuote: string;
  readonly sourceUrl: string;
}

export interface HistoryExtractionResult {
  readonly history: HistoryFacts | null;
  readonly searchCount: number;
  readonly extractCount: number;
}

// ─── Zod (LLM output) ──────────────────────────────────────────────────────

const HistoryZ = z.object({
  opening_year: z.number().int().min(1000).max(2100).nullable(),
  founder: z.string().nullable(),
  architect: z.string().nullable(),
  architectural_style: z.string().nullable(),
  heritage_status: z.string().nullable(),
  notable_event: z.string().nullable(),
  narrative: z.string().nullable(),
  evidence_quote: z.string().nullable(),
});

const SCHEMA_DESCRIPTION = `
{
  "opening_year": number|null,          // year the hotel opened OR the building was erected — only if explicitly stated
  "founder": string|null,               // founder, first operator, or notable owner (person/company) literally named
  "architect": string|null,             // architect / designer literally named
  "architectural_style": string|null,   // e.g. "Belle Époque", "Art Déco", "Haussmannian", "Palladian villa", "contemporary"
  "heritage_status": string|null,       // e.g. "classé Monument Historique", "UNESCO World Heritage", "Bâtiments de France"
  "notable_event": string|null,         // ONE notable historical fact/anecdote (famous guest, milestone, renovation) — verbatim, max 200 chars
  "narrative": string|null,             // 1-3 sentence factual historical/architectural summary — verbatim or close paraphrase, max 500 chars
  "evidence_quote": string|null         // verbatim sentence(s) backing the strongest fields — max 400 chars
}

CRITICAL RULES:
- Return null for any field NOT explicitly stated in the content. NEVER invent a year, name, style or status.
- Do NOT infer an opening year from "established luxury" or "long tradition" — only a literal year counts.
- Ignore booking/marketing fluff ("book now", "best rates", "unforgettable stay").
- The narrative must be grounded in the content, not a generic luxury description.
`;

// ─── Public API ────────────────────────────────────────────────────────────

export interface HistoryExtractorInput {
  readonly hotelName: string;
  readonly city: string;
  readonly officialDomain: string | null;
}

/** OTA / aggregator domains that carry no reliable history, only rates. */
const OTA_DOMAINS: readonly string[] = [
  'booking.com',
  'tripadvisor.com',
  'tripadvisor.fr',
  'expedia.com',
  'expedia.fr',
  'hotels.com',
  'agoda.com',
  'trip.com',
  'kayak.com',
  'trivago.com',
  'lastminute.com',
];

export async function extractHistory(
  input: HistoryExtractorInput,
): Promise<HistoryExtractionResult> {
  const run = await tavilySearchAndExtract({
    query: `${input.hotelName} ${input.city} histoire fondation ouverture année architecte style architectural patrimoine`,
    extractQuery: `history founding opening year architect architectural style heritage notable events of ${input.hotelName}`,
    searchDepth: 'advanced',
    extractDepth: 'advanced',
    excludeDomains: OTA_DOMAINS,
    maxSearchResults: 8,
    maxExtractUrls: 3,
    chunksPerSource: 4,
    minScore: 0.3,
  });

  const extractCount = run.extracted.length;
  if (extractCount === 0) {
    return { history: null, searchCount: 1, extractCount: 0 };
  }

  let best: HistoryFacts | null = null;
  for (const src of run.extracted) {
    const extracted = await llmExtract({
      content: src.content,
      context: `History & architecture of ${input.hotelName} (${input.city}) — from ${src.url}`,
      schemaDescription: SCHEMA_DESCRIPTION,
      schema: HistoryZ,
    });
    if (!extracted) continue;
    const d = extracted.data;
    const candidate: HistoryFacts = {
      openingYear: d.opening_year,
      founder: trimOrNull(d.founder, 120),
      architect: trimOrNull(d.architect, 120),
      architecturalStyle: trimOrNull(d.architectural_style, 120),
      heritageStatus: trimOrNull(d.heritage_status, 160),
      notableEvent: trimOrNull(d.notable_event, 200),
      narrative: trimOrNull(d.narrative, 500),
      evidenceQuote:
        d.evidence_quote && d.evidence_quote.trim().length > 0
          ? d.evidence_quote.trim().slice(0, 400)
          : '',
      sourceUrl: src.url,
    };
    const score = countSignal(candidate);
    if (score === 0) continue;
    if (!best || score > countSignal(best)) best = candidate;
  }

  return { history: best, searchCount: 1, extractCount };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function trimOrNull(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

function countSignal(h: HistoryFacts): number {
  let n = 0;
  if (h.openingYear !== null) n++;
  if (h.founder) n++;
  if (h.architect) n++;
  if (h.architecturalStyle) n++;
  if (h.heritageStatus) n++;
  if (h.notableEvent) n++;
  if (h.narrative) n++;
  return n;
}
