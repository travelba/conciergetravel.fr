/**
 * Wikimedia Commons types (skill: api-integration).
 *
 * The MediaWiki Action API endpoint (`https://commons.wikimedia.org/w/api.php`)
 * returns dynamic shapes with optional fields. We narrow them with Zod
 * to typed safe-parse so the rest of the pipeline never reads `any`.
 */
import { z } from 'zod';

/**
 * `?action=query&list=categorymembers&...` shape.
 *
 * Each member of `categorymembers` is a `pageid` + `title` (with the
 * `File:` prefix). `cmcontinue` is the opaque pagination cursor — we
 * follow it transparently inside `fetchCategoryPhotos`.
 */
export const CategoryMembersResponseSchema = z.object({
  continue: z.object({ cmcontinue: z.string() }).partial().optional(),
  query: z
    .object({
      categorymembers: z
        .array(
          z.object({
            pageid: z.number(),
            ns: z.number().optional(),
            title: z.string(),
          }),
        )
        .default([]),
    })
    .default({ categorymembers: [] }),
});
export type CategoryMembersResponse = z.infer<typeof CategoryMembersResponseSchema>;

/**
 * `?action=query&titles=...&prop=imageinfo&iiprop=...` shape.
 *
 * `pages` is a `Record<pageId, page>` historically, but the API can also
 * return it as an array when `formatversion=2` is set. We force
 * `formatversion=2` to always get an array, simpler to iterate.
 *
 * The `extmetadata` field is open-ended; we only pluck the few keys
 * that matter for license tracking + alt-text seeding.
 */
const ImageInfoSchema = z.object({
  url: z.string().url().optional(),
  thumburl: z.string().url().optional(),
  thumbwidth: z.number().optional(),
  thumbheight: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  size: z.number().optional(),
  mime: z.string().optional(),
  extmetadata: z
    .object({
      Artist: z.object({ value: z.string() }).partial().optional(),
      LicenseShortName: z.object({ value: z.string() }).partial().optional(),
      LicenseUrl: z.object({ value: z.string() }).partial().optional(),
      ImageDescription: z.object({ value: z.string() }).partial().optional(),
      ObjectName: z.object({ value: z.string() }).partial().optional(),
    })
    .partial()
    .optional(),
});

export const ImageInfoResponseSchema = z.object({
  query: z
    .object({
      pages: z
        .array(
          z.object({
            pageid: z.number(),
            ns: z.number().optional(),
            title: z.string(),
            imageinfo: z.array(ImageInfoSchema).default([]),
          }),
        )
        .default([]),
    })
    .default({ pages: [] }),
});
export type ImageInfoResponse = z.infer<typeof ImageInfoResponseSchema>;

/**
 * Normalised photo shape exposed to consumers (the pipeline orchestrator).
 *
 * We always provide a `downloadUrl` that the orchestrator can stream to
 * Cloudinary; `thumbUrl` is the bandwidth-friendly preview for dry-runs.
 * `license` is mandatory — Commons content is always under a permissive
 * licence but it must be attributed, so we surface it explicitly.
 */
export const NormalisedCommonsPhotoSchema = z.object({
  pageId: z.number(),
  title: z.string(),
  downloadUrl: z.string().url(),
  thumbUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime: z.string().min(3),
  license: z.string().min(2),
  licenseUrl: z.string().url().optional(),
  attribution: z.string().optional(),
  description: z.string().optional(),
});
export type NormalisedCommonsPhoto = z.infer<typeof NormalisedCommonsPhotoSchema>;

/**
 * MIME types Cloudinary accepts for hotel imagery. We exclude SVG, GIF
 * (animated) and audio/video which sometimes slip into Commons
 * categories ("Category:Hôtel X" can contain a sound clip of the
 * hotel jingle, for example).
 */
export const ALLOWED_IMAGE_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);
