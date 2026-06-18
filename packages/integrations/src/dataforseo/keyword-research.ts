import { ok, type Result } from '@mch/domain/shared';

import { dfsLive, type DataForSeoClientConfig } from './client';
import type { DataForSeoError } from './errors';
import {
  AdsVolumeItemSchema,
  IntentItemSchema,
  IntentResultSchema,
  LabsItemSchema,
  LabsResultSchema,
  PaaElementSchema,
  SerpElementSchema,
  SerpResultSchema,
  type KeywordIntent,
  type KeywordMetric,
} from './types';

/**
 * DataForSEO endpoint paths (v3). All "live" variants for synchronous
 * editorial grounding (the queued task endpoints would add a poll loop
 * for no benefit at our volume).
 */
const PATHS = {
  relatedKeywords: '/v3/dataforseo_labs/google/related_keywords/live',
  keywordSuggestions: '/v3/dataforseo_labs/google/keyword_suggestions/live',
  searchIntent: '/v3/dataforseo_labs/google/search_intent/live',
  adsSearchVolume: '/v3/keywords_data/google_ads/search_volume/live',
  serpOrganicAdvanced: '/v3/serp/google/organic/live/advanced',
  // AI Optimization (LLM usage) — newer API surface; the exact path is
  // confirmed on the first live run and pinned here. Kept isolated so a
  // path correction is a one-line change.
  aiKeywordSearchVolume: '/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live',
} as const;

export interface KeywordResearchLocale {
  /** Country-only location name, e.g. "France". */
  readonly locationName: string;
  /** Language code, e.g. "fr". */
  readonly languageCode: string;
}

// ---------------------------------------------------------------------------
// Normalisers (tolerant to the two DataForSEO result shapes)
// ---------------------------------------------------------------------------

function nz(v: number | null | undefined): number | null {
  return typeof v === 'number' ? v : null;
}

/** Labs endpoints nest `items[]` under `result[0]`. Per-item parse. */
function normalizeLabsItems(result: readonly unknown[]): KeywordMetric[] {
  const parsed = LabsResultSchema.safeParse(result[0]);
  const items = parsed.success ? (parsed.data.items ?? []) : [];
  const out: KeywordMetric[] = [];
  for (const raw of items) {
    const p = LabsItemSchema.safeParse(raw);
    if (!p.success) continue;
    const it = p.data;
    const kw = it.keyword_data?.keyword ?? it.keyword ?? undefined;
    if (typeof kw !== 'string' || kw.length === 0) continue;
    const info = it.keyword_data?.keyword_info;
    out.push({
      keyword: kw,
      searchVolume: nz(info?.search_volume),
      cpc: nz(info?.cpc),
      competition: nz(info?.competition),
    });
  }
  return out;
}

/** Google Ads search_volume returns the metrics directly in `result[]`. */
function normalizeAdsVolume(result: readonly unknown[]): KeywordMetric[] {
  const out: KeywordMetric[] = [];
  for (const raw of result) {
    const p = AdsVolumeItemSchema.safeParse(raw);
    if (!p.success) continue;
    out.push({
      keyword: p.data.keyword,
      searchVolume: nz(p.data.search_volume),
      cpc: nz(p.data.cpc),
      competition: typeof p.data.competition === 'number' ? p.data.competition : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public primitives — each returns a normalised, Result-typed payload
// ---------------------------------------------------------------------------

/** "Searches related to" keywords for a seed, with volume/CPC/competition. */
export async function fetchRelatedKeywords(
  cfg: DataForSeoClientConfig,
  seed: string,
  locale: KeywordResearchLocale,
  opts?: { readonly depth?: number; readonly limit?: number },
): Promise<Result<readonly KeywordMetric[], DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.relatedKeywords, {
    keyword: seed,
    location_name: locale.locationName,
    language_code: locale.languageCode,
    depth: opts?.depth ?? 1,
    limit: opts?.limit ?? 50,
  });
  if (!res.ok) return res;
  return ok(normalizeLabsItems(res.value));
}

/** Autocomplete-style long-tail suggestions containing the seed. */
export async function fetchKeywordSuggestions(
  cfg: DataForSeoClientConfig,
  seed: string,
  locale: KeywordResearchLocale,
  opts?: { readonly limit?: number },
): Promise<Result<readonly KeywordMetric[], DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.keywordSuggestions, {
    keyword: seed,
    location_name: locale.locationName,
    language_code: locale.languageCode,
    limit: opts?.limit ?? 50,
  });
  if (!res.ok) return res;
  return ok(normalizeLabsItems(res.value));
}

