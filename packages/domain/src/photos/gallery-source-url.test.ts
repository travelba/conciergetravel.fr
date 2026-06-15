import { describe, expect, it } from 'vitest';

import {
  assertUniqueCanonicalGallerySourceUrls,
  countDuplicateCanonicalGallerySourceUrls,
  countDuplicateCanonicalGallerySourceUrlsFromRows,
  normalizeGallerySourceUrlForDedup,
} from './gallery-source-url';

describe('normalizeGallerySourceUrlForDedup', () => {
  it('strips query params that only resize the same asset', () => {
    const base =
      'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg';
    expect(normalizeGallerySourceUrlForDedup(`${base}?w=1190`)).toBe(
      normalizeGallerySourceUrlForDedup(base),
    );
  });

  it('normalizes www and http scheme', () => {
    const a = 'http://www.shangri-la.com/uploadedImages/foo/SLPR-Lobby.jpg?width=1200';
    const b = 'https://shangri-la.com/uploadedImages/foo/SLPR-Lobby.jpg?width=1400';
    expect(normalizeGallerySourceUrlForDedup(a)).toBe(normalizeGallerySourceUrlForDedup(b));
  });

  it('does not treat distinct paths as duplicates', () => {
    const shangPalace =
      'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/paris_shangrila/dining/restaurants/shang-palace/shangpalace-image2-630x364.jpg';
    const bauhinia =
      'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg';
    expect(normalizeGallerySourceUrlForDedup(shangPalace)).not.toBe(
      normalizeGallerySourceUrlForDedup(bauhinia),
    );
  });
});

describe('countDuplicateCanonicalGallerySourceUrls', () => {
  it('counts query-only duplicates', () => {
    const dupes = countDuplicateCanonicalGallerySourceUrls([
      'https://example.com/a.jpg',
      'https://example.com/a.jpg?w=1',
      'https://example.com/b.jpg',
    ]);
    expect(dupes).toBe(1);
  });

  it('reads url or source_url from gallery rows', () => {
    const dupes = countDuplicateCanonicalGallerySourceUrlsFromRows([
      { public_id: 'press-1', url: 'https://example.com/spa.jpg?w=1140' },
      { public_id: 'press-2', source_url: 'https://example.com/spa.jpg?w=1139' },
    ]);
    expect(dupes).toBe(1);
  });
});

describe('assertUniqueCanonicalGallerySourceUrls', () => {
  it('throws with press slot indices', () => {
    expect(() =>
      assertUniqueCanonicalGallerySourceUrls('demo', [
        'https://example.com/same.jpg',
        'https://example.com/same.jpg?mchPress=2',
      ]),
    ).toThrow(/press-1 and press-2/);
  });
});
