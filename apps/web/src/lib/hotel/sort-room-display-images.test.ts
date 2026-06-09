import { describe, expect, it } from 'vitest';

import { mergeRoomGalleryImages, sortRoomDisplayImages } from './sort-room-display-images';

describe('sortRoomDisplayImages', () => {
  it('puts bedroom / room category before bathroom detail', () => {
    const sorted = sortRoomDisplayImages([
      { publicId: 'bath', alt: 'Salle de bain', category: 'detail' },
      { publicId: 'bed', alt: 'Chambre avec vue', category: 'suite' },
    ]);
    expect(sorted.map((i) => i.publicId)).toEqual(['bed', 'bath']);
  });

  it('uses alt heuristics when category is missing', () => {
    const sorted = sortRoomDisplayImages([
      { publicId: 'view', alt: 'Vue terrasse Luberon' },
      { publicId: 'bed', alt: 'Bedroom with valley view' },
    ]);
    expect(sorted[0]?.publicId).toBe('bed');
  });
});

describe('mergeRoomGalleryImages', () => {
  it('reorders hero when it is not the interior shot', () => {
    const merged = mergeRoomGalleryImages({
      heroImage: 'bath',
      heroAlt: 'Salle de bain',
      images: [
        { publicId: 'bath', alt: 'Salle de bain', category: 'detail' },
        { publicId: 'bed', alt: 'Chambre', category: 'room' },
      ],
    });
    expect(merged.map((i) => i.publicId)).toEqual(['bed', 'bath']);
  });
});
