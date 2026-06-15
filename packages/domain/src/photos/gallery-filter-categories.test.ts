import { describe, expect, it } from 'vitest';

import {
  countGalleryPhotosByFilterCategory,
  hasKitGalleryFiveByFiveStructure,
  KIT_GALLERY_FILTER_TAB_MIN_PHOTOS,
  KIT_GALLERY_MOSAIC_SIDE_TILE_COUNT,
  KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY,
  KIT_GALLERY_SLOT_COUNT,
  pickBestViewGalleryImage,
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

  it('picks one thumb per non-view category for partial catalogues (Airelles pilot)', () => {
    const partial = [
      { publicId: 'pool-1', category: 'pool' },
      { publicId: 'room-1', category: 'room' },
      { publicId: 'dining-1', category: 'dining' },
      { publicId: 'spa-1', category: 'spa' },
      { publicId: 'view-1', category: 'view' },
    ];
    const thumbs = pickKitMosaicRepresentativeThumbnails(
      partial,
      KIT_GALLERY_MOSAIC_SIDE_TILE_COUNT,
    );
    expect(thumbs).toHaveLength(4);
    expect(thumbs.map((t) => t.category)).toEqual(['room', 'pool', 'dining', 'spa']);
  });

  it('picks best view lead for golden overlay fiches', () => {
    const images = [
      { publicId: 'pool-1', category: 'pool' },
      { publicId: 'village-view', category: 'view' },
      { publicId: 'room-1', category: 'room' },
    ];
    expect(pickBestViewGalleryImage(images)?.publicId).toBe('village-view');
  });

  it('exports UI tab minimum separate from publish gate', () => {
    expect(KIT_GALLERY_FILTER_TAB_MIN_PHOTOS).toBe(1);
    expect(KIT_GALLERY_MOSAIC_SIDE_TILE_COUNT).toBe(4);
    expect(KIT_GALLERY_SLOT_COUNT).toBe(25);
    expect(KIT_GALLERY_PHOTOS_PER_FILTER_CATEGORY).toBe(5);
  });
});
