/**
 * Google Places (New) v1 client — hotel photo discovery
 * (skill: api-integration).
 *
 * Two endpoints:
 *
 *   1. POST /v1/places:searchText
 *      Body: { textQuery: "Le Bristol Paris, Paris" }
 *      Header: X-Goog-Api-Key, X-Goog-FieldMask: places.id,places.displayName,places.photos
 *      Returns: { places: [{ id, displayName, photos: [{ name, widthPx, heightPx, authorAttributions }] }] }
 *
 *   2. GET  /v1/{photo.name}/media?maxWidthPx=1600&skipHttpRedirect=true
 *      Header: X-Goog-Api-Key
 *      Returns: { name, photoUri }
 *      → photoUri is a temporary signed URL we forward to Cloudinary.
 *
 * Cost (as of 2026): Text Search = $32/1k requests, Place Photo = $7/1k.
 * For ~100 hotels with up to 10 photos each → 100 searches + 1k photos
 * = $3.20 + $7 = $10.20. Inside the $200 monthly Maps credit by far.
 */

import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '../http/retry-request.js';

import type { GooglePlacesError } from './errors.js';
import {
  type NormalisedPlacesPhoto,
  NormalisedPlacesPhotoSchema,
  PhotoMediaResponseSchema,
  type PlacePhoto,
  type PlaceSearchResult,
  TextSearchResponseSchema,
} from './types.js';

export interface GooglePlacesClientConfig {
  readonly apiBase: string;
  readonly apiKey: string;
}

export const DEFAULT_PLACES_API_BASE = 'https://places.googleapis.com/v1';

export function defaultPlacesConfig(apiKey: string): GooglePlacesClientConfig {
  return { apiBase: DEFAULT_PLACES_API_BASE, apiKey };
}

/**
 * Cheap heuristic to flag "this Google place is probably the hotel".
 *
 * The Text Search API can return restaurants, viewpoints or a tourist
 * landmark named after the hotel — they all have `Hôtel de Crillon`
 * in the displayName. We accept the first match whose name contains a
 * normalised version of the hotel name's first significant token.
 */
function tokenise(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 3 && t !== 'hotel' && t !== 'hôtel');
}

function looksLikeMatch(needle: string, candidate: string): boolean {
  const needleTokens = tokenise(needle);
  const candidateText = tokenise(candidate).join(' ');
  // Require at least 50% of the significant tokens to appear in the
  // candidate (loose match — names vary wildly: "Le Bristol Paris" vs
  // "Hotel Le Bristol" vs "Le Bristol — A Oetker Collection Hotel").
  const hits = needleTokens.filter((t) => candidateText.includes(t)).length;
  return needleTokens.length === 0 ? false : hits / needleTokens.length >= 0.5;
}

/**
 * Search Google Places for an hotel by name + city.
 *
 * Returns the first plausibly-matching place. Use this to discover the
 * `placeId` for hotels that don't have a `commons_category` set —
 * which is most stubs and a handful of palaces.
 */
