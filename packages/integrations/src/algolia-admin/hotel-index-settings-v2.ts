/**
 * Algolia index settings for v2 Booking-like SRP facets.
 * Index name convention: `{prefix}hotels_v2_{locale}`.
 */
export const DEFAULT_HOTELS_V2_INDEX_SETTINGS = {
  searchableAttributes: [
    'unordered(name)',
    'unordered(name_en)',
    'unordered(city)',
    'unordered(district)',
    'unordered(country)',
    'unordered(region)',
    'unordered(landmarks)',
    'unordered(highlights)',
    'unordered(description_excerpt)',
  ],
  attributesForFaceting: [
    'filterOnly(country_code)',
    'searchable(country)',
    'searchable(region)',
    'searchable(city)',
    'searchable(district)',
    'stars',
    'luxury_tier',
    'is_palace',
    'rating_bucket',
    'price_bucket',
    'amenities.has_spa',
    'amenities.has_pool',
    'amenities.has_restaurant',
    'amenities.has_gym',
    'amenities.wifi',
    'amenities.parking',
    'amenities.pet_friendly',
    'searchable(themes)',
    'searchable(brands)',
    'searchable(labels)',
    'booking_mode',
    'is_little_catalog',
    'priority',
  ],
  customRanking: [
    'desc(priority_score)',
    'desc(rating_score)',
    'desc(rating_count)',
    'asc(price_hint)',
  ],
  ranking: ['typo', 'geo', 'words', 'filters', 'proximity', 'attribute', 'exact', 'custom'],
  attributesToRetrieve: [
    'objectID',
    'slug',
    'slug_en',
    'name',
    'name_en',
    'city',
    'country',
    'country_code',
    'district',
    'stars',
    'hero_image',
    'rating_score',
    'rating_count',
    'luxury_tier',
    'price_hint',
    'highlights',
    'editorial_badge',
    'amenities',
    'geo',
  ],
  attributesToHighlight: ['name', 'city', 'district', 'highlights'],
  hitsPerPage: 20,
  maxValuesPerFacet: 50,
  distinct: true,
  attributeForDistinct: 'slug',
} as const;

export type HotelsV2IndexSettings = typeof DEFAULT_HOTELS_V2_INDEX_SETTINGS;

export function hotelsV2IndexName(prefix: string, locale: 'fr' | 'en'): string {
  return `${prefix}hotels_v2_${locale}`;
}