/** Monthly Google Ads search volume for an explicit keyword list. */
export async function fetchSearchVolume(
  cfg: DataForSeoClientConfig,
  keywords: readonly string[],
  locale: KeywordResearchLocale,
): Promise<Result<readonly KeywordMetric[], DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.adsSearchVolume, {
    keywords,
    location_name: locale.locationName,
    language_code: locale.languageCode,
  });
  if (!res.ok) return res;
  return ok(normalizeAdsVolume(res.value));
}

/** Search-intent classification (informational / navigational / …). */
export async function fetchSearchIntent(
  cfg: DataForSeoClientConfig,
  keywords: readonly string[],
  languageCode: string,
): Promise<Result<readonly KeywordIntent[], DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.searchIntent, {
    keywords,
    language_code: languageCode,
  });
  if (!res.ok) return res;
  const parsed = IntentResultSchema.safeParse(res.value[0]);
  const items = parsed.success ? (parsed.data.items ?? []) : [];
  const out: KeywordIntent[] = [];
  for (const raw of items) {
    const p = IntentItemSchema.safeParse(raw);
    if (!p.success) continue;
    out.push({
      keyword: p.data.keyword,
      intent: p.data.keyword_intent?.label ?? null,
      probability: nz(p.data.keyword_intent?.probability),
    });
  }
  return ok(out);
}

export interface SerpQuestions {
  /** "People Also Ask" question titles — gold for FAQ grounding. */
  readonly peopleAlsoAsk: readonly string[];
  /** "Searches related to" phrases — title/H2 phrasing signal. */
  readonly relatedSearches: readonly string[];
}

/** Live SERP scrape, reduced to PAA + related-search phrases. */
export async function fetchSerpQuestions(
  cfg: DataForSeoClientConfig,
  keyword: string,
  locale: KeywordResearchLocale,
  opts?: { readonly paaClickDepth?: number },
): Promise<Result<SerpQuestions, DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.serpOrganicAdvanced, {
    keyword,
    location_name: locale.locationName,
    language_code: locale.languageCode,
    depth: 10,
    people_also_ask_click_depth: opts?.paaClickDepth ?? 2,
  });
  if (!res.ok) return res;
  const parsed = SerpResultSchema.safeParse(res.value[0]);
  const peopleAlsoAsk: string[] = [];
  const relatedSearches: string[] = [];
  if (parsed.success) {
    for (const rawEl of parsed.data.items ?? []) {
      const elp = SerpElementSchema.safeParse(rawEl);
      if (!elp.success) continue;
      const el = elp.data;
      if (el.type === 'people_also_ask') {
        for (const sub of el.items ?? []) {
          const p = PaaElementSchema.safeParse(sub);
          if (p.success && typeof p.data.title === 'string' && p.data.title.length > 0) {
            peopleAlsoAsk.push(p.data.title);
          }
        }
      } else if (el.type === 'related_searches') {
        for (const sub of el.items ?? []) {
          if (typeof sub === 'string' && sub.length > 0) relatedSearches.push(sub);
        }
      }
    }
  }
  return ok({ peopleAlsoAsk, relatedSearches });
}

/**
 * AI Optimization — estimated keyword usage inside LLM answers (the GEO/AEO
 * signal). Same normalisation as Google Ads volume; returns `[]` gracefully
 * if the account lacks the AI Optimization module (parse yields no items).
 */
export async function fetchAiKeywordVolume(
  cfg: DataForSeoClientConfig,
  keywords: readonly string[],
  locale: KeywordResearchLocale,
): Promise<Result<readonly KeywordMetric[], DataForSeoError>> {
  const res = await dfsLive(cfg, PATHS.aiKeywordSearchVolume, {
    keywords,
    location_name: locale.locationName,
    language_code: locale.languageCode,
  });
  if (!res.ok) return res;
  // The AI endpoint mirrors either the Labs (`result[0].items`) or the Ads
  // (`result[]` direct) shape depending on the release — try both.
  const nested = normalizeLabsItems(res.value);
  if (nested.length > 0) return ok(nested);
  return ok(normalizeAdsVolume(res.value));
}

export { PATHS as DATAFORSEO_PATHS };
