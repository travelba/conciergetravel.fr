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

import type { CloudinaryError } from './errors';
import {
  CloudinaryResourceSchema,
  CloudinaryResourcesPageSchema,
  CloudinaryUploadResultSchema,
  type CloudinaryUploadInput,
  type CloudinaryUploadResult,
} from './types';

export interface CloudinaryClientConfig {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

/**
 * Bytes ceiling for a single upload. The Plus tier caps single-upload at
 * 20 MB (`media_limits.image_max_size_bytes`). Upstream integrations
 * already hand us sized thumbs (Commons 1600px, Places maxWidthPx) so
 * real payloads sit well under this, but we guard before uploading to
 * avoid wasting a round-trip on a pathological original.
 */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Ceiling on the *raw* source bytes we fetch. We upload the bytes as a
 * base64 data URI, which inflates the POST payload by ~33 %, so the raw
 * original must stay under ≈14.5 MB to land below Cloudinary's 20 MB POST
 * limit. Hotel thumbs (Commons 1600px, Places) are far smaller; this only
 * drops pathological full-resolution Commons originals.
 */
const MAX_SOURCE_BYTES = 14 * 1024 * 1024;

/**
 * User-Agent for fetching source bytes ourselves.
 *
 * Root-cause (2026-05-31): passing a Commons URL to Cloudinary's remote
 * fetcher made *Wikimedia* return `429 Too Many Requests` (Cloudinary's
 * shared egress IP/UA is rate-limited by Commons). The SDK surfaced this
 * as `http_code: 400, message: "...429 Too Many Requests"`, which our
 * mapper read as a Cloudinary `rate_limited` — a red herring that no plan
 * upgrade could fix. Fetching the bytes ourselves with a descriptive,
 * policy-compliant User-Agent (Wikimedia UA policy) returns 200, and we
 * then hand the bytes to Cloudinary (no second source fetch).
 */
const SOURCE_UA =
  'MyConciergeHotelBot/1.0 (+https://myconciergehotel.com; contact: tech@myconciergehotel.com)';

/** Per-attempt timeout for the source byte fetch. */
const SOURCE_FETCH_TIMEOUT_MS = 20_000;

/** Retries when the SOURCE host (Commons, lh3, …) throttles or 5xxs. */
const SOURCE_FETCH_RETRIES = 4;

/** Parses a `Retry-After` header (delta-seconds form) into milliseconds. */
function parseRetryAfterMs(header: string | null): number | null {
  if (header === null) return null;
  const secs = Number.parseInt(header.trim(), 10);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs, 60) * 1000;
  return null;
}

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
    const obj = e as {
      message?: unknown;
      http_code?: unknown;
      error?: { message?: unknown; http_code?: unknown };
    };
    const nested = obj.error;
    const msg =
      typeof nested?.message === 'string'
        ? nested.message
        : typeof obj.message === 'string'
          ? obj.message
          : null;
    if (msg !== null) raw = msg;
    const code =
      typeof nested?.http_code === 'number'
        ? nested.http_code
        : typeof obj.http_code === 'number'
          ? obj.http_code
          : undefined;
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
 * Fetches the source image bytes ourselves and returns them as a base64
 * data URI ready to hand to Cloudinary's uploader.
 *
 * This is the surface that actually gets throttled (Commons 429), so the
 * exponential back-off + `Retry-After` handling lives here, not around the
 * Cloudinary call. A `429`/`5xx` that survives all retries is reported as
 * `rate_limited`; a `404`/`410` as `source_unreachable`; an oversize body
 * as `asset_too_large` (checked before the upload round-trip).
 */
