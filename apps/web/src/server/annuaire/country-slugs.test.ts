import { describe, expect, it } from 'vitest';

import type { HotelGroupRow } from '@/server/destinations/cities';

import {
  buildCountryDirectoryList,
  countrySlug,
  isValidCountrySlug,
  resolveCountryFromRows,
} from './country-slugs';

/**
 * Minimal `HotelGroupRow` factory — only the fields the annuaire country
 * helpers read (`country_code`, `country_label_fr/_en`, `city`) carry
 * meaningful values; the rest are filled with inert defaults.
 */
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

describe('countrySlug', () => {
  it('derives a slug from the FR label (locale-invariant)', () => {
    expect(countrySlug('France', 'France', 'FR')).toBe('france');
    expect(countrySlug('Émirats arabes unis', 'United Arab Emirates', 'AE')).toBe(
      'emirats-arabes-unis',
    );
    expect(countrySlug('États-Unis', 'United States', 'US')).toBe('etats-unis');
  });

  it('falls back to the EN label when the FR label is null', () => {
    expect(countrySlug(null, 'Maldives', 'MV')).toBe('maldives');
  });

  it('falls back to the lowercased ISO code when both labels are null', () => {
    expect(countrySlug(null, null, 'JP')).toBe('jp');
  });
});

describe('isValidCountrySlug', () => {
  it('accepts kebab-case slugs', () => {
    expect(isValidCountrySlug('france')).toBe(true);
    expect(isValidCountrySlug('emirats-arabes-unis')).toBe(true);
  });

  it('rejects malformed slugs', () => {
    expect(isValidCountrySlug('France')).toBe(false);
    expect(isValidCountrySlug('-france')).toBe(false);
    expect(isValidCountrySlug('france/tokyo')).toBe(false);
    expect(isValidCountrySlug('')).toBe(false);
  });
});

describe('resolveCountryFromRows', () => {
  it('resolves a slug to its ISO code + aggregated labels', () => {
    const rows = [
      makeRow({ country_code: 'JP', country_label_fr: 'Japon', country_label_en: 'Japan' }),
      makeRow({ country_code: 'FR', country_label_fr: 'France', country_label_en: 'France' }),
    ];
    const resolved = resolveCountryFromRows(rows, 'japon');
    expect(resolved).not.toBeNull();
    expect(resolved?.code).toBe('JP');
    expect(resolved?.labelFr).toBe('Japon');
  });

  it('returns null for an unknown slug', () => {
    const rows = [makeRow({ country_code: 'FR' })];
    expect(resolveCountryFromRows(rows, 'narnia')).toBeNull();
  });

  it('aggregates inconsistent labels so the slug is canonical (no duplicate URLs)', () => {
    // Real catalogue case: France has rows with a null label AND rows
    // labelled "France". The canonical slug must be `france`, and the
    // bare ISO slug `fr` must NOT resolve (else `/hotels/fr` and
    // `/hotels/france` would both serve the same content).
    const rows = [
      makeRow({ country_code: 'FR', country_label_fr: null, country_label_en: null }),
      makeRow({ country_code: 'FR', country_label_fr: 'France', country_label_en: 'France' }),
    ];
    expect(resolveCountryFromRows(rows, 'france')?.code).toBe('FR');
    expect(resolveCountryFromRows(rows, 'fr')).toBeNull();
  });
});

describe('buildCountryDirectoryList', () => {
  it('aggregates one entry per country, sorted by hotel count desc', () => {
    const rows = [
      makeRow({ country_code: 'FR', country_label_fr: 'France', country_label_en: 'France' }),
      makeRow({ country_code: 'FR', country_label_fr: 'France', country_label_en: 'France' }),
      makeRow({ country_code: 'JP', country_label_fr: 'Japon', country_label_en: 'Japan' }),
    ];
    const list = buildCountryDirectoryList(rows, 'fr');
    expect(list).toHaveLength(2);
    expect(list[0]?.code).toBe('FR');
    expect(list[0]?.hotelCount).toBe(2);
    expect(list[0]?.slug).toBe('france');
    expect(list[0]?.isFrance).toBe(true);
    expect(list[1]?.code).toBe('JP');
    expect(list[1]?.hotelCount).toBe(1);
  });

  it('uses the localized label for the display name', () => {
    const rows = [
      makeRow({ country_code: 'JP', country_label_fr: 'Japon', country_label_en: 'Japan' }),
    ];
    expect(buildCountryDirectoryList(rows, 'en')[0]?.name).toBe('Japan');
    expect(buildCountryDirectoryList(rows, 'fr')[0]?.name).toBe('Japon');
  });

  it('backfills a missing label from a sibling row of the same country', () => {
    const rows = [
      makeRow({ country_code: 'MV', country_label_fr: null, country_label_en: null }),
      makeRow({ country_code: 'MV', country_label_fr: 'Maldives', country_label_en: 'Maldives' }),
    ];
    const list = buildCountryDirectoryList(rows, 'fr');
    expect(list[0]?.slug).toBe('maldives');
  });
});
