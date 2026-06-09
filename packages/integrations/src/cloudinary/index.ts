/**
 * Cloudinary integration (skill: api-integration).
 *
 * Consumed by `scripts/photos/sync-hotel-photos.ts` to push the
 * results of WS1 (Wikimedia Commons) + WS2 (Google Places) into the
 * `cct/hotels/{slug}/` folder.
 */
export const CLOUDINARY_INTEGRATION_VERSION = '0.0.1' as const;

export type { CloudinaryError } from './errors';
export {
  type AssetDimensions,
  type CloudinaryClientConfig,
  configureCloudinary,
  listUploadedDimensions,
  toGalleryRow,
  uploadFromLocalFile,
  uploadFromUrl,
} from './client';
export {
  CloudinaryResourceSchema,
  CloudinaryResourcesPageSchema,
  CloudinaryUploadResultSchema,
  type CloudinaryLocalUploadInput,
  type CloudinaryResource,
  type CloudinaryUploadInput,
  type CloudinaryUploadResult,
  type GalleryImageRow,
} from './types';
