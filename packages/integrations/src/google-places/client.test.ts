import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  defaultPlacesConfig,
  fetchPlaceDetails,
  fetchPlacePhotos,
  searchNearbyPois,
  searchPlaceByNameAndCity,
} from './client';

const cfg = { ...defaultPlacesConfig('TEST-KEY'), apiBase: 'https://places.test/v1' };

const PLACE_ID = 'ChIJTestPlaceId123';
const PHOTO_NAME = `places/${PLACE_ID}/photos/AABCxyz_photo_1`;

const handlers = [
  // NB: a literal colon in an MSW string path (`places:searchText`) is
  // parsed as a `:searchText` path param and would also swallow
  // `places:searchNearby`. Anchored RegExp matchers avoid the collision.
  http.post(/\/v1\/places:searchText$/u, async ({ request }) => {
    const body = (await request.json()) as { textQuery?: string };
    const q = body.textQuery ?? '';
    if (q.includes('Empty Match')) {
      return HttpResponse.json({ places: [] });
    }
    if (q.includes('Unauthorized')) {
      return HttpResponse.json({ error: { code: 401, message: 'Invalid key' } }, { status: 401 });
    }
    return HttpResponse.json({
      places: [
        {
          id: PLACE_ID,
          displayName: { text: 'Hôtel Le Bristol Paris', languageCode: 'fr' },
          formattedAddress: '112 Rue du Faubourg Saint-Honoré, 75008 Paris, France',
          photos: [
            {
              name: PHOTO_NAME,
              widthPx: 4032,
              heightPx: 3024,
              authorAttributions: [
                {
                  displayName: 'Jane Photographer',
                  uri: 'https://maps.google.com/maps/contrib/123/photos',
                },
              ],
            },
            {
              name: `places/${PLACE_ID}/photos/PHOTO_2`,
              widthPx: 1600,
              heightPx: 1067,
              authorAttributions: [],
            },
          ],
        },
        // Decoy result that doesn't match the hotel name — should be deprioritised.
        {
          id: 'DECOY',
          displayName: { text: 'Bistrot du Coin' },
          photos: [],
        },
      ],
    });
  }),
  http.get(`https://places.test/v1/${PHOTO_NAME}/media`, () =>
    HttpResponse.json({
      name: PHOTO_NAME,
      photoUri: 'https://lh3.googleusercontent.com/places-cdn/test-signed-url-12345.jpg',
    }),
  ),
  http.get(`https://places.test/v1/places/${PLACE_ID}/photos/PHOTO_2/media`, () =>
    HttpResponse.json({
      photoUri: 'https://lh3.googleusercontent.com/places-cdn/test-signed-url-67890.jpg',
    }),
  ),
  http.get(`https://places.test/v1/places/${PLACE_ID}`, () =>
    HttpResponse.json({
      id: PLACE_ID,
      displayName: { text: 'Hôtel Le Bristol Paris', languageCode: 'fr' },
      rating: 4.8,
      userRatingCount: 842,
      googleMapsUri: 'https://maps.google.com/?cid=123456789',
      websiteUri: 'https://www.oetkercollection.com/hotels/le-bristol-paris/',
      reviews: [
        {
          rating: 5,
          text: { text: 'Un palace exceptionnel.', languageCode: 'fr' },
          authorAttribution: { displayName: 'Marie L.' },
          publishTime: '2026-01-15T10:00:00Z',
        },
        {
          rating: 4,
          originalText: { text: 'Lovely stay.', languageCode: 'en' },
          authorAttribution: { displayName: 'John D.' },
        },
        { rating: 3, text: { text: '' } },
      ],
    }),
  ),
  http.post(/\/v1\/places:searchNearby$/u, async ({ request }) => {
    const body = (await request.json()) as {
      locationRestriction?: { circle?: { radius?: number } };
    };
    // A degenerate radius is our "empty result" trigger for the test.
    if (body.locationRestriction?.circle?.radius === 1) {
      return HttpResponse.json({});
    }
    return HttpResponse.json({
      places: [
        {
          id: 'POI_MUSEUM',
          displayName: { text: 'Museo Nazionale', languageCode: 'it' },
          location: { latitude: 45.4642, longitude: 9.19 },
          primaryType: 'museum',
          types: ['museum', 'tourist_attraction'],
        },
        {
          id: 'POI_PARK',
          displayName: { text: 'Parco Sempione' },
          location: { latitude: 45.4725, longitude: 9.1772 },
          primaryType: 'park',
          types: ['park'],
        },
        // No location → must be dropped by the normaliser.
        {
          id: 'POI_NOLOC',
          displayName: { text: 'Ghost POI' },
          primaryType: 'tourist_attraction',
          types: ['tourist_attraction'],
        },
      ],
    });
  }),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('searchPlaceByNameAndCity', () => {
  it('returns the matching place, preferring a name overlap over a decoy', async () => {
    const res = await searchPlaceByNameAndCity(cfg, 'Le Bristol Paris', 'Paris');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.id).toBe(PLACE_ID);
    expect(res.value.photos).toHaveLength(2);
  });

  it('returns no_match when Places returns an empty list', async () => {
    const res = await searchPlaceByNameAndCity(cfg, 'Empty Match Hotel', 'Nowhere');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('no_match');
  });

  it('maps 401 to auth_failed', async () => {
    const res = await searchPlaceByNameAndCity(cfg, 'Unauthorized Hotel', 'Paris');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('auth_failed');
  });
});

describe('fetchPlacePhotos', () => {
  it('resolves signed photo URIs and returns normalised photos', async () => {
    const search = await searchPlaceByNameAndCity(cfg, 'Le Bristol Paris', 'Paris');
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    const res = await fetchPlacePhotos(cfg, search.value.photos, 5);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(res.value[0]?.downloadUrl).toMatch(/^https:\/\/lh3\.googleusercontent\.com\//u);
    expect(res.value[0]?.license).toBe('Google Places');
    expect(res.value[0]?.attribution).toBe('Jane Photographer');
  });

  it('returns an empty array when maxN is 0', async () => {
    const res = await fetchPlacePhotos(cfg, [{ name: 'ignored', authorAttributions: [] }], 0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });
});

describe('fetchPlaceDetails', () => {
  it('returns normalised rating, counts and up to 5 stored reviews', async () => {
    const res = await fetchPlaceDetails(cfg, PLACE_ID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.placeId).toBe(PLACE_ID);
    expect(res.value.rating).toBe(4.8);
    expect(res.value.userRatingCount).toBe(842);
    expect(res.value.reviews).toHaveLength(2);
    expect(res.value.reviews[0]?.author).toBe('Marie L.');
    expect(res.value.websiteUri).toMatch(/^https:\/\//u);
    expect(res.value.googleMapsUri).toMatch(/^https:\/\//u);
  });
});

describe('searchNearbyPois', () => {
  it('normalises nearby POIs and drops entries without a location', async () => {
    const res = await searchNearbyPois(cfg, 45.4642, 9.19, { radiusMeters: 1500 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(res.value[0]?.placeId).toBe('POI_MUSEUM');
    expect(res.value[0]?.primaryType).toBe('museum');
    expect(res.value.map((p) => p.placeId)).not.toContain('POI_NOLOC');
  });

  it('returns an empty list (not an error) when Google has no POIs in radius', async () => {
    const res = await searchNearbyPois(cfg, 0, 0, { radiusMeters: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });
});
