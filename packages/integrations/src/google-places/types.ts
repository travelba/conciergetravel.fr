/**
 * Google Places (New) v1 — Zod types (skill: api-integration).
 *
 * Docs:
 *   - Search Text : https://developers.google.com/maps/documentation/places/web-service/text-search
 *   - Place Photos: https://developers.google.com/maps/documentation/places/web-service/place-photos
 *
 * Crucial: the **New** API (`places.googleapis.com/v1/*`) is different
 * from the legacy Places API. New API uses a `FieldMask` header to
 * narrow the response and a different photo URL convention.
 */
import { z } from 'zod';

/** Localised text used in `displayName`, `formattedAddress` etc. */
export const LocalizedTextSchema = z.object({
  text: z.string(),
  languageCode: z.string().optional(),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/**
 * Photo metadata returned by `searchText`. We only ask for the small
 * subset we care about via `X-Goog-FieldMask: places.id,places.displayName,places.photos`.
 *
 * `photo.name` is what we feed back into the photo-media endpoint:
 *   GET /v1/{photo.name}/media?maxWidthPx=1600&skipHttpRedirect=true
 *
 * `authorAttributions[]` carries display + URI — Google ToS requires
 * we attribute photo authors when surfacing the photo.
 */
const AuthorAttributionSchema = z.object({
  displayName: z.string().optional(),
  uri: z.string().url().optional(),
  photoUri: z.string().url().optional(),
});

export const PlacePhotoSchema = z.object({
  name: z.string().min(1), // "places/{placeId}/photos/{photoId}"
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  authorAttributions: z.array(AuthorAttributionSchema).default([]),
});
export type PlacePhoto = z.infer<typeof PlacePhotoSchema>;

export const PlaceLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type PlaceLocation = z.infer<typeof PlaceLocationSchema>;

export const PlaceSearchResultSchema = z.object({
  id: z.string().min(1),
  displayName: LocalizedTextSchema.optional(),
  formattedAddress: z.string().optional(),
  /** Only present when `places.location` is in the X-Goog-FieldMask. */
  location: PlaceLocationSchema.optional(),
  photos: z.array(PlacePhotoSchema).default([]),
});
export type PlaceSearchResult = z.infer<typeof PlaceSearchResultSchema>;

export const TextSearchResponseSchema = z.object({
  places: z.array(PlaceSearchResultSchema).default([]),
});
export type TextSearchResponse = z.infer<typeof TextSearchResponseSchema>;

export const PhotoMediaResponseSchema = z.object({
  // When `skipHttpRedirect=true`, the API returns a JSON body with the
  // signed photo URL. Otherwise it 302-redirects, which is harder to
  // capture cleanly in a Cloudinary upload pipeline.
  name: z.string().optional(),
  photoUri: z.string().url(),
});
export type PhotoMediaResponse = z.infer<typeof PhotoMediaResponseSchema>;

/**
 * Normalised shape mirroring `NormalisedCommonsPhoto` so the
 * orchestrator can treat both tiers uniformly. The `license` value is
 * `"Google Places"` — surfacing it in alt/context lets us comply
 * with Google's attribution policy and trace photo provenance
 * downstream.
 */
export const NormalisedPlacesPhotoSchema = z.object({
  photoName: z.string().min(1),
  downloadUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  attribution: z.string().optional(),
  attributionUri: z.string().url().optional(),
  license: z.literal('Google Places'),
});
export type NormalisedPlacesPhoto = z.infer<typeof NormalisedPlacesPhotoSchema>;

// ---------------------------------------------------------------------------
// Nearby Search (New) — POST /v1/places:searchNearby
// ---------------------------------------------------------------------------
//
// Used as the WORLDWIDE POI fallback for hotel detail pages when
// DATAtourisme (France-only) and Overpass (frequently throttled/down)
// return nothing. The New API exposes `primaryType` + `types[]` (Table A
// place types) which we map to the editorial visit/do/shop buckets.

/** One place returned by `places:searchNearby`. */
export const NearbyPlaceSchema = z.object({
  id: z.string().min(1),
  displayName: LocalizedTextSchema.optional(),
  location: PlaceLocationSchema.optional(),
  primaryType: z.string().optional(),
  types: z.array(z.string()).default([]),
});
export type NearbyPlace = z.infer<typeof NearbyPlaceSchema>;

export const NearbySearchResponseSchema = z.object({
  places: z.array(NearbyPlaceSchema).default([]),
});
export type NearbySearchResponse = z.infer<typeof NearbySearchResponseSchema>;

/**
 * Normalised nearby POI, runtime-agnostic, ready for the merge layer.
 * Distance is computed by the caller against the hotel anchor (the API
 * does not return a distance field).
 */
export const NormalisedPlacePoiSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  primaryType: z.string().optional(),
  types: z.array(z.string()).default([]),
});
export type NormalisedPlacePoi = z.infer<typeof NormalisedPlacePoiSchema>;

// ---------------------------------------------------------------------------
// Place Details (New) — GET /v1/places/{placeId}
// ---------------------------------------------------------------------------

const PlaceReviewAuthorSchema = z.object({
  displayName: z.string().optional(),
  uri: z.string().url().optional(),
  photoUri: z.string().url().optional(),
});

export const PlaceReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  text: LocalizedTextSchema.optional(),
  originalText: LocalizedTextSchema.optional(),
  authorAttribution: PlaceReviewAuthorSchema.optional(),
  publishTime: z.string().optional(),
  relativePublishTimeDescription: z.string().optional(),
});
export type PlaceReview = z.infer<typeof PlaceReviewSchema>;

export const PlaceDetailsSchema = z.object({
  id: z.string().min(1),
  displayName: LocalizedTextSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  reviews: z.array(PlaceReviewSchema).default([]),
  googleMapsUri: z.string().url().optional(),
  websiteUri: z.string().url().optional(),
});
export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;

/** Normalised review row persisted in `hotels.google_reviews` jsonb. */
export const StoredGoogleReviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  publish_time: z.string().optional(),
  language: z.string().optional(),
});
export type StoredGoogleReview = z.infer<typeof StoredGoogleReviewSchema>;

export const NormalisedPlaceDetailsSchema = z.object({
  placeId: z.string().min(1),
  displayName: z.string().optional(),
  rating: z.number().min(0).max(5).nullable(),
  userRatingCount: z.number().int().nonnegative().nullable(),
  reviews: z.array(StoredGoogleReviewSchema),
  googleMapsUri: z.string().url().nullable(),
  websiteUri: z.string().url().nullable(),
});
export type NormalisedPlaceDetails = z.infer<typeof NormalisedPlaceDetailsSchema>;
