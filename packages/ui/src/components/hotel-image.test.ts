import { describe, expect, it } from 'vitest';

import { buildCloudinarySrc } from './hotel-image';

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
