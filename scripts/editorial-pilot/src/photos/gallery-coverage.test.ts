import { describe, it, expect } from 'vitest';

import {
  coveredCategories,
  coverageCount,
  imagesNeedingCategory,
  hotelNeedsCategorisation,
  applyVisionAnswer,
  mergeVisionAnswers,
  combinedScore,
  pickHero,
  selectTop4,
  orderGallery,
  type GalleryImage,
  type VisionAnswer,
} from './gallery-coverage.js';

function img(public_id: string, category?: string | null): GalleryImage {
  return category === undefined ? { public_id } : { public_id, category };
}

/** Gallery row with the scoring fields populated (for selection tests). */
function scored(
  public_id: string,
  fields: {
    category?: string | null;
    quality_score?: number;
    representativeness?: number;
    hero_suitable?: boolean;
  } = {},
): GalleryImage {
  return { public_id, ...fields };
}

function answer(over: Partial<VisionAnswer> = {}): VisionAnswer {
  return {
    category: 'room',
    alt_fr: 'Chambre Deluxe Hotel Test Paris',
    alt_en: 'Deluxe Room Hotel Test Paris',
    caption_fr: 'La Chambre Deluxe avec vue sur la cour, Hotel Test, Paris.',
    caption_en: 'The Deluxe Room overlooking the courtyard, Hotel Test, Paris.',
    quality_score: 8,
    representativeness: 6,
    hero_suitable: false,
    keep: true,
    reason_if_drop: null,
    ...over,
  };
}

describe('coveredCategories', () => {
  it('counts distinct CDC categories and folds suite into room', () => {
    const gallery = [
      img('a', 'room'),
      img('b', 'suite'),
      img('c', 'pool'),
      img('d', 'other'),
      img('e', null),
    ];
    const covered = coveredCategories(gallery);
    expect([...covered].sort()).toEqual(['pool', 'room']);
    expect(coverageCount(gallery)).toBe(2);
  });

  it('ignores other and unknown categories', () => {
    const gallery = [img('a', 'other'), img('b', 'random'), img('c', 'exterior')];
    expect(coverageCount(gallery)).toBe(1);
  });
});

describe('imagesNeedingCategory', () => {
  it('returns only images without a non-empty category', () => {
    const gallery = [img('a', 'room'), img('b'), img('c', ''), img('d', null)];
    expect(imagesNeedingCategory(gallery).map((i) => i.public_id)).toEqual(['b', 'c', 'd']);
  });
});

describe('hotelNeedsCategorisation', () => {
  it('is false for empty gallery', () => {
    expect(hotelNeedsCategorisation([])).toBe(false);
  });

  it('is true when any photo lacks a category', () => {
    expect(hotelNeedsCategorisation([img('a', 'room'), img('b')])).toBe(true);
  });

  it('is true when coverage below floor even if all categorised', () => {
    const gallery = [img('a', 'room'), img('b', 'pool')];
    expect(hotelNeedsCategorisation(gallery)).toBe(true);
  });

  it('is false when fully categorised and coverage meets floor', () => {
    const cats = [
      'exterior',
      'lobby',
      'room',
      'dining',
      'spa',
      'pool',
      'view',
      'detail',
      'concierge',
      'events',
    ];
    const gallery = cats.map((c, i) => img(`p${i}`, c));
    expect(hotelNeedsCategorisation(gallery)).toBe(false);
  });

  it('respects force', () => {
    const cats = [
      'exterior',
      'lobby',
      'room',
      'dining',
      'spa',
      'pool',
      'view',
      'detail',
      'concierge',
      'events',
    ];
    const gallery = cats.map((c, i) => img(`p${i}`, c));
    expect(hotelNeedsCategorisation(gallery, { force: true })).toBe(true);
  });
});

describe('applyVisionAnswer', () => {
  it('overwrites classification fields, preserves the rest', () => {
    const original: GalleryImage = { public_id: 'x', source: 'google_places', width: 2400 };
    const merged = applyVisionAnswer(
      original,
      answer({ category: 'pool', quality_score: 9, representativeness: 7, hero_suitable: true }),
    );
    expect(merged.public_id).toBe('x');
    expect(merged['source']).toBe('google_places');
    expect(merged['width']).toBe(2400);
    expect(merged.category).toBe('pool');
    expect(merged.quality_score).toBe(9);
    expect(merged.representativeness).toBe(7);
    expect(merged.hero_suitable).toBe(true);
    expect(merged.alt_fr).toBe('Chambre Deluxe Hotel Test Paris');
  });
});

describe('mergeVisionAnswers', () => {
  it('applies answers, drops keep=false, leaves un-answered rows', () => {
    const gallery = [img('a'), img('b'), img('c', 'lobby')];
    const answers = new Map<string, VisionAnswer>([
      ['a', answer({ category: 'room' })],
      ['b', answer({ keep: false, reason_if_drop: 'blurry' })],
    ]);
    const res = mergeVisionAnswers(gallery, answers);
    expect(res.classified).toBe(1);
    expect(res.dropped).toEqual([{ public_id: 'b', reason: 'blurry' }]);
    expect(res.gallery.map((i) => i.public_id)).toEqual(['a', 'c']);
    expect(res.gallery[0]?.category).toBe('room');
    expect(res.gallery[1]?.category).toBe('lobby');
  });
});

describe('combinedScore', () => {
  it('weights representativeness twice the quality score', () => {
    expect(combinedScore(scored('a', { representativeness: 5, quality_score: 4 }))).toBe(14);
  });

  it('degrades to quality_score when representativeness is absent', () => {
    expect(combinedScore(scored('a', { quality_score: 7 }))).toBe(7);
    expect(combinedScore(scored('a'))).toBe(0);
  });
});

