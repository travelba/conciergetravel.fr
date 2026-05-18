/**
 * Cloudinary client (skill: api-integration).
 *
 * Thin wrapper around the official `cloudinary` Node SDK. We only
 * expose `uploadFromUrl` — the orchestrator never needs the full SDK
 * surface, and confining the usage here makes it easy to mock in
 * tests and to swap for an alternative provider later.
 *
 * Conventions
 * -----------
 * - Folder: `cct/hotels/{slug}/`
 * - public_id: `{source}-{index}` (e.g. `commons-1`, `places-3`)
 *   The full path that ends up in the DB is `cct/hotels/{slug}/{source}-{index}`.
 * - Tags: `[slug, source, ...extraTags]` (sluggable for search-by-tag).
 * - Context: `{ alt: altFr, alt_fr: altFr, alt_en?: altEn, category? }`.
 *   The `alt` key is recognised by Cloudinary's product gallery widget
 *   if we ever enable it.
 */
import { v2 as cloudinaryV2 } from 'cloudinary';
import { err, ok, type Result } from '@mch/domain/shared';

import type { CloudinaryError } from './errors.js';
import {
  CloudinaryUploadResultSchema,
  type CloudinaryUploadInput,
  type CloudinaryUploadResult,
} from './types.js';

export interface CloudinaryClientConfig {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

/**
 * Bytes ceiling for a single upload. The Cloudinary free tier hard-caps
 * single-upload at 10 MB; paid tiers go higher but we keep 10 MB as a
 * safe default because Commons sometimes ships 30-40 MB originals
 * (we always request the 1600px thumb so it should fit).
 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Allowed formats. Cloudinary detects them from the byte stream — we
 * reject GIF (animated, hotels don't benefit) and SVG (vector,
 * irrelevant for photography).
 */
const ALLOWED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif']);

/**
 * Slugifies an arbitrary string into a tag-safe token (Cloudinary tags
 * must match `^[A-Za-z0-9_-]+$`).
 */
function tagify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64);
}

/**
 * Strips HTML out of a string (Commons attribution often contains
 * `<a href>` wrappers). We keep the inner text so the author is still
 * credited.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&[a-z]+;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Maps a thrown Cloudinary SDK error to our typed union.
 *
 * The SDK throws plain `Error` instances whose `message` carries the
 * vendor-side reason — we keep the message for `unknown`/`auth_failed`
 * but never log it in the orchestrator (avoid leaking the URL of the
 * source asset if it happens to embed a session token).
 */
function mapSdkError(e: unknown, input: CloudinaryUploadInput): CloudinaryError {
  // The Cloudinary SDK throws a mix of plain Error objects AND plain
  // dict objects like `{ message, http_code, error: { ... } }`. Calling
  // String() on the dict yields the useless `"[object Object]"` literal,
  // so we drill down explicitly. We also handle `{ error: { message } }`
  // (the modern shape).
  let raw = 'unknown error';
  let httpCode: number | undefined;
  if (e instanceof Error) {
    raw = e.message;
  } else if (typeof e === 'object' && e !== null) {
    const obj = e as { message?: unknown; http_code?: unknown; error?: { message?: unknown; http_code?: unknown } };
    const nested = obj.error;
    const msg =
      typeof nested?.message === 'string'
        ? nested.message
        : typeof obj.message === 'string'
          ? obj.message
          : null;
    if (msg !== null) raw = msg;
    const code = typeof nested?.http_code === 'number' ? nested.http_code : typeof obj.http_code === 'number' ? obj.http_code : undefined;
    if (code !== undefined) httpCode = code;
  } else if (typeof e === 'string') {
    raw = e;
  }
  const lower = raw.toLowerCase();
  if (httpCode === 401 || lower.includes('invalid signature') || lower.includes('invalid api')) {
    return { kind: 'auth_failed' };
  }
  if (httpCode === 429 || lower.includes('rate limit') || lower.includes('too many requests')) {
    return { kind: 'rate_limited' };
  }
  if (
    httpCode === 404 ||
    lower.includes('not found') ||
    lower.includes('resource not accessible') ||
    lower.includes('host not allowed')
  ) {
    return { kind: 'source_unreachable', url: input.sourceUrl };
  }
  if (lower.includes('unsupported') || lower.includes('invalid image file')) {
    return { kind: 'unsupported_format', format: 'unknown' };
  }
  if (
    lower.includes('file size too large') ||
    lower.includes('too large') ||
    lower.includes('exceeds maximum')
  ) {
    return { kind: 'asset_too_large', bytes: MAX_UPLOAD_BYTES };
  }
  const codeSuffix = httpCode !== undefined ? ` [http=${httpCode}]` : '';
  return { kind: 'unknown', message: `${raw}${codeSuffix}`.slice(0, 280) };
}

/**
 * Initialise the Cloudinary SDK against the given credentials.
 *
 * The SDK keeps the config in a module-level singleton, so calling
 * `configure` multiple times with different cloud names within the
 * same process **does not** work (the second call wins for every
 * subsequent operation). Our orchestrator only targets one cloud at
 * a time so this is fine — but tests must reset between cases.
 */
