import { describe, expect, it } from 'vitest';

import { HotelCardV2Schema, parseHotelCardV2 } from './hotel-card-v2';

const validCard = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  slug: 'le-meurice',
  slug_en: 'le-meurice-paris',
  name: 'Le Meurice',
  name_en: 'Le Meurice',
  city: 'Paris',
  country_code: 'FR',
  stars: 5,
  hero_image: 'cct/hotels/le-meurice/exterior-1',
  rating_score: 9.2,
  rating_count: 847,
  luxury_tier: 'palace_atout_france',
  price_hint: 890,
  amenities_facet: {
    has_spa: true,
    has_pool: false,
    wifi: true,
  },
};

describe('HotelCardV2Schema', () => {
  it('accepts a valid hotel card row', () => {
    const parsed = HotelCardV2Schema.safeParse(validCard);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe('le-meurice');
      expect(parsed.data.amenities_facet.has_spa).toBe(true);
    }
  });

  it('accepts null optional media and rating fields', () => {
    const parsed = HotelCardV2Schema.safeParse({
      ...validCard,
      slug_en: null,
      name_en: null,
      hero_image: null,
      rating_score: null,
      rating_count: null,
      luxury_tier: null,
      price_hint: null,
      amenities_facet: {},
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid slug shape', () => {
    const parsed = HotelCardV2Schema.safeParse({
      ...validCard,
      slug: 'Le Meurice',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid country_code', () => {
    const parsed = HotelCardV2Schema.safeParse({
      ...validCard,
      country_code: 'France',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown keys inside amenities_facet', () => {
    const parsed = HotelCardV2Schema.safeParse({
      ...validCard,
      amenities_facet: { has_spa: true, unknown_flag: true },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('parseHotelCardV2', () => {
  it('returns ok for a valid payload', () => {
    const result = parseHotelCardV2(validCard);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Le Meurice');
    }
  });

  it('returns parse_error for malformed payload', () => {
    const result = parseHotelCardV2({ slug: 'bad slug' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('parse_error');
    }
  });
});