async function fetchSourceBytes(
  url: string,
): Promise<Result<{ readonly dataUri: string; readonly bytes: number }, CloudinaryError>> {
  let lastMessage = 'source fetch failed';
  for (let attempt = 0; attempt <= SOURCE_FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, SOURCE_FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': SOURCE_UA, Accept: 'image/*' },
        signal: controller.signal,
        redirect: 'follow',
      });

      if (resp.status === 429 || resp.status >= 500) {
        lastMessage = `source returned ${resp.status}`;
        if (attempt === SOURCE_FETCH_RETRIES) return err({ kind: 'rate_limited' });
        const retryAfter = parseRetryAfterMs(resp.headers.get('retry-after'));
        const backoff = 1500 * 2 ** attempt + Math.floor(Math.random() * 500);
        await sleep(retryAfter ?? backoff);
        continue;
      }
      if (resp.status === 404 || resp.status === 410) {
        return err({ kind: 'source_unreachable', url });
      }
      if (!resp.ok) {
        return err({ kind: 'unknown', message: `source http ${resp.status}` });
      }

      const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return err({
          kind: 'unsupported_format',
          format: contentType.split(';')[0] ?? contentType,
        });
      }
      const arrayBuffer = await resp.arrayBuffer();
      const bytes = arrayBuffer.byteLength;
      if (bytes === 0) return err({ kind: 'source_unreachable', url });
      if (bytes > MAX_SOURCE_BYTES) return err({ kind: 'asset_too_large', bytes });

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return ok({ dataUri: `data:${contentType};base64,${base64}`, bytes });
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : 'source fetch threw';
      if (attempt === SOURCE_FETCH_RETRIES) return err({ kind: 'source_unreachable', url });
      await sleep(1500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return err({ kind: 'unknown', message: lastMessage.slice(0, 200) });
}

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

  const tags = [
    tagify(input.hotelSlug),
    tagify(input.source),
    ...(input.extraTags ?? []).map(tagify),
  ].filter((t) => t.length > 0);

  const contextParts: string[] = [
    `alt=${altFr.replace(/[|=]/gu, ' ')}`,
    `alt_fr=${altFr.replace(/[|=]/gu, ' ')}`,
  ];
  if (altEn !== undefined && altEn.length > 0) {
    contextParts.push(`alt_en=${altEn.replace(/[|=]/gu, ' ')}`);
  }
  if (input.category !== undefined && input.category.length > 0) {
    contextParts.push(`category=${input.category.replace(/[|=]/gu, '_')}`);
  }
  const context = contextParts.join('|');

  // Fetch the source bytes ourselves (policy-compliant UA) so Cloudinary
  // never re-fetches the source — this is what was triggering Commons 429.
  const fetched = await fetchSourceBytes(input.sourceUrl);
  if (!fetched.ok) return err(fetched.error);
  const uploadPayload = fetched.value.dataUri;

  let lastError: CloudinaryError | null = null;
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    try {
      const sdkResult = await cloudinaryV2.uploader.upload(uploadPayload, {
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

/** Intrinsic pixel dimensions of a stored Cloudinary asset. */
export interface AssetDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Maps a thrown Cloudinary Admin SDK error to our typed union.
 *
 * Unlike `mapSdkError` this has no source URL context (admin reads are
 * not tied to a single upload), so `404`/auth/rate-limit are the only
 * meaningful discriminations.
 */
function mapAdminError(e: unknown): CloudinaryError {
  let raw = 'unknown admin error';
  let httpCode: number | undefined;
  if (e instanceof Error) raw = e.message;
  else if (typeof e === 'object' && e !== null) {
    const obj = e as { message?: unknown; http_code?: unknown; error?: { message?: unknown } };
    if (typeof obj.error?.message === 'string') raw = obj.error.message;
    else if (typeof obj.message === 'string') raw = obj.message;
    if (typeof obj.http_code === 'number') httpCode = obj.http_code;
  } else if (typeof e === 'string') raw = e;
  const lower = raw.toLowerCase();
  if (httpCode === 401 || lower.includes('invalid signature') || lower.includes('invalid api')) {
    return { kind: 'auth_failed' };
  }
  if (httpCode === 420 || httpCode === 429 || lower.includes('rate limit')) {
    return { kind: 'rate_limited' };
  }
  return { kind: 'unknown', message: raw.slice(0, 280) };
}

/**
 * Lists every uploaded image under `prefix` (e.g. `cct/hotels/`) and
 * returns a `public_id → {width,height}` map built from the Admin API.
 *
 * Pages through the Admin API 500 at a time (the per-call ceiling).
 * Resources that fail `CloudinaryResourceSchema` (missing positive
 * dimensions) are skipped rather than aborting the whole listing.
 *
 * NB: the Cloudinary Admin API is rate-limited (free tier ≈ 500 calls/h);
 * a 23 k-asset catalogue is ~46 pages, well within budget. On a
 * `rate_limited` page the caller can re-run — the map is rebuilt from
 * scratch each time (cheap, idempotent).
 */
export async function listUploadedDimensions(
  prefix: string,
  onPage?: (pageCount: number, total: number) => void,
): Promise<Result<Map<string, AssetDimensions>, CloudinaryError>> {
  const out = new Map<string, AssetDimensions>();
  let cursor: string | undefined;
  for (;;) {
    let raw: unknown;
    try {
      raw = await cloudinaryV2.api.resources({
        resource_type: 'image',
        type: 'upload',
        prefix,
        max_results: 500,
        ...(cursor !== undefined ? { next_cursor: cursor } : {}),
      });
    } catch (e) {
      return err(mapAdminError(e));
    }
    const page = CloudinaryResourcesPageSchema.safeParse(raw);
    if (!page.success) {
      return err({ kind: 'unknown', message: 'Unexpected Admin API resources shape' });
    }
    for (const entry of page.data.resources) {
      const parsed = CloudinaryResourceSchema.safeParse(entry);
      if (parsed.success)
        out.set(parsed.data.public_id, { width: parsed.data.width, height: parsed.data.height });
    }
    if (onPage !== undefined) onPage(page.data.resources.length, out.size);
    if (page.data.next_cursor === undefined) break;
    cursor = page.data.next_cursor;
  }
  return ok(out);
}

/**
 * Build a `GalleryImageRow` from an upload result + input metadata —
 * shape ready for `UPDATE hotels SET gallery_images = jsonb_set(...)`.
 */
export function toGalleryRow(
  result: CloudinaryUploadResult,
  input: CloudinaryUploadInput,
): {
  readonly public_id: string;
  readonly alt_fr?: string;
  readonly alt_en?: string;
  readonly category?: string;
} {
  const altFr = stripHtml(input.altFr).slice(0, 200);
  const altEn = input.altEn !== undefined ? stripHtml(input.altEn).slice(0, 200) : undefined;
  return {
    public_id: result.public_id,
    ...(altFr.length > 0 ? { alt_fr: altFr } : {}),
    ...(altEn !== undefined && altEn.length > 0 ? { alt_en: altEn } : {}),
    ...(input.category !== undefined && input.category.length > 0
      ? { category: input.category }
      : {}),
  };
}
