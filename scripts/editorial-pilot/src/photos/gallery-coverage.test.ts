import { describe, it, expect } from 'vitest';

import {
  coveredCategories,
  coverageCount,
  imagesNeedingCategory,
  hotelNeedsCategorisation,
  applyVisionAnswer,
  mergeVisionAnswers,
  type GalleryImage,
  type VisionAnswer,
} from './gallery-coverage.js';

function img(public_id: string, category?: string | null): GalleryImage {
  return category === undefined ? { public_id } : { public_id, category };
}

function answer(over: Partial<VisionAnswer> = {}): VisionAnswer {
  return {
    category: 'room',
    alt_fr: 'Chambre Deluxe Hotel Test Paris',
    alt_en: 'Deluxe Room Hotel Test Paris',
    caption_fr: 'La Chambre Deluxe avec vue sur la cour, Hotel Test, Paris.',
    caption_en: 'The Deluxe Room overlooking the courtyard, Hotel Test, Paris.',
    quality_score: 8,
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
    const merged = applyVisionAnswer(original, answer({ category: 'pool', quality_score: 9 }));
    expect(merged.public_id).toBe('x');
    expect(merged['source']).toBe('google_places');
    expect(merged['width']).toBe(2400);
    expect(merged.category).toBe('pool');
    expect(merged.quality_score).toBe(9);
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
