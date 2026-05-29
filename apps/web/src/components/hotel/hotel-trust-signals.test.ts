import { describe, expect, it } from 'vitest';

import type { HotelAffiliation } from '@mch/db';

import { buildTrustSignalsSections } from './hotel-trust-signals-helpers';

/**
 * Unit tests for the pure helper that powers `<HotelTrustSignals>`.
 *
 * We do not assert React output here — the helper is the only branch
 * with real logic (filtering, sorting, Palace dedup) and exercising it
 * directly keeps the test free of an `@testing-library/react` setup
 * that this monorepo does not yet ship.
 *
 * Each test mirrors one of the four cases listed in the mission spec
 * (`feat/hotel-affiliations-contract`) so a regression is auditable.
 */

const fixtureBrand = (overrides: Partial<HotelAffiliation> = {}): HotelAffiliation => ({
  kind: 'brand',
  source: 'oetker_collection',
  display_name: 'Oetker Collection',
  verified: true,
  since_year: 2003,
  facet_slug: 'oetker-collection',
  ...overrides,
});

const fixtureLabel = (overrides: Partial<HotelAffiliation> = {}): HotelAffiliation => ({
  kind: 'label',
  source: 'forbes_5_star',
  display_name: 'Forbes Travel Guide Five-Star 2026',
  verified: true,
  since_year: 2026,
  ...overrides,
});

const fixtureRanking = (overrides: Partial<HotelAffiliation> = {}): HotelAffiliation => ({
  kind: 'ranking',
  source: 'world_50_best',
  display_name: "World's 50 Best Hotels 2025",
  verified: true,
  since_year: 2025,
  ...overrides,
});

const fixtureGuide = (overrides: Partial<HotelAffiliation> = {}): HotelAffiliation => ({
  kind: 'guide',
  source: 'tablet_hotels',
  display_name: 'Tablet Hotels',
  verified: true,
  ...overrides,
});

describe('buildTrustSignalsSections', () => {
  it('returns hasAny=false when no affiliations and not a palace', () => {
    const result = buildTrustSignalsSections({ affiliations: [], isPalace: false });
    expect(result.hasAny).toBe(false);
    expect(result.brand).toBeNull();
    expect(result.labels).toHaveLength(0);
    expect(result.rankings).toHaveLength(0);
    expect(result.guides).toHaveLength(0);
  });

  it('synthesises a Palace label when isPalace=true and no affiliation row exists', () => {
    const result = buildTrustSignalsSections({ affiliations: [], isPalace: true });
    expect(result.hasAny).toBe(true);
    expect(result.brand).toBeNull();
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]?.source).toBe('palace_atout_france');
    expect(result.labels[0]?.display_name).toBe('Palace — Atout France');
  });

  it('renders all four buckets when brand + 3 labels + 1 ranking + 1 guide are provided', () => {
    const result = buildTrustSignalsSections({
      affiliations: [
        fixtureBrand(),
        fixtureLabel({
          source: 'forbes_5_star',
          display_name: 'Forbes Five-Star',
          since_year: 2026,
        }),
        fixtureLabel({
          source: 'relais_chateaux',
          display_name: 'Relais & Châteaux',
          since_year: 2018,
        }),
        fixtureLabel({
          source: 'lhw_member',
          display_name: 'Leading Hotels of the World',
          since_year: 2010,
        }),
        fixtureRanking(),
        fixtureGuide(),
      ],
      isPalace: false,
    });
    expect(result.hasAny).toBe(true);
    expect(result.brand?.source).toBe('oetker_collection');
    expect(result.labels).toHaveLength(3);
    expect(result.rankings).toHaveLength(1);
    expect(result.guides).toHaveLength(1);
  });

  it('excludes unverified affiliations defensively (Hard Rule 14)', () => {
    const result = buildTrustSignalsSections({
      affiliations: [
        fixtureBrand({ verified: false }),
        fixtureLabel({ source: 'forbes_5_star', verified: false }),
        fixtureRanking({ verified: true }),
      ],
      isPalace: false,
    });
    expect(result.brand).toBeNull();
    expect(result.labels).toHaveLength(0);
    expect(result.rankings).toHaveLength(1);
  });

  it('does not duplicate the Palace row when isPalace=true AND a palace_atout_france affiliation exists', () => {
    const result = buildTrustSignalsSections({
      affiliations: [
        fixtureLabel({
          source: 'palace_atout_france',
          display_name: 'Palace — Atout France 2026',
          since_year: 2026,
        }),
      ],
      isPalace: true,
    });
    const palaceRows = result.labels.filter((l) => l.source === 'palace_atout_france');
    expect(palaceRows).toHaveLength(1);
    // The real row wins (carries the year) — the synthetic fallback is only
    // inserted when no row already exists.
    expect(palaceRows[0]?.display_name).toBe('Palace — Atout France 2026');
  });

  it('sorts labels by since_year desc, then display_name asc for stability', () => {
    const result = buildTrustSignalsSections({
      affiliations: [
        fixtureLabel({ source: 'lhw_member', display_name: 'Leading Hotels', since_year: 2010 }),
        fixtureLabel({
          source: 'small_luxury',
          display_name: 'Small Luxury Hotels',
          since_year: 2020,
        }),
        fixtureLabel({
          source: 'relais_chateaux',
          display_name: 'Relais & Châteaux',
          since_year: 2020,
        }),
      ],
      isPalace: false,
    });
    expect(result.labels.map((l) => l.source)).toEqual([
      'relais_chateaux', // 2020 — alphabetically before "Small Luxury"
      'small_luxury', // 2020
      'lhw_member', // 2010
    ]);
  });
});
