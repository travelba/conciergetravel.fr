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
 * Map an ISO country_code to a DataForSEO `location_name` + language. The
 * location_name strings are the ones DataForSEO's `/locations` registry
 * expects. Unknown codes fall back to the hotel's English country label (DFS
 * resolves most country names) and English; a missing label falls back to
 * France/fr. A bad location just yields an empty grounding (degrade-safe).
 */
const COUNTRY_DFS_LOCALE: Record<string, GroundingLocale> = {
  FR: { locationName: 'France', languageCode: 'fr' },
  MC: { locationName: 'France', languageCode: 'fr' },
  US: { locationName: 'United States', languageCode: 'en' },
  GB: { locationName: 'United Kingdom', languageCode: 'en' },
  IE: { locationName: 'Ireland', languageCode: 'en' },
  IT: { locationName: 'Italy', languageCode: 'en' },
  ES: { locationName: 'Spain', languageCode: 'en' },
  PT: { locationName: 'Portugal', languageCode: 'en' },
  DE: { locationName: 'Germany', languageCode: 'en' },
  AT: { locationName: 'Austria', languageCode: 'en' },
  CH: { locationName: 'Switzerland', languageCode: 'en' },
  BE: { locationName: 'Belgium', languageCode: 'en' },
  NL: { locationName: 'Netherlands', languageCode: 'en' },
  GR: { locationName: 'Greece', languageCode: 'en' },
  HR: { locationName: 'Croatia', languageCode: 'en' },
  AE: { locationName: 'United Arab Emirates', languageCode: 'en' },
  MA: { locationName: 'Morocco', languageCode: 'en' },
  ZA: { locationName: 'South Africa', languageCode: 'en' },
  MU: { locationName: 'Mauritius', languageCode: 'en' },
  MV: { locationName: 'Maldives', languageCode: 'en' },
  JP: { locationName: 'Japan', languageCode: 'en' },
  TH: { locationName: 'Thailand', languageCode: 'en' },
  ID: { locationName: 'Indonesia', languageCode: 'en' },
  SG: { locationName: 'Singapore', languageCode: 'en' },
  HK: { locationName: 'Hong Kong', languageCode: 'en' },
  CN: { locationName: 'China', languageCode: 'en' },
  IN: { locationName: 'India', languageCode: 'en' },
  MX: { locationName: 'Mexico', languageCode: 'en' },
  BR: { locationName: 'Brazil', languageCode: 'en' },
  AR: { locationName: 'Argentina', languageCode: 'en' },
  CA: { locationName: 'Canada', languageCode: 'en' },
  AU: { locationName: 'Australia', languageCode: 'en' },
  TR: { locationName: 'Turkey', languageCode: 'en' },
};

export function dfsLocaleForHotel(hotel: HotelLlmInput): GroundingLocale {
  const code = (hotel.country_code ?? '').toUpperCase();
  const mapped = COUNTRY_DFS_LOCALE[code];
  if (mapped !== undefined) return mapped;
  if (hotel.country_label_en !== null && hotel.country_label_en.trim().length > 0) {
    return { locationName: hotel.country_label_en.trim(), languageCode: 'en' };
  }
  return { locationName: 'France', languageCode: 'fr' };
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
 */
export async function groundHotel(
  cfg: DataForSeoClientConfig | null,
  hotel: HotelLlmInput,
  options: GroundingOptions = {},
): Promise<HotelGroundingResult> {
  const locale = dfsLocaleForHotel(hotel);
  const seeds = hotelSeeds(hotel, locale);
  const grounding = await groundKeywords(cfg, seeds, locale, options);
  return { grounding, block: renderGroundingForPrompt(grounding), locale };
}
