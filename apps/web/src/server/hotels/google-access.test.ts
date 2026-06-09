import { describe, expect, it } from 'vitest';

import {
  buildGoogleMapsPlaceUrl,
  readGoogleAccess,
  readGoogleReviews,
  type HotelDetailRow,
} from './get-hotel-by-slug';

function minimalRow(overrides: Partial<HotelDetailRow> = {}): HotelDetailRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'test-hotel',
    slug_en: null,
    name: 'Test Hotel',
    name_en: null,
    stars: 5,
    is_palace: false,
    region: 'Provence',
    department: null,
    city: 'Gordes',
    district: null,
    address: '1 Rue Test',
    postal_code: '84220',
    latitude: 43.9,
    longitude: 5.2,
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
    concierge_pick: null,
    concierge_hook: null,
    geo_qa: null,
    instagram: null,
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
    google_rating: 4.7,
    google_reviews_count: 120,
    google_place_id: 'ChIJwT579_X_pBIRwN_8_Wh_DaM',
    google_reviews: [
      {
        author: 'Marie L.',
        rating: 5,
        text: 'Un séjour parfait.',
        publish_time: '2026-01-10T12:00:00Z',
        language: 'fr',
      },
    ],
    last_reviews_sync: '2026-06-09T00:00:00.000Z',
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
    official_url: 'https://airelles.com/fr/destination/gordes-hotel',
    email_reservations: null,
    commons_category: null,
    external_sameas: null,
    external_sources: null,
    country_code: 'FR',
    country_label_fr: null,
    country_label_en: null,
    luxury_tier: null,
    is_published: true,
    updated_at: null,
    ...overrides,
  };
}

describe('buildGoogleMapsPlaceUrl', () => {
  it('builds the canonical query_place_id deep link', () => {
    const url = buildGoogleMapsPlaceUrl('ChIJwT579_X_pBIRwN_8_Wh_DaM');
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=Google&query_place_id=ChIJwT579_X_pBIRwN_8_Wh_DaM',
    );
  });

  it('strips a places/ resource prefix when present', () => {
    const url = buildGoogleMapsPlaceUrl('places/ChIJabc123');
    expect(url).toContain('query_place_id=ChIJabc123');
  });
});

describe('readGoogleAccess', () => {
  it('prefers google_place_id over legacy cid', () => {
    const access = readGoogleAccess(
      minimalRow({
        external_sameas: { google_maps_cid: '999888777' },
      }),
    );
    expect(access.officialUrl).toBe('https://airelles.com/fr/destination/gordes-hotel');
    expect(access.googleMapsUrl).toContain('query_place_id=ChIJwT579_X_pBIRwN_8_Wh_DaM');
  });

  it('falls back to cid when place id is missing', () => {
    const access = readGoogleAccess(
      minimalRow({
        google_place_id: null,
        external_sameas: { google_maps_cid: '1234567890123' },
      }),
    );
    expect(access.googleMapsUrl).toBe('https://maps.google.com/?cid=1234567890123');
  });
});

describe('readGoogleReviews', () => {
  it('parses stored jsonb reviews', () => {
    const reviews = readGoogleReviews(minimalRow(), 'fr');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.author).toBe('Marie L.');
    expect(reviews[0]?.rating).toBe(5);
    expect(reviews[0]?.text).toContain('séjour');
    expect(reviews[0]?.publishTime).toBe('2026-01-10T12:00:00Z');
  });

  it('drops invalid entries', () => {
    const reviews = readGoogleReviews(
      minimalRow({
        google_reviews: [{ author: '', rating: 6, text: 'x' }],
      }),
      'en',
    );
    expect(reviews).toHaveLength(0);
  });
});
