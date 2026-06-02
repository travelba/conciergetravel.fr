import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HotelGroupRow } from '@/server/destinations/cities';

// Mock ONLY the Supabase-backed fetch; keep `citySlug` / `isValidCitySlug`
// (and everything else) as the real implementation so the slug derivation
// under test matches production exactly.
const { listPublishedHotelsForGroupingMock } = vi.hoisted(() => ({
  listPublishedHotelsForGroupingMock: vi.fn<() => Promise<readonly HotelGroupRow[]>>(),
}));

vi.mock('@/server/destinations/cities', async (importActual) => {
  const actual = await importActual<typeof import('@/server/destinations/cities')>();
  return {
    ...actual,
    listPublishedHotelsForGrouping: listPublishedHotelsForGroupingMock,
  };
});

import { getCityDirectory } from './get-city-directory';

function makeRow(overrides: Partial<HotelGroupRow> = {}): HotelGroupRow {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: 'test-hotel',
    slug_en: null,
    name: 'Test Hotel',
    name_en: null,
    city: 'Paris',
    district: null,
    region: 'Île-de-France',
    country_code: 'FR',
    country_label_fr: 'France',
    country_label_en: 'France',
    luxury_tier: null,
    is_palace: false,
    stars: 5,
    priority: 'P1',
    description_fr: null,
    description_en: null,
    hero_image: null,
    amadeus_hotel_id: null,
    latitude: 48.8566,
    longitude: 2.3522,
    ...overrides,
  };
}

describe('getCityDirectory', () => {
  beforeEach(() => {
    listPublishedHotelsForGroupingMock.mockReset();
  });

  it('returns the exhaustive hotel list for a (country, city) pair', async () => {
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({ id: '11111111-1111-1111-1111-111111111111', name: 'Le Meurice', city: 'Paris' }),
      makeRow({ id: '22222222-2222-2222-2222-222222222222', name: 'Ritz Paris', city: 'Paris' }),
    ]);

    const result = await getCityDirectory('france', 'paris', 'fr');
    expect(result).not.toBeNull();
    expect(result?.countryCode).toBe('FR');
    expect(result?.cityName).toBe('Paris');
    expect(result?.totalCount).toBe(2);
    expect(result?.hotels).toHaveLength(2);
  });

  it('scopes by country to resolve homonym city collisions', async () => {
    // Two cities sharing the slug `san-jose` in different countries.
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Hotel Costa Rica',
        city: 'San José',
        country_code: 'CR',
        country_label_fr: 'Costa Rica',
        country_label_en: 'Costa Rica',
        region: null,
      }),
      makeRow({
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Hotel California',
        city: 'San Jose',
        country_code: 'US',
        country_label_fr: 'États-Unis',
        country_label_en: 'United States',
        region: null,
      }),
    ]);

    const crResult = await getCityDirectory('costa-rica', 'san-jose', 'fr');
    expect(crResult?.countryCode).toBe('CR');
    expect(crResult?.totalCount).toBe(1);
    expect(crResult?.hotels[0]?.name).toBe('Hotel Costa Rica');

    const usResult = await getCityDirectory('etats-unis', 'san-jose', 'fr');
    expect(usResult?.countryCode).toBe('US');
    expect(usResult?.totalCount).toBe(1);
    expect(usResult?.hotels[0]?.name).toBe('Hotel California');
  });

  it('returns null for an unknown country slug', async () => {
    listPublishedHotelsForGroupingMock.mockResolvedValue([makeRow()]);
    expect(await getCityDirectory('narnia', 'paris', 'fr')).toBeNull();
  });

  it('returns null when the city has no published hotel in that country', async () => {
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({ city: 'Paris', country_code: 'FR' }),
    ]);
    expect(await getCityDirectory('france', 'lyon', 'fr')).toBeNull();
  });

  it('rejects malformed slugs without hitting the data layer', async () => {
    expect(await getCityDirectory('France', 'paris', 'fr')).toBeNull();
    expect(listPublishedHotelsForGroupingMock).not.toHaveBeenCalled();
  });
});
