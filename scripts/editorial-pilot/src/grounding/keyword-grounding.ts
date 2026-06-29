/**
 * keyword-grounding.ts — cluster-level DataForSEO grounding for the editorial
 * pipelines.
 *
 * Given a small set of seed terms for an entity (a city, a hotel, a place),
 * this pulls the real search demand — People-Also-Ask questions, related
 * searches, related keywords with volume, and search intent — and reduces it
 * to a compact `KeywordGrounding` the LLM prompts consume so FAQ questions,
 * titles/H2 and meta are anchored on what people actually search (SEO) and
 * ask (GEO/AEO), not on generic heuristics.
 *
 * Cost discipline (DataForSEO bills per request):
 * - Disk cache (`data/dfs-cache/`) keyed by seeds+locale; a cluster's shared
 *   seeds (e.g. "hôtel Gordes") are pulled once and reused across every place
 *   in that cluster.
 * - Conservative defaults: 2 SERP + 2 related-keyword calls + 1 intent call
 *   per cluster (≈ 5 billed requests), tunable via opts.
 * - Never throws: any vendor failure (disabled, rate-limit, parse) degrades to
 *   the partial/empty grounding so the editorial run always proceeds.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  fetchRelatedKeywords,
  fetchSearchIntent,
  fetchSerpQuestions,
  type DataForSeoClientConfig,
  type KeywordMetric,
} from '@mch/integrations/dataforseo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CACHE_DIR = resolve(__dirname, '../../data/dfs-cache');

export interface GroundingLocale {
  /** Country-only location name, e.g. "France". */
  readonly locationName: string;
  /** Language code, e.g. "fr". */
  readonly languageCode: string;
}

/**
 * Canonical grounding locales. The disk cache keys on `(languageCode,
 * locationName, seeds)` (see `cacheKey`), so EN and FR grounding for the same
 * entity NEVER collide on disk — they live in separate cache files.
 *
 * ⚠ **EN-target content must ground against an EN-locale PAA, not the FR
 * seed.** A `hotel-de-luxe-{city}` / `meilleurs-hotels-{city}` head serves an
 * `/en` page targeting `luxury hotels {city}` / `best hotels {city}`. Grounding
 * those EN surfaces with the FR seed (`hôtel de luxe {ville}`) in `France/fr`
 * returns **zero People-Also-Ask** for foreign cities (Rome, Los Angeles,
 * Singapore, Hong Kong, Tokyo…) — Google's FR SERP carries no PAA for an
 * English city query — so `dfs_paa_coverage` came back `n/a` and the EN FAQ was
 * never verified against real EN demand. The EN-locale seed in `United
 * States/en` (the largest anglophone market; `United Kingdom/en` is an
 * acceptable alternative) returns the real EN PAA + volumes. `United States/en`
 * is a valid DataForSEO `(location, language)` pair (unlike forcing `en` on a
 * non-English location such as `Italy/en`, which 40501s — see the
 * `keyword-grounding-dataforseo` skill).
 */
export const GROUNDING_LOCALE_FR: GroundingLocale = {
  locationName: 'France',
  languageCode: 'fr',
};
export const GROUNDING_LOCALE_EN_US: GroundingLocale = {
  locationName: 'United States',
  languageCode: 'en',
};
export const GROUNDING_LOCALE_EN_GB: GroundingLocale = {
  locationName: 'United Kingdom',
  languageCode: 'en',
};

/**
 * Build the EN-locale search seeds for a city-scoped editorial head. These are
 * the high-volume anglophone demand patterns confirmed by the 2026-06-29 EN SEO
 * audit (`luxury hotels {city}` > `best hotels in {city}` in both volume and
 * low difficulty). The two seeds feed `groundKeywords` so the EN FAQ/titles
 * track what anglophones actually type, NOT the FR seed. Returns `[]` for an
 * empty city so the caller degrades cleanly.
 */
export function buildEnCitySeeds(cityEn: string): string[] {
  const c = cityEn.replace(/\s+/gu, ' ').trim();
  if (c.length === 0) return [];
  return [`luxury hotels ${c}`, `best hotels in ${c}`];
}

