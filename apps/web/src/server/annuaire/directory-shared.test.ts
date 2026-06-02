import { describe, expect, it } from 'vitest';

import type { HotelGroupRow } from '@/server/destinations/cities';

import { toDirectoryHotel, toDirectoryMapPoints } from './directory-shared';

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

describe('toDirectoryHotel — coordinate projection', () => {
  it('projects latitude/longitude into lat/lng', () => {
    const hotel = toDirectoryHotel(makeRow({ latitude: 35.6895, longitude: 139.6917 }), 'fr');
    expect(hotel.lat).toBe(35.6895);
    expect(hotel.lng).toBe(139.6917);
  });

  it('keeps lat/lng null when the row is not geocoded', () => {
    const hotel = toDirectoryHotel(makeRow({ latitude: null, longitude: null }), 'fr');
    expect(hotel.lat).toBeNull();
    expect(hotel.lng).toBeNull();
  });
});

describe('toDirectoryMapPoints', () => {
  it('emits one point per geolocated hotel and resolves the path via the callback', () => {
    const hotels = [
      toDirectoryHotel(makeRow({ id: 'a', slug: 'ritz', latitude: 48.86, longitude: 2.32 }), 'fr'),
      toDirectoryHotel(
        makeRow({ id: 'b', slug: 'meurice', latitude: 48.86, longitude: 2.33 }),
        'fr',
      ),
    ];

    const points = toDirectoryMapPoints(hotels, (slug) => `/fr/hotel/${slug}`);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ id: 'a', url: '/fr/hotel/ritz', lat: 48.86, lng: 2.32 });
    expect(points[1]?.url).toBe('/fr/hotel/meurice');
  });

  it('skips hotels without coordinates (they stay in the indexable list)', () => {
    const hotels = [
      toDirectoryHotel(makeRow({ id: 'a', latitude: 48.86, longitude: 2.32 }), 'fr'),
      toDirectoryHotel(makeRow({ id: 'b', latitude: null, longitude: null }), 'fr'),
      toDirectoryHotel(makeRow({ id: 'c', latitude: 1, longitude: null }), 'fr'),
    ];

    const points = toDirectoryMapPoints(hotels, (slug) => `/fr/hotel/${slug}`);

    expect(points).toHaveLength(1);
    expect(points[0]?.id).toBe('a');
  });
});
