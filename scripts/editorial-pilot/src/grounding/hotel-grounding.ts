/**
 * hotel-grounding.ts — DataForSEO grounding for the HOTEL editorial pipelines.
 *
 * Wraps `groundKeywords` with hotel-specific seed + locale derivation so every
 * hotel generator (factual_summary, meta-desc, highlights, geo_qa, FAQ) anchors
 * its output on the REAL search demand for that property instead of generic
 * heuristics. Catalogue-wide: the locale is derived from `country_code`.
 *
 *   - FR hotels  → grounded in France / fr (our primary audience).
 *   - non-FR     → grounded in the property's country / en (international
 *     traveller demand is overwhelmingly English; the FR copy is mirrored by
 *     the LLM from the same questions).
 *
 * Degrade-safe: returns an empty block when DFS is off/unconfigured (the
 * caller then falls back to the LLM-only prompt).
 *
 * Skill: keyword-grounding-dataforseo.
 */
import type { DataForSeoClientConfig } from '@mch/integrations/dataforseo';

import type { HotelLlmInput } from '../hotels/supabase-hotels.js';

import {
  groundKeywords,
  renderGroundingForPrompt,
  type GroundingLocale,
  type GroundingOptions,
  type KeywordGrounding,
} from './keyword-grounding.js';

/**
 * Map an ISO country_code to a DataForSEO `location_name` + language.
 *
 * CRITICAL — DataForSEO Labs (`related_keywords`) validates the
 * (location_name, language_code) pair against its registry and rejects
 * unsupported combinations with `40501 Invalid Field`. The previous map
 * forced `en` for every non-FR country, which DataForSEO rejects for most
 * non-English locations (Italy/en, Spain/en, … all → 40501), silently
 * yielding zero PAA → `skip_no_paa` for ~160 international hotels. The fix is
 * to ground each country in its **native** language (Italy/it, Greece/el,
 * Hungary/hu return rich PAA) and fall back to France/fr — a universally
 * valid pair that also matches our primary francophone audience — whenever
 * the native pair errors or returns no PAA (see `dfsLocaleCandidates`).
 *
 * English-native locations keep `en`. Countries that DataForSEO Labs does
 * NOT expose at all (Turkey, China — `Invalid Field: 'location_name'`
 * regardless of language) are intentionally left to the France/fr fallback.
 */
const FALLBACK_LOCALE: GroundingLocale = { locationName: 'France', languageCode: 'fr' };

const COUNTRY_DFS_LOCALE: Record<string, GroundingLocale> = {
  FR: { locationName: 'France', languageCode: 'fr' },
  MC: { locationName: 'France', languageCode: 'fr' },
  BL: { locationName: 'France', languageCode: 'fr' },
  RE: { locationName: 'France', languageCode: 'fr' },
  // English-native markets (en is a valid DFS pair here).
  US: { locationName: 'United States', languageCode: 'en' },
  GB: { locationName: 'United Kingdom', languageCode: 'en' },
  IE: { locationName: 'Ireland', languageCode: 'en' },
  AE: { locationName: 'United Arab Emirates', languageCode: 'en' },
  ZA: { locationName: 'South Africa', languageCode: 'en' },
  MU: { locationName: 'Mauritius', languageCode: 'en' },
  MV: { locationName: 'Maldives', languageCode: 'en' },
  SG: { locationName: 'Singapore', languageCode: 'en' },
  HK: { locationName: 'Hong Kong', languageCode: 'en' },
  IN: { locationName: 'India', languageCode: 'en' },
  AU: { locationName: 'Australia', languageCode: 'en' },
  CA: { locationName: 'Canada', languageCode: 'en' },
  // Native-language markets (validated against DFS Labs).
  IT: { locationName: 'Italy', languageCode: 'it' },
  ES: { locationName: 'Spain', languageCode: 'es' },
  PT: { locationName: 'Portugal', languageCode: 'pt' },
  DE: { locationName: 'Germany', languageCode: 'de' },
  AT: { locationName: 'Austria', languageCode: 'de' },
  CH: { locationName: 'Switzerland', languageCode: 'de' },
  BE: { locationName: 'Belgium', languageCode: 'nl' },
  NL: { locationName: 'Netherlands', languageCode: 'nl' },
  GR: { locationName: 'Greece', languageCode: 'el' },
  HR: { locationName: 'Croatia', languageCode: 'hr' },
  HU: { locationName: 'Hungary', languageCode: 'hu' },
  RU: { locationName: 'Russia', languageCode: 'ru' },
  RO: { locationName: 'Romania', languageCode: 'ro' },
  BG: { locationName: 'Bulgaria', languageCode: 'bg' },
  SI: { locationName: 'Slovenia', languageCode: 'sl' },
  EE: { locationName: 'Estonia', languageCode: 'et' },
  LT: { locationName: 'Lithuania', languageCode: 'lt' },
  CZ: { locationName: 'Czech Republic', languageCode: 'cs' },
  NO: { locationName: 'Norway', languageCode: 'nb' },
  JP: { locationName: 'Japan', languageCode: 'ja' },
  TH: { locationName: 'Thailand', languageCode: 'th' },
  ID: { locationName: 'Indonesia', languageCode: 'id' },
  VN: { locationName: 'Vietnam', languageCode: 'vi' },
  MX: { locationName: 'Mexico', languageCode: 'es' },
  BR: { locationName: 'Brazil', languageCode: 'pt' },
  AR: { locationName: 'Argentina', languageCode: 'es' },
};