export interface GroundingKeyword {
  readonly keyword: string;
  readonly searchVolume: number | null;
}

export interface GroundingIntent {
  readonly keyword: string;
  readonly intent: string | null;
}

export interface KeywordGrounding {
  readonly seeds: readonly string[];
  readonly locale: GroundingLocale;
  /** "People Also Ask" question titles — FAQ question grounding. */
  readonly peopleAlsoAsk: readonly string[];
  /** "Searches related to" phrases — title/H2 phrasing signal. */
  readonly relatedSearches: readonly string[];
  /** Related keywords ranked by monthly search volume (desc, nulls last). */
  readonly topKeywords: readonly GroundingKeyword[];
  /** Search-intent labels for the top keywords. */
  readonly intents: readonly GroundingIntent[];
  readonly fetchedAt: string;
  /** false when DFS was off/unconfigured (empty grounding — LLM-only fallback). */
  readonly grounded: boolean;
}

export interface GroundingOptions {
  /** Number of seeds to run a live SERP (PAA) scrape on. Default 2. */
  readonly maxSerpSeeds?: number;
  /** Number of seeds to run related-keyword expansion on. Default 2. */
  readonly maxRelatedSeeds?: number;
  /** Related-keyword limit per seed. Default 40. */
  readonly relatedLimit?: number;
  /** How many top keywords to classify by intent. Default 20. */
  readonly intentTopN?: number;
  /** How many top keywords to keep in the grounding. Default 30. */
  readonly keepTopKeywords?: number;
  /** Override the disk cache directory. */
  readonly cacheDir?: string;
  /** Bypass the disk cache (force re-fetch). */
  readonly refresh?: boolean;
}

function emptyGrounding(
  seeds: readonly string[],
  locale: GroundingLocale,
  grounded: boolean,
): KeywordGrounding {
  return {
    seeds,
    locale,
    peopleAlsoAsk: [],
    relatedSearches: [],
    topKeywords: [],
    intents: [],
    fetchedAt: new Date().toISOString(),
    grounded,
  };
}

function cacheKey(seeds: readonly string[], locale: GroundingLocale): string {
  const norm = [...seeds].map((s) => s.toLowerCase().trim()).sort();
  const raw = `${locale.languageCode}|${locale.locationName.toLowerCase()}|${norm.join('||')}`;
  return createHash('sha1').update(raw).digest('hex').slice(0, 24);
}

async function readCache(file: string): Promise<KeywordGrounding | null> {
  try {
    const txt = await readFile(file, 'utf8');
    return JSON.parse(txt) as KeywordGrounding;
  } catch {
    return null;
  }
}

async function writeCache(file: string, g: KeywordGrounding): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(g, null, 2), 'utf8');
  } catch {
    // Cache is best-effort; a write failure must never break a run.
  }
}

function dedupeRankKeywords(items: readonly KeywordMetric[], keep: number): GroundingKeyword[] {
  const map = new Map<string, GroundingKeyword>();
  for (const it of items) {
    const key = it.keyword.toLowerCase().trim();
    if (key.length === 0) continue;
    const existing = map.get(key);
    const vol = it.searchVolume;
    if (existing === undefined || (existing.searchVolume ?? -1) < (vol ?? -1)) {
      map.set(key, { keyword: it.keyword.trim(), searchVolume: vol });
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1))
    .slice(0, keep);
}

