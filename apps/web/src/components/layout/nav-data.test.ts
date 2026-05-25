import { describe, expect, it } from 'vitest';

import {
  HERO_REGION_NAV_ENTRIES,
  HOTEL_TYPE_NAV_ENTRIES,
  INTL_DESTINATION_NAV_ENTRIES,
  INTL_NAV_SLUG_TO_ISO,
  NAV_HOTEL_TYPE_TO_AXIS_VALUE,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_RANKING_NAV_ENTRIES,
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

/**
 * Slug-shape guards — kebab-case, ASCII-only. The actual existence of
 * each slug in Supabase (e.g. `meilleurs-5-etoiles-paris` must point at
 * a published `editorial_rankings` row) is enforced by the E2E
 * `navigation-routes.spec.ts` Playwright suite, which hits every header
 * link and asserts a 200 + non-`noindex` status. Snapshot of the audit
 * is in `canvases/audit-menu-navigation.canvas.tsx` (2026-05-25).
 */
describe('nav-data slug shape guards', () => {
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

  it('TOP_RANKING_NAV_ENTRIES slugs are kebab-case ASCII', () => {
    for (const entry of TOP_RANKING_NAV_ENTRIES) {
      expect(entry.slug).toMatch(SLUG_RE);
    }
  });

  it('TOP_RANKING_NAV_ENTRIES has 6 entries (mega-menu fixed layout)', () => {
    expect(TOP_RANKING_NAV_ENTRIES).toHaveLength(6);
  });

  it('HERO_REGION_NAV_ENTRIES + TOP_DESTINATION_NAV_ENTRIES slugs are kebab-case ASCII', () => {
    for (const entry of [...HERO_REGION_NAV_ENTRIES, ...TOP_DESTINATION_NAV_ENTRIES]) {
      expect(entry.slug).toMatch(SLUG_RE);
    }
  });

  it('HERO_REGION_NAV_ENTRIES are stable region taxonomy keys (no overlap with TOP_DESTINATION cities except bordeaux)', () => {
    // Bordeaux is intentionally in both lists — it is both a city
    // (catalogue mostly draft) and a wine region (rankings hub).
    const heroSlugs = new Set(HERO_REGION_NAV_ENTRIES.map((e) => e.slug));
    const destSlugs = new Set(TOP_DESTINATION_NAV_ENTRIES.map((e) => e.slug));
    const intersection = [...heroSlugs].filter((s) => destSlugs.has(s));
    expect(intersection).toEqual(['bordeaux']);
  });
});
