import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMO_MEURICE } from '@/lib/demo-data';

const mockCanUseLiveSupabase = vi.fn(() => false);

vi.mock('@/server/lib/live-data', () => ({
  canUseLiveSupabase: () => mockCanUseLiveSupabase(),
  isSkipEnvValidation: vi.fn(() => true),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

const mockFetchHotelDetailV2BySlug = vi.fn();

vi.mock('@mch/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mch/db')>();
  return {
    ...actual,
    fetchHotelDetailV2BySlug: (...args: Parameters<typeof actual.fetchHotelDetailV2BySlug>) =>
      mockFetchHotelDetailV2BySlug(...args),
  };
});

const liveDetailRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  slug: 'le-meurice',
  slug_en: 'le-meurice-paris',
  name: 'Le Meurice',
  name_en: 'Le Meurice',
  city: 'Paris',
  country_code: 'FR',
  stars: 5,
  hero_image: 'cct/hotels/le-meurice/exterior-1',
  rating_score: 9.4,
  rating_count: 1284,
  luxury_tier: 'palace_atout_france',
  price_hint: 890,
  amenities_facet: { has_spa: true, wifi: true },
  description_fr: 'Palace historique sur la rive droite.',
  description_en: 'Historic palace on the Right Bank.',
  factual_summary_fr: null,
  factual_summary_en: null,
  faq_content: null,
  policies: null,
  gallery_images: null,
  concierge_advice: {
    fr: { title: 'Conseil', body: 'Réservez la suite 501 côté Tuileries.' },
  },
  long_description_sections: null,
  meta_desc_fr: null,
  meta_desc_en: null,
  affiliations: null,
  region: 'Île-de-France',
  district: '1er arrondissement',
  address: null,
  latitude: null,
  longitude: null,
  booking_mode: 'display_only' as const,
  updated_at: '2026-07-01T12:00:00+00:00',
};

describe('getHotelV2', () => {
  beforeEach(() => {
    mockCanUseLiveSupabase.mockReturnValue(false);
    mockFetchHotelDetailV2BySlug.mockReset();
  });

  it('returns demo hotel when live data is disabled', async () => {
    const { getHotelV2 } = await import('@/server/hotels/get-hotel-v2');
    const result = await getHotelV2({ slug: 'le-meurice', locale: 'fr' });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.source).toBe('demo');
    expect(result.hotel.slug).toBe(DEMO_MEURICE.slug);
    expect(result.hotel.name).toBe(DEMO_MEURICE.name);
  });

  it('returns null for unknown slug when live data is disabled', async () => {
    const { getHotelV2 } = await import('@/server/hotels/get-hotel-v2');
    const result = await getHotelV2({ slug: 'unknown-hotel-slug', locale: 'fr' });
    expect(result).toBeNull();
  });

  it('maps live read-model row when Supabase is available', async () => {
    mockCanUseLiveSupabase.mockReturnValue(true);
    mockFetchHotelDetailV2BySlug.mockResolvedValue({ ok: true, value: liveDetailRow });

    const { getHotelV2 } = await import('@/server/hotels/get-hotel-v2');
    const result = await getHotelV2({ slug: 'le-meurice', locale: 'fr' });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.source).toBe('live');
    expect(result.hotel.name).toBe('Le Meurice');
    expect(result.hotel.district).toBe('1er arrondissement');
    expect(result.hotel.conciergeAdvice).toContain('suite 501');
    expect(mockFetchHotelDetailV2BySlug).toHaveBeenCalledOnce();
  });
});
