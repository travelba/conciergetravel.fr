import { describe, expect, it } from 'vitest';

import { readExternalSourcesProvenance, type HotelDetailRow } from './get-hotel-by-slug';

/**
 * Minimal row stub — every column other than `external_sources` is
 * irrelevant to the reader under test. We forward `undefined` for the
 * fields the schema marks optional (they parse cleanly via `nullish`
 * defaults) and `null` for the strict-nullable ones the runtime sees.
 */
function rowWith(sources: unknown): HotelDetailRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'ritz-paris',
    slug_en: null,
    name: 'Hôtel Ritz Paris',
    name_en: null,
    stars: 5,
    is_palace: true,
    region: 'Île-de-France',
    department: null,
    city: 'Paris',
    district: null,
    address: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    description_fr: null,
    description_en: null,
    factual_summary_fr: null,
    factual_summary_en: null,
    hero_video: null,
    highlights: null,
    amenities: null,
    faq_content: null,
    restaurant_info: null,
    spa_info: null,
    points_of_interest: null,
    transports: null,
    upcoming_events: null,
    policies: null,
    awards: null,
    affiliations: null,
    signature_experiences: null,
    concierge_advice: null,
    featured_reviews: null,
    hero_image: null,
    gallery_images: null,
    long_description_sections: null,
    number_of_rooms: null,
    number_of_suites: null,
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: null,
    meta_desc_en: null,
    booking_mode: 'display_only',
    amadeus_hotel_id: null,
    priority: 'P2',
    google_rating: null,
    google_reviews_count: null,
    google_place_id: null,
    google_reviews: null,
    last_reviews_sync: null,
    phone_e164: null,
    telephone: null,
    price_range: null,
    price_from: null,
    aggregate_rating_value: null,
    aggregate_rating_count: null,
    aggregate_rating_source: null,
    opened_at: null,
    last_renovated_at: null,
    virtual_tour_url: null,
    mice_info: null,
    wikidata_id: null,
    wikipedia_url_fr: null,
    wikipedia_url_en: null,
    tripadvisor_location_id: null,
    booking_com_hotel_id: null,
    expedia_property_id: null,
    hotels_com_hotel_id: null,
    agoda_hotel_id: null,
    official_url: null,
    email_reservations: null,
    commons_category: null,
    external_sameas: null,
    external_sources: sources,
    country_code: 'FR',
    country_label_fr: null,
    country_label_en: null,
    luxury_tier: null,
    is_published: true,
    updated_at: null,
  };
}

