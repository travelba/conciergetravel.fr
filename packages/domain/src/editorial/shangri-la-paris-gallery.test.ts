import { describe, expect, it } from 'vitest';

import { countDuplicateCanonicalGallerySourceUrls } from '../photos/gallery-source-url';
import {
  SHANGRI_LA_PARIS_GALLERY_IMAGES,
  SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS,
  SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
} from './shangri-la-paris-gallery';

// 2026-06-16 — honest re-audit dropped press-5 (Tower Bridge composite) and
// press-12 (« CBD OIL » stock); the manifest is now 23 honest slots, no longer
// a padded 5×5. Categories without real pixels shrink instead of fabricating.
describe('SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS', () => {
  it('lists 23 honest press slots with zero canonical duplicates', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS).toHaveLength(23);
    expect(countDuplicateCanonicalGallerySourceUrls(SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS)).toBe(
      0,
    );
  });

  it('manifest aligns images with their source urls', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_IMAGES).toHaveLength(23);
    expect(SHANGRI_LA_PARIS_GALLERY_IMAGES).toHaveLength(
      SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS.length,
    );
  });

  it('keeps a single honest pool pixel rather than padding the category', () => {
    const poolCount = SHANGRI_LA_PARIS_GALLERY_IMAGES.filter((i) => i.category === 'pool').length;
    expect(poolCount).toBe(1);
  });

  it('maps shang palace and la bauhinia to distinct official paths', () => {
    const shangPalace = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[13];
    const bauhinia = SHANGRI_LA_PARIS_GALLERY_PRESS_SLOT_URLS[14];
    expect(shangPalace).toContain('shang-palace/shangpalace-image2');
    expect(bauhinia).toContain('47-La-Bauhinia');
    expect(shangPalace).not.toBe(bauhinia);
  });

  it('builds 23 tracked source urls without reusing the hero', () => {
    expect(SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS).toHaveLength(23);
    expect(
      countDuplicateCanonicalGallerySourceUrls([
        ...SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
        SHANGRI_LA_PARIS_HERO_SOURCE_URL,
      ]),
    ).toBe(0);
  });
});