describe('pickHero', () => {
  it('returns null for an empty gallery', () => {
    expect(pickHero([])).toBeNull();
  });

  it('prefers a hero_suitable signature-category photo over a higher-scored non-hero shot', () => {
    const gallery = [
      // Higher combined score but not hero_suitable + a close-up detail.
      scored('detail-1', { category: 'detail', representativeness: 9, quality_score: 9 }),
      // Lower score but emblematic facade flagged hero_suitable.
      scored('ext-1', {
        category: 'exterior',
        representativeness: 7,
        quality_score: 6,
        hero_suitable: true,
      }),
    ];
    expect(pickHero(gallery)).toBe('ext-1');
  });

  it('falls back to any hero_suitable photo when none is in a signature category', () => {
    const gallery = [
      scored('room-1', {
        category: 'room',
        representativeness: 8,
        quality_score: 8,
        hero_suitable: true,
      }),
      scored('detail-1', { category: 'detail', representativeness: 9, quality_score: 9 }),
    ];
    expect(pickHero(gallery)).toBe('room-1');
  });

  it('falls back to the best combined score when nothing is hero_suitable (un-scored gallery)', () => {
    const gallery = [
      scored('a', { category: 'room', quality_score: 5 }),
      scored('b', { category: 'pool', quality_score: 9 }),
    ];
    expect(pickHero(gallery)).toBe('b');
  });
});

describe('selectTop4', () => {
  it('picks distinct categories in priority order, excluding the hero category', () => {
    const gallery = [
      scored('ext-1', {
        category: 'exterior',
        representativeness: 9,
        quality_score: 9,
        hero_suitable: true,
      }),
      scored('room-1', { category: 'room', representativeness: 7, quality_score: 8 }),
      scored('room-2', { category: 'room', representativeness: 4, quality_score: 5 }),
      scored('dining-1', { category: 'dining', representativeness: 6, quality_score: 7 }),
      scored('pool-1', { category: 'pool', representativeness: 8, quality_score: 6 }),
      scored('detail-1', { category: 'detail', representativeness: 5, quality_score: 9 }),
    ];
    const top4 = selectTop4(gallery, 'ext-1');
    // room (best of two) → dining → pool → detail, hero (exterior) skipped.
    expect(top4).toEqual(['room-1', 'dining-1', 'pool-1', 'detail-1']);
  });

  it('fills remaining slots with best leftovers when categories run out', () => {
    const gallery = [
      scored('hero', { category: 'exterior', hero_suitable: true, quality_score: 5 }),
      scored('room-1', { category: 'room', quality_score: 9 }),
      scored('room-2', { category: 'room', quality_score: 8 }),
      scored('room-3', { category: 'room', quality_score: 7 }),
    ];
    const top4 = selectTop4(gallery, 'hero');
    // Only one category available → first is the diversity pick, then
    // the leftovers fill by descending score.
    expect(top4).toEqual(['room-1', 'room-2', 'room-3']);
  });
});

describe('orderGallery', () => {
  it('excludes the hero and front-loads the diverse TOP 4, then the rest by score', () => {
    const gallery = [
      scored('ext-1', {
        category: 'exterior',
        representativeness: 9,
        quality_score: 9,
        hero_suitable: true,
      }),
      scored('room-1', { category: 'room', representativeness: 7, quality_score: 8 }),
      scored('dining-1', { category: 'dining', representativeness: 6, quality_score: 7 }),
      scored('pool-1', { category: 'pool', representativeness: 8, quality_score: 6 }),
      scored('detail-1', { category: 'detail', representativeness: 5, quality_score: 9 }),
      scored('spa-1', { category: 'spa', representativeness: 9, quality_score: 9 }),
    ];
    const { heroPublicId, orderedGallery } = orderGallery(gallery);
    expect(heroPublicId).toBe('ext-1');
    expect(orderedGallery.some((img) => img.public_id === 'ext-1')).toBe(false);
    // TOP 4 = diversity picks (room, dining, pool, detail), then spa by score.
    expect(orderedGallery.map((img) => img.public_id)).toEqual([
      'room-1',
      'dining-1',
      'pool-1',
      'detail-1',
      'spa-1',
    ]);
  });

  it('is idempotent — re-running on an ordered gallery keeps the same order', () => {
    const gallery = [
      scored('ext-1', {
        category: 'exterior',
        representativeness: 9,
        quality_score: 9,
        hero_suitable: true,
      }),
      scored('room-1', { category: 'room', representativeness: 7, quality_score: 8 }),
      scored('dining-1', { category: 'dining', representativeness: 6, quality_score: 7 }),
      scored('pool-1', { category: 'pool', representativeness: 8, quality_score: 6 }),
      scored('detail-1', { category: 'detail', representativeness: 5, quality_score: 9 }),
    ];
    const first = orderGallery(gallery);
    const heroRow = gallery.find((img) => img.public_id === first.heroPublicId);
    expect(heroRow).toBeDefined();
    const reconstructed = heroRow ? [heroRow, ...first.orderedGallery] : [...first.orderedGallery];
    const second = orderGallery(reconstructed);
    expect(second.heroPublicId).toBe(first.heroPublicId);
    expect(second.orderedGallery.map((i) => i.public_id)).toEqual(
      first.orderedGallery.map((i) => i.public_id),
    );
  });

  it('handles an empty gallery', () => {
    const res = orderGallery([]);
    expect(res.heroPublicId).toBeNull();
    expect(res.orderedGallery).toEqual([]);
  });
});
