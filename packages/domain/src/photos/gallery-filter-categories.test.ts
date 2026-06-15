import { describe, expect, it } from 'vitest';

import {
  countGalleryPhotosByFilterCategory,
  hasKitGalleryFiveByFiveStructure,
  KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY,
  KIT_GALLERY_SLOT_COUNT,
  pickKitMosaicRepresentativeThumbnails,
} from './gallery-filter-categories';

function fiveByFiveManifest(): { category: string }[] {
  const categories = [
    ...Array.from({ length: 5 }, () => 'view'),
    ...Array.from({ length: 5 }, () => 'room'),
    ...Array.from({ length: 5 }, () => 'pool'),
    ...Array.from({ length: 5 }, () => 'dining'),
    ...Array.from({ length: 5 }, () => 'spa'),
  ];
  return categories.map((category) => ({ category }));
}

describe('gallery-filter-categories', () => {
  it('maps legacy exterior and dining to view and restaurant filters', () => {
    const counts = countGalleryPhotosByFilterCategory([
      { category: 'exterior' },
      { category: 'dining' },
    ]);
    expect(counts.view).toBe(1);
    expect(counts.restaurant).toBe(1);
  });

  it('detects strict 5×5 kit structure', () => {
    expect(hasKitGalleryFiveByFiveStructure(fiveByFiveManifest())).toBe(true);
    expect(hasKitGalleryFiveByFiveStructure(fiveByFiveManifest().slice(0, 24))).toBe(false);
  });

  it('picks one thumb per non-view category for mosaic side tiles', () => {
    const manifest = fiveByFiveManifest().map((row, index) => ({
      ...row,
      publicId: `press-${index + 1}`,
    }));
    const thumbs = pickKitMosaicRepresentativeThumbnails(manifest, 4);
    expect(thumbs).toHaveLength(4);
    expect(thumbs.map((t) => t.category)).toEqual(['room', 'pool', 'dining', 'spa']);
  });

  it('exports canonical kit slot constants', () => {
    expect(KIT_GALLERY_SLOT_COUNT).toBe(25);
    expect(KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY).toBe(5);
  });
});
