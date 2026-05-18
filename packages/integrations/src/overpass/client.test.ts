import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  defaultOverpassConfig,
  fetchAmenitiesAround,
  fetchTransitStationsAround,
  haversineMeters,
} from './client.js';

const TEST_ENDPOINT = 'https://example-overpass.test/api/interpreter';
const cfg = {
  ...defaultOverpassConfig('https://myconciergehotel.com'),
  endpoint: TEST_ENDPOINT,
};

// Le Bristol Paris coords as anchor.
const ANCHOR_LAT = 48.8721;
const ANCHOR_LON = 2.3157;

// A tight cluster of fake amenities ~50-300 m from anchor.
const AMENITY_NODES = [
  {
    type: 'node' as const,
    id: 1,
    lat: 48.8722,
    lon: 2.316,
    tags: {
      amenity: 'pharmacy',
      name: 'Pharmacie du Faubourg',
      opening_hours: 'Mo-Sa 09:00-19:30',
      phone: '+33 1 42 65 12 34',
      website: 'https://pharmacie-faubourg.fr',
    },
  },
  {
    type: 'node' as const,
    id: 2,
    lat: 48.873,
    lon: 2.317,
    tags: {
      amenity: 'bakery',
      name: 'Boulangerie Cyril Lignac',
      brand: 'Lignac',
    },
  },
  // Way with `center` instead of lat/lon (e.g. an indoor mall unit).
  {
    type: 'way' as const,
    id: 1001,
    center: { lat: 48.871, lon: 2.314 },
    tags: {
      amenity: 'supermarket',
      name: 'Monoprix Faubourg Saint-Honoré',
      'addr:housenumber': '109',
      'addr:street': 'Rue du Faubourg Saint-Honoré',
      opening_hours: 'Mo-Sa 08:30-21:00; Su 09:00-13:00',
    },
  },
  // Missing name → should be dropped.
  {
    type: 'node' as const,
    id: 3,
    lat: 48.8725,
    lon: 2.3158,
    tags: { amenity: 'pharmacy' },
  },
  // Unknown amenity → should be dropped (defence in depth).
  {
    type: 'node' as const,
    id: 4,
    lat: 48.8729,
    lon: 2.3155,
    tags: { amenity: 'restaurant', name: 'Le Bristol Restaurant' },
  },
  // Malformed website URL → should still parse, but without the website field.
  {
    type: 'node' as const,
    id: 5,
    lat: 48.8718,
    lon: 2.315,
    tags: { amenity: 'atm', name: 'BNP Paribas ATM', website: 'not-a-url' },
  },
];

const TRANSIT_NODES = [
  {
    type: 'node' as const,
    id: 100,
    lat: 48.8718,
    lon: 2.3168,
    tags: {
      railway: 'station',
      station: 'subway',
      name: 'Miromesnil',
      ref: '9, 13',
    },
  },
  {
    type: 'node' as const,
    id: 101,
    lat: 48.873,
    lon: 2.3185,
    tags: {
      railway: 'tram_stop',
      name: 'Saint-Augustin',
    },
  },
  // Heavy-rail station without `station` tag (Gare Saint-Lazare).
  {
    type: 'node' as const,
    id: 102,
    lat: 48.8755,
    lon: 2.3245,
    tags: { railway: 'station', name: 'Gare Saint-Lazare' },
  },
];

const handlers = [
  http.post(TEST_ENDPOINT, async ({ request }) => {
    // Body is `data=<URL-encoded QL>` (application/x-www-form-urlencoded).
    const raw = await request.text();
    const params = new URLSearchParams(raw);
    const ql = params.get('data') ?? '';
    if (ql.includes('"amenity"="pharmacy"') || ql.includes('"amenity"="bakery"')) {
      return HttpResponse.json({ version: 0.6, generator: 'mock', elements: AMENITY_NODES });
    }
    if (ql.includes('"railway"="tram_stop"') || ql.includes('"railway"="station"')) {
      return HttpResponse.json({ version: 0.6, generator: 'mock', elements: TRANSIT_NODES });
    }
    if (ql.includes('TIMEOUT_MARKER')) {
      // Overpass timeout quirk: HTTP 200 with a tiny string body that
      // does NOT match the OverpassResponse schema.
      return HttpResponse.json({ runtime_error: 'Query timed out' });
    }
    return HttpResponse.json({ elements: [] });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(48.8721, 2.3157, 48.8721, 2.3157)).toBe(0);
  });
  it('matches the known distance Paris → Lyon (~390 km)', () => {
    const d = haversineMeters(48.8566, 2.3522, 45.764, 4.8357);
    expect(d).toBeGreaterThan(385_000);
    expect(d).toBeLessThan(395_000);
  });
});

describe('fetchAmenitiesAround', () => {
  it('normalises, sorts by distance, drops invalid entries', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON, {
      radiusMeters: 800,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 6 raw nodes: 1 missing name, 1 unknown amenity → 4 valid.
    expect(res.value).toHaveLength(4);
    // Sorted by distanceMeters ascending.
    for (let i = 1; i < res.value.length; i++) {
      expect(res.value[i]!.distanceMeters).toBeGreaterThanOrEqual(res.value[i - 1]!.distanceMeters);
    }
    // First entry should carry the rich tags from node id=1.
    const pharma = res.value.find((a) => a.tag === 'pharmacy' && a.name.includes('Faubourg'));
    expect(pharma).toBeDefined();
    expect(pharma?.openingHours).toBe('Mo-Sa 09:00-19:30');
    expect(pharma?.phone).toBe('+33 1 42 65 12 34');
    expect(pharma?.website).toBe('https://pharmacie-faubourg.fr');
  });

  it('omits malformed website but keeps the row', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON, {
      radiusMeters: 800,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const atm = res.value.find((a) => a.tag === 'atm');
    expect(atm).toBeDefined();
    expect(atm?.website).toBeUndefined();
  });

  it('builds streetAddress from housenumber + street tags', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const supermarket = res.value.find((a) => a.tag === 'supermarket');
    expect(supermarket?.streetAddress).toBe('109 Rue du Faubourg Saint-Honoré');
  });

  it('rejects radii outside the allowed range without hitting the network', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON, {
      radiusMeters: 100_000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('parse_failure');
  });

  it('returns [] when no tags are requested', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON, { tags: [] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });

  it('caps the result at limit', async () => {
    const res = await fetchAmenitiesAround(cfg, ANCHOR_LAT, ANCHOR_LON, { limit: 2 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
  });
});

describe('fetchTransitStationsAround', () => {
  it('returns normalised transit stations sorted by distance', async () => {
    const res = await fetchTransitStationsAround(cfg, ANCHOR_LAT, ANCHOR_LON, {
      radiusMeters: 800,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(3);
    const modes = res.value.map((s) => s.mode);
    expect(modes).toContain('subway');
    expect(modes).toContain('tram');
    expect(modes).toContain('rail');
    const miromesnil = res.value.find((s) => s.name === 'Miromesnil');
    expect(miromesnil?.lineRef).toBe('9, 13');
  });

  it('returns [] when no modes are requested', async () => {
    const res = await fetchTransitStationsAround(cfg, ANCHOR_LAT, ANCHOR_LON, { modes: [] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });
});
