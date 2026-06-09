import { describe, expect, it } from 'vitest';

import { readFactualSummary, type HotelDetailRow } from './get-hotel-by-slug';

/**
 * Minimal row stub — every column other than the factual summary
 * pair is irrelevant to `readFactualSummary`, which is a pure
 * projection of `factual_summary_fr` + `factual_summary_en`.
 */
function rowWith(opts: { fr?: string | null; en?: string | null }): HotelDetailRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'x',
    slug_en: null,
    name: 'X',
    name_en: null,
    stars: 5,
    is_palace: false,
    region: 'R',
    department: null,
    city: 'C',
    district: null,
    address: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    description_fr: null,
    description_en: null,
    factual_summary_fr: opts.fr ?? null,
    factual_summary_en: opts.en ?? null,
    hero_video: null,
    highlights: null,
    amenities: null,
    faq_content: null,
    restaurant_info: null,
    spa_info: null,
    points_of_interest: null,
    transports: null,
    policies: null,
    awards: null,
    signature_experiences: null,
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
    country_code: 'FR',
    country_label_fr: null,
    country_label_en: null,
    luxury_tier: null,
    is_published: true,
    updated_at: null,
  };
}

const CANONICAL_FR =
  'Palace 5 étoiles situé Rive Gauche à Paris, à 5 min de la Tour Eiffel, avec spa Guerlain, table doublement étoilée et roof-top.';
const CANONICAL_EN =
  'Five-star Palace on the Left Bank, five minutes from the Eiffel Tower, featuring a Guerlain spa, a two-Michelin-starred table and a private rooftop.';

describe('readFactualSummary', () => {
  it('returns null when both locale columns are null', () => {
    expect(readFactualSummary(rowWith({}), 'fr')).toBeNull();
    expect(readFactualSummary(rowWith({}), 'en')).toBeNull();
  });

  it('returns null when the column is empty / whitespace-only', () => {
    expect(readFactualSummary(rowWith({ fr: '' }), 'fr')).toBeNull();
    expect(readFactualSummary(rowWith({ fr: '   ' }), 'fr')).toBeNull();
  });

  it('returns the FR text verbatim when locale is fr', () => {
    const result = readFactualSummary(rowWith({ fr: CANONICAL_FR }), 'fr');
    expect(result).not.toBeNull();
    expect(result?.text).toBe(CANONICAL_FR);
  });

  it('returns the EN text when locale is en and EN is set', () => {
    const result = readFactualSummary(rowWith({ fr: CANONICAL_FR, en: CANONICAL_EN }), 'en');
    expect(result?.text).toBe(CANONICAL_EN);
  });

  it('falls back to the FR canonical when EN is empty', () => {
    const result = readFactualSummary(rowWith({ fr: CANONICAL_FR }), 'en');
    expect(result?.text).toBe(CANONICAL_FR);
  });

  it('flags isWithinTarget=true when length is inside the 110-165 char envelope', () => {
    const result = readFactualSummary(rowWith({ fr: CANONICAL_FR }), 'fr');
    expect(result?.isWithinTarget).toBe(true);
  });

  it('flags isWithinTarget=false on too-short summaries (< 110 chars)', () => {
    const short = 'Palace 5 étoiles à Paris.';
    const result = readFactualSummary(rowWith({ fr: short }), 'fr');
    expect(result?.isWithinTarget).toBe(false);
  });

  it('flags isWithinTarget=false on too-long summaries (> 165 chars)', () => {
    const long = `${CANONICAL_FR} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;
    const result = readFactualSummary(rowWith({ fr: long }), 'fr');
    expect(result?.text.length).toBeGreaterThan(165);
    expect(result?.isWithinTarget).toBe(false);
  });

  it('trims surrounding whitespace before measuring', () => {
    const padded = `   ${CANONICAL_FR}   `;
    const result = readFactualSummary(rowWith({ fr: padded }), 'fr');
    expect(result?.text).toBe(CANONICAL_FR);
    expect(result?.isWithinTarget).toBe(true);
  });
});
