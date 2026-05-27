import { describe, expect, it } from 'vitest';

import { buildCloudinaryFetchSrc, buildCloudinarySrc, isHttpUrl } from './hotel-image';

describe('isHttpUrl', () => {
  it('detects http://', () => {
    expect(isHttpUrl('http://example.com/img.jpg')).toBe(true);
  });
  it('detects https://', () => {
    expect(isHttpUrl('https://commons.wikimedia.org/x.jpg')).toBe(true);
  });
  it('rejects Cloudinary public IDs', () => {
    expect(isHttpUrl('hotels/ritz-paris/hero')).toBe(false);
    expect(isHttpUrl('cct/hotels/le-bristol-paris/hero')).toBe(false);
  });
  it('rejects an empty string', () => {
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('buildCloudinaryFetchSrc', () => {
  it('wraps a remote URL with the default transforms', () => {
    const url = buildCloudinaryFetchSrc({
      cloudName: 'dvbjwh5wy',
      remoteUrl: 'https://commons.wikimedia.org/foo.jpg',
    });
    expect(url).toBe(
      'https://res.cloudinary.com/dvbjwh5wy/image/fetch/f_auto,q_auto,c_fill,g_auto/https%3A%2F%2Fcommons.wikimedia.org%2Ffoo.jpg',
    );
  });

  it('respects a caller-supplied transforms string', () => {
    const url = buildCloudinaryFetchSrc({
      cloudName: 'dvbjwh5wy',
      remoteUrl: 'https://www.travoh.com/hotel.png',
      transforms: 'f_auto,q_auto:good,c_fill,g_auto,w_640,h_480',
    });
    expect(url).toBe(
      'https://res.cloudinary.com/dvbjwh5wy/image/fetch/f_auto,q_auto:good,c_fill,g_auto,w_640,h_480/https%3A%2F%2Fwww.travoh.com%2Fhotel.png',
    );
  });

  it('URL-encodes the remote URL so query strings and fragments survive', () => {
    const url = buildCloudinaryFetchSrc({
      cloudName: 'dvbjwh5wy',
      remoteUrl: 'https://example.com/path?foo=bar&baz=qux#anchor',
    });
    expect(url).toContain(
      'image/fetch/f_auto,q_auto,c_fill,g_auto/https%3A%2F%2Fexample.com%2Fpath%3Ffoo%3Dbar%26baz%3Dqux%23anchor',
    );
  });
});

describe('buildCloudinarySrc', () => {
  it('builds the default URL with f_auto,q_auto,c_fill,g_auto transforms', () => {
    const url = buildCloudinarySrc({
      cloudName: 'myconciergehotel',
      publicId: 'hotels/ritz-paris/hero',
    });
    expect(url).toBe(
      'https://res.cloudinary.com/myconciergehotel/image/upload/f_auto,q_auto,c_fill,g_auto/hotels/ritz-paris/hero',
    );
  });

  it('respects a caller-supplied transforms string', () => {
    const url = buildCloudinarySrc({
      cloudName: 'myconciergehotel',
      publicId: 'hotels/four-seasons-george-v/lounge',
      transforms: 'f_auto,q_auto,w_800,h_600,c_fill,g_auto',
    });
    expect(url).toBe(
      'https://res.cloudinary.com/myconciergehotel/image/upload/f_auto,q_auto,w_800,h_600,c_fill,g_auto/hotels/four-seasons-george-v/lounge',
    );
  });

  it('preserves path segments in publicId but URL-encodes each component', () => {
    const url = buildCloudinarySrc({
      cloudName: 'myconciergehotel',
      publicId: 'hotels/ritz paris/hero shot',
    });
    expect(url).toBe(
      'https://res.cloudinary.com/myconciergehotel/image/upload/f_auto,q_auto,c_fill,g_auto/hotels/ritz%20paris/hero%20shot',
    );
  });

  it('URL-encodes the cloud name', () => {
    const url = buildCloudinarySrc({
      cloudName: 'mch staging',
      publicId: 'hotel/x',
    });
    expect(url.startsWith('https://res.cloudinary.com/mch%20staging/image/upload/')).toBe(true);
  });
});
