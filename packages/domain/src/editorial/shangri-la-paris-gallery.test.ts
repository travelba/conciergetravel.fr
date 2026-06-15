import { describe, expect, it } from 'vitest';

import { countDuplicateCanonicalGallerySourceUrls } from '../photos/gallery-source-url';
import {
  SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS,
  SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
} from './shangri-la-paris-gallery';

describe('SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS', () => {
  it('lists 30 press slots with zero canonical duplicates', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS).toHaveLength(30);
    expect(countDuplicateCanonicalGallerySourceUrls(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS)).toBe(
      0,
    );
  });

  it('maps shang palace and la bauhinia to distinct official paths', () => {
    const shangPalace = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[9];
    const bauhinia = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[10];
    expect(shangPalace).toContain('shang-palace/shangpalace-image2');
    expect(bauhinia).toContain('47-La-Bauhinia');
    expect(shangPalace).not.toBe(bauhinia);
  });

  it('builds 30 tracked source urls without reusing the hero', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS).toHaveLength(30);
    expect(
      countDuplicateCanonicalGallerySourceUrls([
        ...SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
        SHANGRI_LA_PARIS_HERO_SOURCE_URL,
      ]),
    ).toBe(0);
  });
});
