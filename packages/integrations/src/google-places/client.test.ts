import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  defaultPlacesConfig,
  fetchPlacePhotos,
  searchPlaceByNameAndCity,
} from './client.js';

const cfg = { ...defaultPlacesConfig('TEST-KEY'), apiBase: 'https://places.test/v1' };

const PLACE_ID = 'ChIJTestPlaceId123';
const PHOTO_NAME = `places/${PLACE_ID}/photos/AABCxyz_photo_1`;

const handlers = [
  http.post('https://places.test/v1/places:searchText', async ({ request }) => {
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
