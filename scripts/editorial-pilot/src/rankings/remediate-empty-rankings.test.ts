import { describe, expect, it } from 'vitest';

import { selectUnpublishCandidates, type PublishedRanking } from './remediate-empty-rankings.js';

const RANKINGS: readonly PublishedRanking[] = [
  { id: 'a', slug: 'meilleurs-palaces-france' }, // 12 entries → keep
  { id: 'b', slug: 'meilleurs-hotels-montagne-saint-tropez' }, // 0 → unpublish
  { id: 'c', slug: 'meilleurs-5-etoiles-ile-de-france' }, // 2 → unpublish (< 3)
  { id: 'd', slug: 'meilleurs-hotels-rome' }, // 3 → keep (at floor)
];

const COUNTS = new Map<string, number>([
  ['a', 12],
  ['c', 2],
  ['d', 3],
  // 'b' absent → treated as 0
]);

describe('selectUnpublishCandidates', () => {
  it('selects only rankings below the floor (default 3)', () => {
    const got = selectUnpublishCandidates(RANKINGS, COUNTS);
    expect(got.map((c) => c.slug)).toEqual([
      'meilleurs-hotels-montagne-saint-tropez', // 0
      'meilleurs-5-etoiles-ile-de-france', // 2
    ]);
  });

  it('treats a ranking absent from the counts map as 0 entries', () => {
    const got = selectUnpublishCandidates(RANKINGS, COUNTS);
    const b = got.find((c) => c.id === 'b');
    expect(b?.entryCount).toBe(0);
  });

  it('keeps rankings AT the floor (>= is published)', () => {
    const got = selectUnpublishCandidates(RANKINGS, COUNTS);
    expect(got.map((c) => c.id)).not.toContain('d');
  });

  it('sorts by entry count ascending then slug', () => {
    const got = selectUnpublishCandidates(RANKINGS, COUNTS);
    expect(got[0]?.entryCount).toBe(0);
    expect(got[1]?.entryCount).toBe(2);
  });

  it('honours a custom floor', () => {
    expect(selectUnpublishCandidates(RANKINGS, COUNTS, 1).map((c) => c.slug)).toEqual([
      'meilleurs-hotels-montagne-saint-tropez', // only the 0-entry one
    ]);
    // floor 0 → nothing is below it
    expect(selectUnpublishCandidates(RANKINGS, COUNTS, 0)).toHaveLength(0);
  });
});
