import { describe, expect, it } from 'vitest';

import { buildHotelGalleryViewModel } from './build-hotel-gallery-view-model';
import type { LocalisedGalleryImage } from './get-hotel-by-slug';

function img(publicId: string, category: string): LocalisedGalleryImage {
  return {
    publicId,
    alt: publicId,
    caption: null,
    category,
    credit: null,
    licence: null,
  };
}

describe('buildHotelGalleryViewModel', () => {
  it('uses hero_image as mosaic lead on standard fiches', () => {
    const gallery = [img('hero-drone', 'exterior'), img('pool-1', 'pool'), img('room-1', 'room')];
    const vm = buildHotelGalleryViewModel({
      heroPublicId: 'hero-drone',
      galleryImages: gallery,
      hotelName: 'Test Hotel',
    });
    expect(vm.hero?.publicId).toBe('hero-drone');
    expect(vm.hero?.category).toBe('exterior');
    expect(vm.gridImages.map((g) => g.publicId)).toEqual(['pool-1', 'room-1']);
  });

  it('picks best view for golden overlay fiches (no duplicate overlay hero)', () => {
    const gallery = [
      img('overlay-hero', 'exterior'),
      img('pool-1', 'pool'),
      img('village-view', 'view'),
      img('room-1', 'room'),
    ];
    const vm = buildHotelGalleryViewModel({
      heroPublicId: 'overlay-hero',
      galleryImages: gallery,
      hotelName: 'Golden Hotel',
      omitOverlayHeroFromMosaic: true,
    });
    expect(vm.hero?.publicId).toBe('village-view');
    expect(vm.gridImages.map((g) => g.publicId)).toEqual(['pool-1', 'room-1']);
  });
});