const REALISTIC_RITZ_SOURCES = [
  {
    field: 'wikidata_id',
    value: 'Q656054',
    source: 'wikidata',
    confidence: 'high',
    source_url: 'https://www.wikidata.org/wiki/Q656054',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'wikipedia_url_fr',
    value: 'https://fr.wikipedia.org/wiki/Ritz_Paris',
    source: 'wikipedia',
    confidence: 'high',
    source_url: 'https://fr.wikipedia.org/wiki/Ritz_Paris',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'wikipedia_url_en',
    value: 'https://en.wikipedia.org/wiki/H%C3%B4tel_Ritz_Paris',
    source: 'wikipedia',
    confidence: 'high',
    source_url: 'https://en.wikipedia.org/wiki/H%C3%B4tel_Ritz_Paris',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'official_url',
    value: 'https://www.ritzparis.com/',
    source: 'wikidata',
    confidence: 'high',
    source_url: 'https://www.ritzparis.com/',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'tripadvisor_location_id',
    value: '188728',
    source: 'tripadvisor',
    confidence: 'medium',
    source_url: 'https://www.tripadvisor.com/Hotel_Review-d188728.html',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'commons_category',
    value: 'Hôtel Ritz Paris',
    source: 'wikimedia_commons',
    confidence: 'high',
    source_url: 'https://commons.wikimedia.org/wiki/Category:H%C3%B4tel_Ritz_Paris',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'inception_year',
    value: 1898,
    source: 'wikidata',
    confidence: 'high',
    source_url: 'https://www.wikidata.org/wiki/Q656054',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'architects',
    value: ['Charles Mewès', 'Jules Hardouin-Mansart'],
    source: 'wikidata',
    confidence: 'high',
    source_url: 'https://www.wikidata.org/wiki/Q656054',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  {
    field: 'heritage_designations',
    value: ['monument historique classé', 'monument historique inscrit'],
    source: 'wikidata',
    confidence: 'high',
    source_url: 'https://www.wikidata.org/wiki/Q656054',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
  // Social handles MUST be filtered out — they don't belong in the
  // "Sources & vérifications" footer (they live in the site footer
  // alongside contact info).
  {
    field: 'social_handle',
    value: 'https://twitter.com/_RitzParis',
    source: 'twitter',
    confidence: 'high',
    source_url: 'https://twitter.com/_RitzParis',
    collected_at: '2026-05-31T08:32:44.991Z',
  },
];

describe('readExternalSourcesProvenance', () => {
  it('returns null when the column is null', () => {
    expect(readExternalSourcesProvenance(rowWith(null))).toBeNull();
  });

  it('returns null when the column is undefined', () => {
    expect(readExternalSourcesProvenance(rowWith(undefined))).toBeNull();
  });

  it('returns null when the column is an empty array', () => {
    expect(readExternalSourcesProvenance(rowWith([]))).toBeNull();
  });

  it('returns null when only social_handle entries are present', () => {
    const onlySocials = [
      {
        field: 'social_handle',
        value: 'https://twitter.com/x',
        source: 'twitter',
        source_url: 'https://twitter.com/x',
      },
    ];
    expect(readExternalSourcesProvenance(rowWith(onlySocials))).toBeNull();
  });

  it('returns null when the column is not an array (defensive)', () => {
    expect(readExternalSourcesProvenance(rowWith({ field: 'wikidata_id' }))).toBeNull();
    expect(readExternalSourcesProvenance(rowWith('not-an-array'))).toBeNull();
  });

  it('parses the realistic Ritz payload end-to-end', () => {
    const result = readExternalSourcesProvenance(rowWith(REALISTIC_RITZ_SOURCES));
    expect(result).not.toBeNull();
    // References ordering — encyclopaedias first, then commons, then aggregators.
    expect(result?.references.map((r) => r.kind)).toEqual([
      'wikidata',
      'wikipedia_fr',
      'wikipedia_en',
      'commons',
      'official',
      'tripadvisor',
    ]);
    expect(result?.references.find((r) => r.kind === 'wikidata')?.identifier).toBe('Q656054');
    expect(result?.references.find((r) => r.kind === 'tripadvisor')?.identifier).toBe('188728');
    expect(result?.references.find((r) => r.kind === 'wikipedia_fr')?.identifier).toBeNull();
    expect(result?.facts.inceptionYear).toBe(1898);
    expect(result?.facts.architects).toEqual(['Charles Mewès', 'Jules Hardouin-Mansart']);
    expect(result?.facts.heritageDesignations).toEqual([
      'monument historique classé',
      'monument historique inscrit',
    ]);
    expect(result?.collectedAt).toBe('2026-05-31T08:32:44.991Z');
  });

  it('drops malformed entries instead of failing the whole row', () => {
    const mix: unknown[] = [
      { field: 'wikidata_id', source: 'wikidata' }, // missing value + source_url → still parses but no url so no ref
      {
        field: 'wikidata_id',
        value: 'Q656054',
        source: 'wikidata',
        source_url: 'https://www.wikidata.org/wiki/Q656054',
      },
      // Truly malformed entries — dropped silently.
      { field: 42, source: 'wikidata', value: 'Q656054' },
      { random: 'object' },
      null,
      'string-instead-of-object',
      {
        field: 'inception_year',
        value: 1898,
        source: 'wikidata',
      },
    ];
    const result = readExternalSourcesProvenance(rowWith(mix));
    expect(result).not.toBeNull();
    expect(result?.references.map((r) => r.kind)).toEqual(['wikidata']);
    expect(result?.facts.inceptionYear).toBe(1898);
  });

  it('rejects implausible inception years', () => {
    const bad = [
      {
        field: 'wikidata_id',
        value: 'Q1',
        source: 'wikidata',
        source_url: 'https://www.wikidata.org/wiki/Q1',
      },
      { field: 'inception_year', value: 25, source: 'wikidata' },
    ];
    const result = readExternalSourcesProvenance(rowWith(bad));
    expect(result?.facts.inceptionYear).toBeNull();
  });

  it('keeps the most recent collected_at across entries', () => {
    const mixedDates = [
      {
        field: 'wikidata_id',
        value: 'Q1',
        source: 'wikidata',
        source_url: 'https://www.wikidata.org/wiki/Q1',
        collected_at: '2026-01-15T00:00:00Z',
      },
      {
        field: 'tripadvisor_location_id',
        value: '1',
        source: 'tripadvisor',
        source_url: 'https://www.tripadvisor.com/Hotel_Review-d1.html',
        collected_at: '2026-05-31T12:00:00Z',
      },
    ];
    const result = readExternalSourcesProvenance(rowWith(mixedDates));
    expect(result?.collectedAt).toBe('2026-05-31T12:00:00Z');
  });

  it('dedupes references by kind — first entry wins', () => {
    const dupes = [
      {
        field: 'wikidata_id',
        value: 'Q656054',
        source: 'wikidata',
        source_url: 'https://www.wikidata.org/wiki/Q656054',
      },
      {
        field: 'wikidata_id',
        value: 'Q999999',
        source: 'wikidata',
        source_url: 'https://www.wikidata.org/wiki/Q999999',
      },
    ];
    const result = readExternalSourcesProvenance(rowWith(dupes));
    expect(result?.references).toHaveLength(1);
    expect(result?.references[0]?.identifier).toBe('Q656054');
  });
});
