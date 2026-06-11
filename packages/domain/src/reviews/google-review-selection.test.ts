import { describe, expect, it } from 'vitest';

import {
  compareGoogleReviewsByRecency,
  hasSubstantiveGoogleReviewComment,
  isGoogleReviewWithinDisplayWindow,
  mergeGoogleReviewCache,
  selectGoogleReviewsForAccesDisplay,
  selectGoogleReviewsForDisplay,
  type GoogleReviewCandidate,
} from './google-review-selection';

describe('hasSubstantiveGoogleReviewComment', () => {
  it('accepts multi-word comments', () => {
    expect(hasSubstantiveGoogleReviewComment('Très bel hôtel, chambre spacieuse.')).toBe(true);
  });

  it('rejects empty or ultra-short comments', () => {
    expect(hasSubstantiveGoogleReviewComment('')).toBe(false);
    expect(hasSubstantiveGoogleReviewComment('Top')).toBe(false);
    expect(hasSubstantiveGoogleReviewComment('👍👍👍')).toBe(false);
  });
});

describe('compareGoogleReviewsByRecency', () => {
  it('sorts newer publish_time before older', () => {
    const newer: GoogleReviewCandidate = {
      author: 'A',
      rating: 3,
      text: 'Commentaire récent détaillé.',
      publishTime: '2026-06-01T12:00:00Z',
    };
    const older: GoogleReviewCandidate = {
      author: 'B',
      rating: 5,
      text: 'Commentaire plus ancien.',
      publishTime: '2026-01-01T12:00:00Z',
    };
    expect(compareGoogleReviewsByRecency(newer, older)).toBeLessThan(0);
    expect(compareGoogleReviewsByRecency(older, newer)).toBeGreaterThan(0);
  });

  it('puts undated reviews after dated ones', () => {
    const dated: GoogleReviewCandidate = {
      author: 'A',
      rating: 4,
      text: 'Avis daté avec texte.',
      publishTime: '2026-03-01T00:00:00Z',
    };
    const undated: GoogleReviewCandidate = {
      author: 'B',
      rating: 5,
      text: 'Avis sans date mais long.',
      publishTime: null,
    };
    expect(compareGoogleReviewsByRecency(dated, undated)).toBeLessThan(0);
  });
});

describe('selectGoogleReviewsForDisplay', () => {
  const pool: readonly GoogleReviewCandidate[] = [
    {
      author: 'Five star old',
      rating: 5,
      text: 'Palace magnifique, service impeccable.',
      publishTime: '2025-12-01T10:00:00Z',
    },
    {
      author: 'Three star recent',
      rating: 3,
      text: 'Chambre correcte mais bruit de travaux.',
      publishTime: '2026-06-08T09:00:00Z',
    },
    {
      author: 'Empty',
      rating: 4,
      text: '   ',
      publishTime: '2026-06-09T09:00:00Z',
    },
    {
      author: 'Four star mid',
      rating: 4,
      text: 'Bon séjour, petit-déjeuner excellent.',
      publishTime: '2026-02-15T09:00:00Z',
    },
  ];

  it('returns recent substantive reviews including ratings below 5', () => {
    const selected = selectGoogleReviewsForDisplay(pool, 3);
    expect(selected.map((r) => r.author)).toEqual([
      'Three star recent',
      'Four star mid',
      'Five star old',
    ]);
    expect(selected.some((r) => r.rating < 5)).toBe(true);
  });

  it('drops rating-only / empty-text rows', () => {
    const selected = selectGoogleReviewsForDisplay(pool, 5);
    expect(selected.some((r) => r.author === 'Empty')).toBe(false);
  });
});

describe('selectGoogleReviewsForAccesDisplay', () => {
  const nowMs = Date.parse('2026-06-10T12:00:00.000Z');

  it('excludes stale quotes outside the 90-day window', () => {
    const pool: readonly GoogleReviewCandidate[] = [
      {
        author: 'Recent',
        rating: 3,
        text: 'Commentaire récent détaillé.',
        publishTime: '2026-05-28T09:45:28.907616117Z',
      },
      {
        author: 'Stale',
        rating: 5,
        text: 'Palace magnifique, service impeccable.',
        publishTime: '2025-12-29T10:46:32.432846029Z',
      },
    ];
    expect(selectGoogleReviewsForAccesDisplay(pool, 3, 90, nowMs).map((r) => r.author)).toEqual([
      'Recent',
    ]);
  });
});

describe('mergeGoogleReviewCache', () => {
  const nowMs = Date.parse('2026-06-10T12:00:00.000Z');

  it('keeps a fresh cached row when the API sample drops it', () => {
    const existing: GoogleReviewCandidate[] = [
      {
        author: 'Cached fresh',
        rating: 5,
        text: 'Still valid cached review text.',
        publishTime: '2026-05-01T00:00:00.000Z',
      },
    ];
    const incoming: GoogleReviewCandidate[] = [
      {
        author: 'API fresh',
        rating: 4,
        text: 'New review from Google Places API.',
        publishTime: '2026-06-01T00:00:00.000Z',
      },
    ];
    const merged = mergeGoogleReviewCache(existing, incoming, { maxStored: 5 });
    expect(merged.map((r) => r.author)).toEqual(['API fresh', 'Cached fresh']);
  });
});
