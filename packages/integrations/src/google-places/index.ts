/**
 * Google Places (New) v1 — hotel photo discovery + place search
 * (skill: api-integration).
 *
 * Wraps two endpoints:
 *   - places:searchText  → find placeId + photo names by hotel name/city
 *   - photo media        → resolve photo names into signed URLs
 *
 * Used by `scripts/editorial-pilot/src/photos/sync-hotel-photos.ts`
 * as the Tier 2 fallback when Wikimedia Commons returns < 5 photos.
 */
export const GPLACES_INTEGRATION_VERSION = '0.0.3' as const;

export type { GooglePlacesError } from './errors';
export {
  DEFAULT_NEARBY_POI_TYPES,
  DEFAULT_PLACES_API_BASE,
  defaultPlacesConfig,
  fetchPlaceDetails,
  fetchPlacePhotos,
  geocodeHotelQuery,
  searchNearbyPois,
  searchPlaceByNameAndCity,
  type GeocodeMatch,
  type GooglePlacesClientConfig,
  type NearbyPoiOptions,
} from './client';
export {
  NearbyPlaceSchema,
  NearbySearchResponseSchema,
  NormalisedPlaceDetailsSchema,
  NormalisedPlacePoiSchema,
  NormalisedPlacesPhotoSchema,
  PhotoMediaResponseSchema,
  PlaceDetailsSchema,
  PlaceLocationSchema,
  PlacePhotoSchema,
  PlaceReviewSchema,
  PlaceSearchResultSchema,
  StoredGoogleReviewSchema,
  TextSearchResponseSchema,
  type NearbyPlace,
  type NearbySearchResponse,
  type NormalisedPlaceDetails,
  type NormalisedPlacePoi,
  type NormalisedPlacesPhoto,
  type PlaceDetails,
  type PlaceLocation,
  type PlacePhoto,
  type PlaceReview,
  type PlaceSearchResult,
  type StoredGoogleReview,
  type TextSearchResponse,
} from './types';
