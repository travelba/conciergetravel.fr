/**
 * Wikimedia Commons integration (skill: api-integration).
 *
 * Tier 1 source for hotel photo hydration. See
 * `scripts/photos/sync-hotel-photos.ts` for the orchestrator that
 * combines Commons with Google Places.
 */
export const COMMONS_INTEGRATION_VERSION = '0.0.1' as const;

export type { CommonsError } from './errors.js';
export {
  type CommonsClientConfig,
  DEFAULT_COMMONS_API_BASE,
  DEFAULT_THUMB_WIDTH,
  buildCmTitle,
  defaultCommonsConfig,
  fetchCategoryPhotos,
} from './client.js';
export {
  ALLOWED_IMAGE_MIMES,
  CategoryMembersResponseSchema,
  ImageInfoResponseSchema,
  NormalisedCommonsPhotoSchema,
  type CategoryMembersResponse,
  type ImageInfoResponse,
  type NormalisedCommonsPhoto,
} from './types.js';
