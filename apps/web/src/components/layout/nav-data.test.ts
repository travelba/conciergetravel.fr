import { describe, expect, it } from 'vitest';

import {
  HOTEL_TYPE_NAV_ENTRIES,
  INTL_DESTINATION_NAV_ENTRIES,
  INTL_NAV_SLUG_TO_ISO,
  NAV_HOTEL_TYPE_TO_AXIS_VALUE,
  intlNavSlugToIso,
  navHotelTypeToAxisValue,
} from './nav-data';

/**
 * Congruence guards — every nav entry must have its mapping. Without
 * these the menu can silently produce a 404'd link the next time a
 * new entry is added without its companion table update.
 *
 * If you add a new `HOTEL_TYPE_NAV_ENTRIES` entry, add the matching
 * `NAV_HOTEL_TYPE_TO_AXIS_VALUE` row.
 * If you add a new `INTL_DESTINATION_NAV_ENTRIES` entry, add the
 * matching `INTL_NAV_SLUG_TO_ISO` row.
 */
describe('nav-data slug mappings', () => {
  it('NAV_HOTEL_TYPE_TO_AXIS_VALUE covers every HOTEL_TYPE_NAV_ENTRIES slug', () => {
    for (const entry of HOTEL_TYPE_NAV_ENTRIES) {
      expect(navHotelTypeToAxisValue(entry.slug)).not.toBeNull();
    }
  });

  it('NAV_HOTEL_TYPE_TO_AXIS_VALUE has no orphan keys (every key is in HOTEL_TYPE_NAV_ENTRIES)', () => {
    const navSlugs = new Set(HOTEL_TYPE_NAV_ENTRIES.map((e) => e.slug));
    for (const key of Object.keys(NAV_HOTEL_TYPE_TO_AXIS_VALUE)) {
      expect(navSlugs.has(key)).toBe(true);
    }
  });

  it('NAV_HOTEL_TYPE_TO_AXIS_VALUE values are valid axes.ts HOTEL_TYPES', () => {
    // Mirror of `HOTEL_TYPES` in
    // `scripts/editorial-pilot/src/rankings/axes.ts`. Kept inline so
    // the test does not depend on the editorial pipeline package.
    const VALID_AXIS_VALUES = new Set([
      'palace',
      '5-etoiles',
      '4-etoiles',
      'boutique-hotel',
      'chateau',
      'chalet',
      'villa',
      'maison-hotes',
      'resort',
      'ecolodge',
      'insolite',
      'all',
    ]);
    for (const v of Object.values(NAV_HOTEL_TYPE_TO_AXIS_VALUE)) {
      expect(VALID_AXIS_VALUES.has(v)).toBe(true);
    }
  });

  it('INTL_NAV_SLUG_TO_ISO covers every INTL_DESTINATION_NAV_ENTRIES slug', () => {
    for (const entry of INTL_DESTINATION_NAV_ENTRIES) {
      expect(intlNavSlugToIso(entry.slug)).not.toBeNull();
    }
  });

  it('INTL_NAV_SLUG_TO_ISO values are 2-letter ISO codes', () => {
    for (const iso of Object.values(INTL_NAV_SLUG_TO_ISO)) {
      expect(iso).toMatch(/^[a-z]{2}$/u);
    }
  });

  it('navHotelTypeToAxisValue returns null for unknown slugs', () => {
    expect(navHotelTypeToAxisValue('zombiecore')).toBeNull();
    expect(navHotelTypeToAxisValue('')).toBeNull();
  });

  it('intlNavSlugToIso returns null for unknown slugs', () => {
    expect(intlNavSlugToIso('atlantis')).toBeNull();
    expect(intlNavSlugToIso('')).toBeNull();
  });
});