export function dfsLocaleForHotel(hotel: HotelLlmInput): GroundingLocale {
  const code = (hotel.country_code ?? '').toUpperCase();
  const mapped = COUNTRY_DFS_LOCALE[code];
  if (mapped !== undefined) return mapped;
  return FALLBACK_LOCALE;
}

/**
 * Ordered locale candidates to try for a hotel: the native/primary locale
 * first, then the France/fr fallback. `groundHotel` walks this list and keeps
 * the first locale that yields real PAA, so a country missing from the map or
 * unsupported by DataForSEO Labs (Turkey, China) still grounds on fr.
 */
export function dfsLocaleCandidates(hotel: HotelLlmInput): GroundingLocale[] {
  const primary = dfsLocaleForHotel(hotel);
  const out: GroundingLocale[] = [primary];
  const sameAsFallback =
    primary.locationName === FALLBACK_LOCALE.locationName &&
    primary.languageCode === FALLBACK_LOCALE.languageCode;
  if (!sameAsFallback) out.push(FALLBACK_LOCALE);
  return out;
}

/** Build the search seeds for a hotel cluster in the grounding language. */
export function hotelSeeds(hotel: HotelLlmInput, locale: GroundingLocale): string[] {
  const name = (locale.languageCode === 'en' ? (hotel.name_en ?? hotel.name) : hotel.name).trim();
  const city = (hotel.city ?? '').trim();
  const seeds: string[] = [];
  if (locale.languageCode === 'fr') {
    seeds.push(`hôtel ${name}`);
    if (city.length > 0) seeds.push(`${name} ${city}`);
  } else {
    seeds.push(`${name} hotel`);
    if (city.length > 0) seeds.push(`${name} ${city}`);
  }
  return seeds;
}

export interface HotelGroundingResult {
  readonly grounding: KeywordGrounding;
  /** Ready-to-inject prompt block ('' when not grounded). */
  readonly block: string;
  readonly locale: GroundingLocale;
}

/**
 * Ground a single hotel. Always resolves (never throws): on DFS-off or any
 * vendor failure the result carries `grounding.grounded === false` and an
 * empty `block`.
 *
 * Walks the locale candidates (native → France/fr): the first locale that
 * returns at least one People-Also-Ask question wins. This recovers the
 * ~160 international hotels that the previous `en`-everywhere map left
 * un-grounded (DataForSEO 40501 on non-English locations). If no candidate
 * yields PAA, the last attempt (carrying any related keywords) is returned so
 * the caller can still decide to skip.
 */
export async function groundHotel(
  cfg: DataForSeoClientConfig | null,
  hotel: HotelLlmInput,
  options: GroundingOptions = {},
): Promise<HotelGroundingResult> {
  const candidates = dfsLocaleCandidates(hotel);
  let last: HotelGroundingResult | null = null;
  for (const locale of candidates) {
    const seeds = hotelSeeds(hotel, locale);
    const grounding = await groundKeywords(cfg, seeds, locale, options);
    const result: HotelGroundingResult = {
      grounding,
      block: renderGroundingForPrompt(grounding),
      locale,
    };
    if (grounding.peopleAlsoAsk.length > 0) return result;
    last = result;
    // DFS off (grounded === false) won't improve on a retry — stop early.
    if (!grounding.grounded) break;
  }
  return (
    last ?? {
      grounding: { ...emptyHotelGrounding(candidates[0] ?? FALLBACK_LOCALE) },
      block: '',
      locale: candidates[0] ?? FALLBACK_LOCALE,
    }
  );
}

function emptyHotelGrounding(locale: GroundingLocale): KeywordGrounding {
  return {
    seeds: [],
    locale,
    peopleAlsoAsk: [],
    relatedSearches: [],
    topKeywords: [],
    intents: [],
    fetchedAt: new Date().toISOString(),
    grounded: false,
  };
}
