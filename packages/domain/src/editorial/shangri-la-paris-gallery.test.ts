import { describe, expect, it } from 'vitest';

import { hasKitGalleryFiveByFiveStructure } from '../photos/gallery-filter-categories';
import { countDuplicateCanonicalGallerySourceUrls } from '../photos/gallery-source-url';
import {
  SHANGRI_LA_PARIS_GALLERY_IMAGES,
  SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS,
  SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
} from './shangri-la-paris-gallery';

describe('SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS', () => {
  it('lists 25 press slots with zero canonical duplicates', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS).toHaveLength(25);
    expect(countDuplicateCanonicalGallerySourceUrls(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS)).toBe(
      0,
    );
  });

  it('manifest satisfies kit 5×5 filter structure', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_IMAGES).toHaveLength(25);
    expect(hasKitGalleryFiveByFiveStructure(SHANGRI_LA_PARIS_GALLERY_IMAGES)).toBe(true);
  });

  it('maps shang palace and la bauhinia to distinct official paths', () => {
    const shangPalace = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[15];
    const bauhinia = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[16];
    expect(shangPalace).toContain('shang-palace/shangpalace-image2');
    expect(bauhinia).toContain('47-La-Bauhinia');
    expect(shangPalace).not.toBe(bauhinia);
  });

  it('builds 25 tracked source urls without reusing the hero', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS).toHaveLength(25);
    expect(
      countDuplicateCanonicalGallerySourceUrls([
        ...SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
        SHANGRI_LA_PARIS_HERO_SOURCE_URL,
      ]),
    ).toBe(0);
  });
});
