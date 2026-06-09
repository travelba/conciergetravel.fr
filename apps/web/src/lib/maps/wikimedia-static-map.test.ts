import { describe, expect, it } from 'vitest';

import {
  buildOpenStreetMapHotelHref,
  buildWikimediaStaticMapTileUrl,
} from './wikimedia-static-map';

describe('wikimedia-static-map', () => {
  it('builds a Wikimedia tile URL with 5-decimal coords', () => {
    expect(buildWikimediaStaticMapTileUrl({ latitude: 43.91123, longitude: 5.20001 })).toBe(
      'https://maps.wikimedia.org/img/osm-intl,15,43.91123,5.20001,800x360@2x.png',
    );
  });

  it('builds an OpenStreetMap deep link', () => {
    expect(buildOpenStreetMapHotelHref(43.91123, 5.20001)).toBe(
      'https://www.openstreetmap.org/?mlat=43.91123&mlon=5.20001&zoom=15',
    );
  });
});