export async function searchPlaceByNameAndCity(
  cfg: GooglePlacesClientConfig,
  hotelName: string,
  city: string,
): Promise<Result<PlaceSearchResult, GooglePlacesError>> {
  const query = `${hotelName}, ${city}`;
  const res = await retryingJsonRequest({
    url: `${cfg.apiBase}/places:searchText`,
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': cfg.apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos',
      Accept: 'application/json',
    },
    body: { kind: 'json', value: { textQuery: query, languageCode: 'fr' } },
  });
  if (!res.ok) {
    if (res.error.kind === 'auth_failed') return err({ kind: 'auth_failed' });
    if (res.error.kind === 'rate_limited') return err({ kind: 'quota_exceeded' });
    return err({ kind: 'http', error: res.error });
  }
  if (res.value.json === undefined) return err({ kind: 'no_match', query });

  const parsed = TextSearchResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: `searchText schema mismatch: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    });
  }
  if (parsed.data.places.length === 0) return err({ kind: 'no_match', query });

  // Prefer a match whose displayName tokens align with the hotel name.
  const ranked = parsed.data.places
    .map((p) => ({ place: p, score: looksLikeMatch(hotelName, p.displayName?.text ?? '') ? 1 : 0 }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (top === undefined || top.score === 0) {
    // Fall back to the first result anyway — Google's ranking is
    // usually good for an exact-name query.
    const firstPlace = parsed.data.places[0];
    if (firstPlace === undefined) return err({ kind: 'no_match', query });
    return ok(firstPlace);
  }
  return ok(top.place);
}

// ---------------------------------------------------------------------------
// Geocoding helper — extends searchText with `places.location` in the FieldMask.
// ---------------------------------------------------------------------------

export interface GeocodeMatch {
  readonly placeId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly formattedAddress: string | null;
  readonly displayName: string | null;
  /** `'name_match'` when the heuristic accepted the result; `'fallback'` for top-1. */
  readonly confidence: 'name_match' | 'fallback';
}

/**
 * Geocode a hotel from `name + city` (+ optional country).
 *
 * Sister of {@link searchPlaceByNameAndCity} — same Text Search endpoint,
 * same fuzzy match heuristic, just a different `FieldMask` so the
 * response includes `places.location`. We expose this as a dedicated
 * function (rather than overloading the photo helper) so the geocoding
 * orchestrator stays decoupled from the photo pipeline — they have
 * different rate limits and different failure modes.
 *
 * Cost: Text Search SKU = $32 / 1k requests (≈ $0.003 per hotel).
 * For the 70 stars5 stubs missing lat/lng → $0.21.
 */
export async function geocodeHotelQuery(
  cfg: GooglePlacesClientConfig,
  hotelName: string,
  city: string,
  options: { readonly country?: string } = {},
): Promise<Result<GeocodeMatch, GooglePlacesError>> {
  const country = options.country ?? 'France';
  const query = `${hotelName}, ${city}, ${country}`;
  const res = await retryingJsonRequest({
    url: `${cfg.apiBase}/places:searchText`,
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': cfg.apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location',
      Accept: 'application/json',
    },
    body: {
      kind: 'json',
      value: {
        textQuery: query,
        languageCode: 'fr',
        // Bias toward hotel-like results — cuts the false-positive rate
        // on common hotel names ("Le Provençal" returns 30+ restaurants
        // otherwise).
        includedType: 'lodging',
      },
    },
  });
  if (!res.ok) {
    if (res.error.kind === 'auth_failed') return err({ kind: 'auth_failed' });
    if (res.error.kind === 'rate_limited') return err({ kind: 'quota_exceeded' });
    return err({ kind: 'http', error: res.error });
  }
  if (res.value.json === undefined) return err({ kind: 'no_match', query });

  const parsed = TextSearchResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: `geocode schema mismatch: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    });
  }
  if (parsed.data.places.length === 0) return err({ kind: 'no_match', query });

  // Prefer a fuzzy-name match. Otherwise fall back to the top-1 — the
  // `includedType: lodging` already filtered out non-hotel results.
  const ranked = parsed.data.places.map((p) => ({
    place: p,
    matched: looksLikeMatch(hotelName, p.displayName?.text ?? ''),
  }));
  const winner =
    ranked.find((r) => r.matched)?.place ?? parsed.data.places[0];
  if (winner === undefined || winner.location === undefined) {
    return err({ kind: 'no_match', query });
  }
  const confidence = ranked[0]?.matched === true ? 'name_match' : 'fallback';
  return ok({
    placeId: winner.id,
    latitude: winner.location.latitude,
    longitude: winner.location.longitude,
    formattedAddress: winner.formattedAddress ?? null,
    displayName: winner.displayName?.text ?? null,
    confidence,
  });
}

/**
 * Resolve a Place Photo `name` into a downloadable URI.
 *
 * `skipHttpRedirect=true` is critical — without it the endpoint
 * 302-redirects to a CDN URL that requires keeping the original
 * headers, awkward to do in a Cloudinary upload context.
 */
async function resolvePhotoUri(
  cfg: GooglePlacesClientConfig,
  photoName: string,
  maxWidthPx: number,
): Promise<Result<string, GooglePlacesError>> {
  const url = `${cfg.apiBase}/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;
  const res = await retryingJsonRequest({
    url,
    method: 'GET',
    headers: { 'X-Goog-Api-Key': cfg.apiKey, Accept: 'application/json' },
    body: { kind: 'none' },
  });
  if (!res.ok) {
    if (res.error.kind === 'auth_failed') return err({ kind: 'auth_failed' });
    if (res.error.kind === 'rate_limited') return err({ kind: 'quota_exceeded' });
    return err({ kind: 'http', error: res.error });
  }
  if (res.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'empty photo media response' });
  }
  const parsed = PhotoMediaResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({ kind: 'parse_failure', details: 'photo media schema mismatch' });
  }
  return ok(parsed.data.photoUri);
}

/**
 * Fetch normalised photos for a place — bounded by `maxN`.
 *
 * Internally:
 *   1. Take up to `maxN` photos from the search result.
 *   2. For each, call the photo media endpoint to obtain a signed
 *      `photoUri`.
 *   3. Return the normalised shape (license = "Google Places",
 *      attribution = first authorAttribution.displayName).
 *
 * Sequential (no concurrency) to avoid the 60 QPM cap on the photo
 * endpoint. For ~10 photos / hotel that's < 1s overhead.
 */
export async function fetchPlacePhotos(
  cfg: GooglePlacesClientConfig,
  photos: readonly PlacePhoto[],
  maxN: number,
  maxWidthPx = 1600,
): Promise<Result<NormalisedPlacesPhoto[], GooglePlacesError>> {
  if (maxN <= 0 || photos.length === 0) return ok([]);

  const out: NormalisedPlacesPhoto[] = [];
  for (const photo of photos.slice(0, maxN)) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential
    const uri = await resolvePhotoUri(cfg, photo.name, maxWidthPx);
    if (!uri.ok) {
      // We don't fail the whole batch on a single photo error — Google
      // sometimes returns 404 for photos with revoked permissions.
      continue;
    }
    const author = photo.authorAttributions[0];
    const candidate = {
      photoName: photo.name,
      downloadUrl: uri.value,
      width: photo.widthPx ?? maxWidthPx,
      height: photo.heightPx ?? maxWidthPx,
      license: 'Google Places' as const,
      ...(author?.displayName !== undefined ? { attribution: author.displayName } : {}),
      ...(author?.uri !== undefined ? { attributionUri: author.uri } : {}),
    };
    const parsed = NormalisedPlacesPhotoSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return ok(out);
}
