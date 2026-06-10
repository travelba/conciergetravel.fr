import { describe, expect, it } from 'vitest';

import { buildMapboxExternalMapHref, buildMapboxStaticImageUrl } from './mapbox-static';

describe('mapbox-static', () => {
  it('builds a Static Images URL with themed marker and retina size', () => {
    const url = buildMapboxStaticImageUrl({
      latitude: 43.91123,
      longitude: 5.20001,
      zoom: 15,
      accessToken: 'pk.test-token',
    });

    expect(url).toMatch(/^https:\/\/api\.mapbox\.com\/styles\/v1\/mapbox\/light-v11\/static\//);
    expect(url).toContain('pin-l+8c7b5a(5.20001,43.91123)');
    expect(url).toContain('5.20001,43.91123,15');
    expect(url).toContain('800x360@2x');
    expect(url).toContain('access_token=pk.test-token');
  });

  it('builds an external Mapbox directions deep-link', () => {
    expect(buildMapboxExternalMapHref(48.8566, 2.3522)).toBe(
      'https://www.mapbox.com/directions/?destination=2.35220,48.85660',
    );
  });
});
