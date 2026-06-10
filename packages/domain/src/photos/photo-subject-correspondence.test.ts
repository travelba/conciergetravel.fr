import { describe, expect, it } from 'vitest';

import {
  evaluateGalleryAltCategoryCorrespondence,
  evaluatePhotoSlotExpectations,
  evaluatePoiStructuralCorrespondence,
  isDedicatedPoiImagePublicId,
  isRecycledHotelGalleryPublicId,
  poiAltMatchesName,
  publicIdLastSegment,
} from './photo-subject-correspondence';

describe('publicId helpers', () => {
  it('extracts last segment', () => {
    expect(publicIdLastSegment('cct/hotels/x/poi-arc-de-triomphe')).toBe('poi-arc-de-triomphe');
  });

  it('detects dedicated POI ids', () => {
    expect(isDedicatedPoiImagePublicId('cct/hotels/pdg/poi-musee-yves-saint-laurent')).toBe(true);
    expect(isDedicatedPoiImagePublicId('cct/hotels/pdg/press-24')).toBe(false);
  });

  it('flags recycled gallery slots on POIs', () => {
    expect(isRecycledHotelGalleryPublicId('cct/hotels/pdg/press-24')).toBe(true);
    expect(isRecycledHotelGalleryPublicId('cct/hotels/pdg/poi-ysl')).toBe(false);
  });
});

describe('poiAltMatchesName', () => {
  it('matches significant POI name tokens in alt_fr', () => {
    expect(
      poiAltMatchesName('Musée Yves Saint Laurent', 'Atelier du Musée Yves Saint Laurent Paris'),
    ).toBe(true);
  });

  it('fails when alt describes unrelated subject', () => {
    expect(
      poiAltMatchesName('Musée Yves Saint Laurent', 'Chambre Lalique cristal Prince de Galles'),
    ).toBe(false);
  });
});

describe('evaluatePoiStructuralCorrespondence', () => {
  it('passes dedicated poi-* assets', () => {
    const r = evaluatePoiStructuralCorrespondence([
      {
        name: 'Arc de triomphe',
        image_public_id: 'cct/hotels/x/poi-arc-de-triomphe',
      },
    ]);
    expect(r.ok).toBe(1);
    expect(r.issues).toHaveLength(0);
  });

  it('flags press-* recycled on POI (PdG bug class)', () => {
    const r = evaluatePoiStructuralCorrespondence([
      {
        name: 'Musée Yves Saint Laurent',
        image_public_id: 'cct/hotels/prince-de-galles-paris/press-24',
      },
    ]);
    expect(r.ok).toBe(0);
    expect(r.issues[0]?.code).toBe('recycled_gallery');
  });
});

describe('evaluateGalleryAltCategoryCorrespondence', () => {
  it('flags spa category with room alt', () => {
    const r = evaluateGalleryAltCategoryCorrespondence([
      {
        public_id: 'cct/hotels/x/press-17',
        category: 'spa',
        alt_fr: 'Chambre Deluxe mosaïque Lalique Prince de Galles Paris',
      },
    ]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]?.code).toBe('spa_labeled_as_room');
  });
});

describe('evaluatePhotoSlotExpectations', () => {
  it('flags wrong category on declared slot', () => {
    const mismatches = evaluatePhotoSlotExpectations(
      [{ public_id: 'cct/hotels/x/press-17', category: 'room' }],
      [{ publicIdSuffix: 'press-17', block: 'spa', expectedCategories: ['spa'] }],
    );
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.block).toBe('spa');
  });
});