export function configureCloudinary(cfg: CloudinaryClientConfig): void {
  cloudinaryV2.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
  });
}

/**
 * Sleep helper for retry back-off.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolveP) => {
    setTimeout(resolveP, ms);
  });
}

/**
 * Number of retries on `rate_limited` errors. Cloudinary free tier
 * throttles aggressively (sometimes 1 upload every 5-10s); a small
 * exponential back-off (2s, 4s, 8s, 16s, 32s) gets us through 109 ×
 * 12 = ~1300 uploads without manual babysitting. Production credits
 * tier has much higher limits, so this is effectively a no-op there.
 */
const RATE_LIMIT_RETRIES = 5;

/**
 * Upload an image from a public URL into the hotel folder.
 *
 * Idempotent: if a public_id already exists, Cloudinary overwrites
 * (because we pass `overwrite: true`) and returns the same `public_id`.
 * That lets the orchestrator re-run after a partial failure without
 * spawning duplicate assets.
 *
 * On `rate_limited` we retry with exponential back-off (free tier
 * commonly returns 420/429 after only a handful of uploads/min). On any
 * other error we surface immediately to the caller.
 */
export async function uploadFromUrl(
  input: CloudinaryUploadInput,
): Promise<Result<CloudinaryUploadResult, CloudinaryError>> {
  const folder = `cct/hotels/${input.hotelSlug}`;
  const publicIdShort = `${input.source}-${input.index}`;

  const altFr = stripHtml(input.altFr).slice(0, 200);
  const altEn = input.altEn !== undefined ? stripHtml(input.altEn).slice(0, 200) : undefined;

  const tags = [tagify(input.hotelSlug), tagify(input.source), ...(input.extraTags ?? []).map(tagify)].filter(
    (t) => t.length > 0,
  );

  const contextParts: string[] = [`alt=${altFr.replace(/[|=]/gu, ' ')}`, `alt_fr=${altFr.replace(/[|=]/gu, ' ')}`];
  if (altEn !== undefined && altEn.length > 0) {
    contextParts.push(`alt_en=${altEn.replace(/[|=]/gu, ' ')}`);
  }
  if (input.category !== undefined && input.category.length > 0) {
    contextParts.push(`category=${input.category.replace(/[|=]/gu, '_')}`);
  }
  const context = contextParts.join('|');

  let lastError: CloudinaryError | null = null;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    try {
      const sdkResult = await cloudinaryV2.uploader.upload(input.sourceUrl, {
        folder,
        public_id: publicIdShort,
        overwrite: true,
        resource_type: 'image',
        tags,
        context,
        // Limit oversize Commons originals — Cloudinary will pick the
        // appropriate inbound transformation. `c_limit` preserves AR.
        transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto:best' }],
      });

      const parsed = CloudinaryUploadResultSchema.safeParse(sdkResult);
      if (!parsed.success) {
        return err({
          kind: 'unknown',
          message: `Unexpected SDK shape: ${parsed.error.issues
            .slice(0, 2)
            .map((i) => i.message)
            .join(' | ')}`,
        });
      }

      if (!ALLOWED_FORMATS.has(parsed.data.format.toLowerCase())) {
        return err({ kind: 'unsupported_format', format: parsed.data.format });
      }
      if (parsed.data.bytes > MAX_UPLOAD_BYTES) {
        return err({ kind: 'asset_too_large', bytes: parsed.data.bytes });
      }
      return ok(parsed.data);
    } catch (e) {
      const mapped = mapSdkError(e, input);
      lastError = mapped;
      if (mapped.kind !== 'rate_limited' || attempt === RATE_LIMIT_RETRIES) {
        return err(mapped);
      }
      // Exponential back-off: 2s, 4s, 8s, 16s, 32s (max ~62s cumulative).
      const waitMs = 2000 * 2 ** attempt;
      await sleep(waitMs);
    }
  }
  return err(lastError ?? { kind: 'unknown', message: 'retry loop exited without resolution' });
}

/**
 * Build a `GalleryImageRow` from an upload result + input metadata —
 * shape ready for `UPDATE hotels SET gallery_images = jsonb_set(...)`.
 */
export function toGalleryRow(
  result: CloudinaryUploadResult,
  input: CloudinaryUploadInput,
): { readonly public_id: string; readonly alt_fr?: string; readonly alt_en?: string; readonly category?: string } {
  const altFr = stripHtml(input.altFr).slice(0, 200);
  const altEn = input.altEn !== undefined ? stripHtml(input.altEn).slice(0, 200) : undefined;
  return {
    public_id: result.public_id,
    ...(altFr.length > 0 ? { alt_fr: altFr } : {}),
    ...(altEn !== undefined && altEn.length > 0 ? { alt_en: altEn } : {}),
    ...(input.category !== undefined && input.category.length > 0 ? { category: input.category } : {}),
  };
}
