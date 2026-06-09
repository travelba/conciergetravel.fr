/**
 * Cloudinary upload types (skill: api-integration).
 *
 * We expose a thin, opinionated wrapper around the Cloudinary Node
 * SDK that matches the field shape consumed by
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts`:
 *
 *   gallery_images: Array<{ public_id, alt_fr?, alt_en?, category? }>
 *   hero_image:     string (cloudinary public_id)
 *
 * Anything richer (full Cloudinary asset metadata) is dropped at the
 * boundary so the front-end never sees vendor-specific shapes.
 */
import { z } from 'zod';

/**
 * Folder convention: `cct/hotels/{slug}/`. Enforced by the upload
 * helper so we can later target a delete-all-by-folder for cleanup.
 */
export interface CloudinaryUploadInput {
  /** Public URL of the source image (e.g. Wikimedia thumb URL). */
  readonly sourceUrl: string;
  /** Hotel slug — drives the destination folder. */
  readonly hotelSlug: string;
  /** Provenance — `commons`, `places`, `press` (official media kit), `manual`. Used in `public_id` + tags. */
  readonly source: 'commons' | 'places' | 'press' | 'manual';
  /** 1-based index within the source batch (used in `public_id`). */
  readonly index: number;
  /** When set, replaces `{source}-{index}` as the Cloudinary asset name within the hotel folder. */
  readonly publicIdShort?: string;
  /** Alt text (French). Surfaced in `<HotelImage alt>`. */
  readonly altFr: string;
  /** Alt text (English). Falls back to `altFr` when omitted. */
  readonly altEn?: string;
  /** Optional category — `exterior | lobby | room | spa | …`. */
  readonly category?: string;
  /** Extra tags appended after the defaults `[hotelSlug, source]`. */
  readonly extraTags?: readonly string[];
}

/** Local file upload — same destination shape as {@link CloudinaryUploadInput}. */
export interface CloudinaryLocalUploadInput {
  /** Absolute or cwd-relative path to a JPEG/PNG/WebP on disk. */
  readonly localPath: string;
  readonly hotelSlug: string;
  readonly source: 'commons' | 'places' | 'press' | 'manual';
  readonly index: number;
  readonly publicIdShort?: string;
  readonly altFr: string;
  readonly altEn?: string;
  readonly category?: string;
  readonly extraTags?: readonly string[];
}

/**
 * Shape returned by `uploadFromUrl` — the bare minimum the orchestrator
 * needs to write `hero_image` and `gallery_images`.
 */
export const CloudinaryUploadResultSchema = z.object({
  public_id: z.string().min(1),
  secure_url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.string().min(1),
  resource_type: z.literal('image'),
});
export type CloudinaryUploadResult = z.infer<typeof CloudinaryUploadResultSchema>;

/**
 * Gallery entry stored in `public.hotels.gallery_images` (jsonb).
 * Mirrors `GalleryImageSchema` in
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts` lines 1113-1118.
 */
export interface GalleryImageRow {
  readonly public_id: string;
  readonly alt_fr?: string;
  readonly alt_en?: string;
  readonly category?: string;
}

/**
 * Single resource returned by the Cloudinary Admin API
 * (`GET /resources/image`). We only keep what the dimension backfill
 * needs — `public_id` + intrinsic `width`/`height` — and drop the
 * dozens of other vendor fields at the Zod boundary.
 *
 * A resource that lacks positive dimensions (rare: raw/incomplete
 * derivations) fails this schema and is skipped by the caller rather
 * than poisoning the map with `0`.
 */
export const CloudinaryResourceSchema = z.object({
  public_id: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type CloudinaryResource = z.infer<typeof CloudinaryResourceSchema>;

/**
 * One page of the Admin API `resources` listing. `next_cursor` is
 * present until the last page.
 */
export const CloudinaryResourcesPageSchema = z.object({
  resources: z.array(z.unknown()),
  next_cursor: z.string().optional(),
});
