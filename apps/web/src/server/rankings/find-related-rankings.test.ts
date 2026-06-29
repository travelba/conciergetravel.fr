import { describe, expect, it } from 'vitest';

import {
  type CurrentRankingSignals,
  type RankingIndexEntry,
  geoHeadKind,
  scoreCandidate,
} from './find-related-rankings';

function makeEntry(overrides: Partial<RankingIndexEntry> & { slug: string }): RankingIndexEntry {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    slug: overrides.slug,
    titleFr: overrides.titleFr ?? overrides.slug,
    titleEn: overrides.titleEn ?? null,
    factualSummaryFr: null,
    factualSummaryEn: null,
    kind: overrides.kind ?? 'geographic',
    lieuSlug: overrides.lieuSlug ?? null,
    themes: overrides.themes ?? [],
    types: overrides.types ?? ['all'],
    family: overrides.family ?? null,
  };
}

describe('geoHeadKind', () => {
  it('classifies the two geographic head prefixes', () => {
    expect(geoHeadKind('hotel-de-luxe-nice')).toBe('luxe');
    expect(geoHeadKind('meilleurs-hotels-nice')).toBe('meilleurs');
  });

  it('returns null for non-head slugs', () => {
    expect(geoHeadKind('classement-worlds-50-best-2025')).toBeNull();
    expect(geoHeadKind('top-aman-hotels-monde')).toBeNull();
  });
});

describe('scoreCandidate — anti-cannibalization reciprocal pin', () => {
  const luxeHead: CurrentRankingSignals = {
    slug: 'hotel-de-luxe-nice',
    lieuSlug: 'nice',
    themes: [],
    types: ['all'],
    family: null,
    kind: 'geographic',
  };
  const meilleursHead: CurrentRankingSignals = {
    slug: 'meilleurs-hotels-nice',
    lieuSlug: 'nice',
    themes: [],
    types: ['all'],
    family: 'geo-best',
    kind: 'geographic',
  };

  it('pins the pure complementary head with the +10 reciprocal boost (both ways)', () => {
    const meilleursCand = makeEntry({
      slug: 'meilleurs-hotels-nice',
      lieuSlug: 'nice',
      themes: [],
    });
    const luxeCand = makeEntry({ slug: 'hotel-de-luxe-nice', lieuSlug: 'nice', themes: [] });
    // Both ways: lieu(4) + reciprocal pin(10) + shared type 'all'(1) = 15.
    expect(scoreCandidate(luxeHead, meilleursCand)).toBe(15);
    expect(scoreCandidate(meilleursHead, luxeCand)).toBe(15);
  });

  it('does NOT pin a theme/occasion combo that shares the meilleurs-hotels- prefix', () => {
    // The bug fixed 2026-06-29: `meilleurs-hotels-campagne-nice` matched the
    // `^meilleurs-hotels-` regex and stole the +10, tying out the true head.
    const campagne = makeEntry({
      slug: 'meilleurs-hotels-campagne-nice',
      lieuSlug: 'nice',
      themes: ['campagne'],
    });
    const ski = makeEntry({
      slug: 'meilleurs-hotels-ski-nice',
      lieuSlug: 'nice',
      themes: ['sport-ski'],
    });
    // Same lieu (+4) + shared type 'all' (+1) only — no reciprocal pin
    // because themes are non-empty.
    expect(scoreCandidate(luxeHead, campagne)).toBe(5);
    expect(scoreCandidate(luxeHead, ski)).toBe(5);
  });

  it('ranks the true sibling head above same-lieu theme combos', () => {
    const sibling = makeEntry({ slug: 'meilleurs-hotels-nice', lieuSlug: 'nice', themes: [] });
    const campagne = makeEntry({
      slug: 'meilleurs-hotels-campagne-nice',
      lieuSlug: 'nice',
      themes: ['campagne'],
    });
    expect(scoreCandidate(luxeHead, sibling)).toBeGreaterThan(scoreCandidate(luxeHead, campagne));
  });
});
