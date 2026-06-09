import { describe, expect, it } from 'vitest';

import { buildOpenStreetMapEmbedUrl, buildOpenStreetMapHotelHref } from './openstreetmap-embed';

describe('openstreetmap-embed', () => {
  it('builds an OSM embed URL with bbox and marker', () => {
    const url = buildOpenStreetMapEmbedUrl({ latitude: 43.91123, longitude: 5.20001 });
    expect(url).toMatch(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?/);
    expect(url).toContain('layer=mapnik');
    expect(url).toContain('marker=43.911230%2C5.200010');
    expect(url).toContain('bbox=');
  });

  it('builds an OpenStreetMap deep link', () => {
    expect(buildOpenStreetMapHotelHref(43.91123, 5.20001)).toBe(
      'https://www.openstreetmap.org/?mlat=43.91123&mlon=5.20001&zoom=15',
    );
  });
});