function dedupeStrings(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    const key = t.toLowerCase();
    if (t.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Pull and reduce the real search demand for a cluster of seed terms.
 * Cached on disk; degrades to empty grounding on any vendor failure.
 */
export async function groundKeywords(
  cfg: DataForSeoClientConfig | null,
  seeds: readonly string[],
  locale: GroundingLocale,
  options: GroundingOptions = {},
): Promise<KeywordGrounding> {
  const cleanSeeds = dedupeStrings(seeds).slice(0, 6);
  if (cfg === null || cleanSeeds.length === 0) {
    return emptyGrounding(cleanSeeds, locale, false);
  }

  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const file = resolve(cacheDir, `${cacheKey(cleanSeeds, locale)}.json`);
  if (options.refresh !== true) {
    const cached = await readCache(file);
    if (cached !== null) return cached;
  }

  const maxSerpSeeds = options.maxSerpSeeds ?? 2;
  const maxRelatedSeeds = options.maxRelatedSeeds ?? 2;
  const relatedLimit = options.relatedLimit ?? 40;
  const intentTopN = options.intentTopN ?? 20;
  const keepTopKeywords = options.keepTopKeywords ?? 30;

  const paa: string[] = [];
  const relatedSearches: string[] = [];
  const relatedKeywords: KeywordMetric[] = [];

  for (const seed of cleanSeeds.slice(0, maxSerpSeeds)) {
    const res = await fetchSerpQuestions(cfg, seed, locale);
    if (res.ok) {
      paa.push(...res.value.peopleAlsoAsk);
      relatedSearches.push(...res.value.relatedSearches);
    } else {
      console.warn(`[grounding] SERP "${seed}" failed: ${res.error.kind}`);
    }
  }

  for (const seed of cleanSeeds.slice(0, maxRelatedSeeds)) {
    const res = await fetchRelatedKeywords(cfg, seed, locale, { limit: relatedLimit });
    if (res.ok) {
      relatedKeywords.push(...res.value);
    } else {
      console.warn(`[grounding] related "${seed}" failed: ${res.error.kind}`);
    }
  }

  const topKeywords = dedupeRankKeywords(relatedKeywords, keepTopKeywords);

  let intents: GroundingIntent[] = [];
  const intentSeeds = topKeywords.slice(0, intentTopN).map((k) => k.keyword);
  if (intentSeeds.length > 0) {
    const res = await fetchSearchIntent(cfg, intentSeeds, locale.languageCode);
    if (res.ok) {
      intents = res.value.map((i) => ({ keyword: i.keyword, intent: i.intent }));
    } else {
      console.warn(`[grounding] intent failed: ${res.error.kind}`);
    }
  }

  const grounding: KeywordGrounding = {
    seeds: cleanSeeds,
    locale,
    peopleAlsoAsk: dedupeStrings(paa),
    relatedSearches: dedupeStrings(relatedSearches),
    topKeywords,
    intents,
    fetchedAt: new Date().toISOString(),
    grounded: true,
  };

  await writeCache(file, grounding);
  return grounding;
}

/**
 * Render a compact grounding block to inject into an LLM user prompt. Returns
 * an empty string when there is nothing useful (so prompts stay clean when
 * DFS is off). Kept text-light to limit token cost.
 */
export function renderGroundingForPrompt(g: KeywordGrounding): string {
  if (!g.grounded) return '';
  const paa = g.peopleAlsoAsk.slice(0, 12);
  const related = g.relatedSearches.slice(0, 12);
  const kws = g.topKeywords
    .slice(0, 15)
    .map((k) =>
      k.searchVolume !== null ? `${k.keyword} (${String(k.searchVolume)}/mo)` : k.keyword,
    );
  if (paa.length === 0 && related.length === 0 && kws.length === 0) return '';

  const lines: string[] = [
    'DONNÉES DE RECHERCHE RÉELLES (DataForSEO) — ancre la FAQ et les titres dessus :',
  ];
  if (paa.length > 0) {
    lines.push('', 'Questions réellement posées (People Also Ask) — reformule la FAQ autour :');
    lines.push(...paa.map((q) => `- ${q}`));
  }
  if (kws.length > 0) {
    lines.push('', 'Mots-clés à fort volume (utilise ce phrasing dans titres/H2/summary) :');
    lines.push(...kws.map((k) => `- ${k}`));
  }
  if (related.length > 0) {
    lines.push('', 'Recherches associées :');
    lines.push(...related.map((r) => `- ${r}`));
  }
  lines.push(
    '',
    "Règles : ne réponds qu'aux questions pertinentes pour ce lieu/hôtel, ne copie pas un mot-clé hors-sujet, ne fabrique aucun fait pour matcher un mot-clé.",
  );
  return lines.join('\n');
}
