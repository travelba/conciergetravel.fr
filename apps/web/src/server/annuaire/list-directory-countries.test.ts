import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HotelGroupRow } from '@/server/destinations/cities';

// Mock ONLY the Supabase-backed fetch; keep `citySlug` and the slug
// helpers as the real implementation so the derivation under test
// matches production exactly (same pattern as get-city-directory.test).
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

import { listDirectoryCityPaths } from './list-directory-countries';

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

describe('listDirectoryCityPaths (D3 annuaire gate input)', () => {
  beforeEach(() => {
    listPublishedHotelsForGroupingMock.mockReset();
  });

  it('aggregates the published-hotel count per (country, city) pair', async () => {
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({ id: '11111111-1111-1111-1111-111111111111', city: 'Paris' }),
      makeRow({ id: '22222222-2222-2222-2222-222222222222', city: 'Paris' }),
      makeRow({ id: '33333333-3333-3333-3333-333333333333', city: 'Paris' }),
      makeRow({ id: '44444444-4444-4444-4444-444444444444', city: 'Dommeldange' }),
    ]);

    const paths = await listDirectoryCityPaths();
    const paris = paths.find((p) => p.villeSlug === 'paris');
    const dommeldange = paths.find((p) => p.villeSlug === 'dommeldange');
    expect(paris?.hotelCount).toBe(3);
    expect(dommeldange?.hotelCount).toBe(1);
  });

  it('merges accent variants of the same city into one count (citySlug)', async () => {
    // The exact failure that made the D3 acceptance flag Montréal/Soufrière
    // as thin: naive per-string grouping splits accent variants. The real
    // `citySlug` must merge them.
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({
        id: '11111111-1111-1111-1111-111111111111',
        city: 'Montréal',
        country_code: 'CA',
        country_label_fr: 'Canada',
        country_label_en: 'Canada',
      }),
      makeRow({
        id: '22222222-2222-2222-2222-222222222222',
        city: 'Montreal',
        country_code: 'CA',
        country_label_fr: 'Canada',
        country_label_en: 'Canada',
      }),
      makeRow({
        id: '33333333-3333-3333-3333-333333333333',
        city: 'Montréal',
        country_code: 'CA',
        country_label_fr: 'Canada',
        country_label_en: 'Canada',
      }),
    ]);

    const paths = await listDirectoryCityPaths();
    expect(paths).toHaveLength(1);
    expect(paths[0]?.paysSlug).toBe('canada');
    expect(paths[0]?.villeSlug).toBe('montreal');
    expect(paths[0]?.hotelCount).toBe(3);
  });

  it('keeps homonym cities in different countries as separate counted paths', async () => {
    listPublishedHotelsForGroupingMock.mockResolvedValue([
      makeRow({
        id: '11111111-1111-1111-1111-111111111111',
        city: 'San José',
        country_code: 'CR',
        country_label_fr: 'Costa Rica',
        country_label_en: 'Costa Rica',
      }),
      makeRow({
        id: '22222222-2222-2222-2222-222222222222',
        city: 'San Jose',
        country_code: 'US',
        country_label_fr: 'États-Unis',
        country_label_en: 'United States',
      }),
    ]);

    const paths = await listDirectoryCityPaths();
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p.hotelCount).toBe(1);
  });
});
