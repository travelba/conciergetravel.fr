/**
 * Wikimedia Commons client (skill: api-integration).
 *
 * Public API — no auth required. We respect the MediaWiki user-agent
 * policy (https://meta.wikimedia.org/wiki/User-Agent_policy) by sending
 * a meaningful UA string identifying the project and a contact URL.
 *
 * Throttling: MediaWiki has no published QPS limit but is generally
 * tolerant of bursts up to ~5 req/s from a single IP. We serialise our
 * own calls (one in-flight per call site) and the orchestrator further
 * sleeps between hotels — see `scripts/photos/sync-hotel-photos.ts`.
 */

import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '../http/retry-request';

import type { CommonsError } from './errors';
import {
  ALLOWED_IMAGE_MIMES,
  CategoryMembersResponseSchema,
  ImageInfoResponseSchema,
  NormalisedCommonsPhotoSchema,
  type NormalisedCommonsPhoto,
} from './types';

export interface CommonsClientConfig {
  /** Default `https://commons.wikimedia.org/w/api.php`. Override in tests. */
  readonly apiBase: string;
  /**
   * User-Agent header — mandatory by MediaWiki policy. Must include a
   * project name and a contact URL. The orchestrator builds it from
   * the runtime env so it's traceable.
   */
  readonly userAgent: string;
  /** Pixel width requested for the Commons thumbnailer. 1600 = OG/social safe. */
  readonly thumbWidth: number;
}

export const DEFAULT_COMMONS_API_BASE = 'https://commons.wikimedia.org/w/api.php';
export const DEFAULT_THUMB_WIDTH = 1600;

export function defaultCommonsConfig(siteUrl: string): CommonsClientConfig {
  return {
    apiBase: DEFAULT_COMMONS_API_BASE,
    userAgent: `MyConciergeHotelBot/0.1 (${siteUrl}; tech@myconciergehotel.com) MediaWiki-Action-API`,
    thumbWidth: DEFAULT_THUMB_WIDTH,
  };
}

/**
 * Normalises a Commons category string for the `cmtitle` query param.
 *
 * Wikidata persists categories WITHOUT the `Category:` prefix (matches
 * the `hotels_commons_category_ck` DB CHECK constraint). MediaWiki
 * `cmtitle` requires the prefix. Also URL-encodes spaces as `_`
 * because MediaWiki normalises both `Le_Bristol_Paris` and
 * `Le Bristol Paris` identically, but the underscore form survives a
 * few exotic proxies that trim trailing spaces.
 */
export function buildCmTitle(category: string): string {
  const stripped = category.replace(/^Category:/iu, '').trim();
  return `Category:${stripped.replace(/\s+/gu, '_')}`;
}

/** Page 1 of category members — `cmcontinue` is followed by the caller. */
async function fetchCategoryPage(
  cfg: CommonsClientConfig,
  category: string,
  cursor: string | undefined,
): Promise<Result<{ titles: string[]; nextCursor: string | undefined }, CommonsError>> {
  const url = new URL(cfg.apiBase);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'categorymembers');
  url.searchParams.set('cmtitle', buildCmTitle(category));
  url.searchParams.set('cmtype', 'file');
  url.searchParams.set('cmlimit', '50');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');
  if (cursor !== undefined) {
    url.searchParams.set('cmcontinue', cursor);
  }

  const res = await retryingJsonRequest({
    url: url.toString(),
    method: 'GET',
    headers: { 'User-Agent': cfg.userAgent, Accept: 'application/json' },
    body: { kind: 'none' },
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) return err({ kind: 'empty_response' });

  const parsed = CategoryMembersResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: `categorymembers schema mismatch: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    });
  }

  const titles = parsed.data.query.categorymembers
    .map((m) => m.title)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);

  return ok({
    titles,
    nextCursor: parsed.data.continue?.cmcontinue,
  });
}

/**
 * Batch `imageinfo` lookup for up to 50 titles.
 *
 * Returns the normalised photo array. Filters out non-image MIMEs
 * (sound, video, SVG of plans/maps) which are uploadable to Cloudinary
 * but not usable as hotel gallery photos.
 */
async function fetchImageInfo(
  cfg: CommonsClientConfig,
  titles: readonly string[],
): Promise<Result<NormalisedCommonsPhoto[], CommonsError>> {
  if (titles.length === 0) return ok([]);

  const url = new URL(cfg.apiBase);
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', titles.slice(0, 50).join('|'));
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', ['url', 'size', 'mime', 'extmetadata'].join('|'));
  url.searchParams.set('iiurlwidth', String(cfg.thumbWidth));
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');

  const res = await retryingJsonRequest({
    url: url.toString(),
    method: 'GET',
    headers: { 'User-Agent': cfg.userAgent, Accept: 'application/json' },
    body: { kind: 'none' },
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) return err({ kind: 'empty_response' });

  const parsed = ImageInfoResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: `imageinfo schema mismatch: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    });
  }

  const out: NormalisedCommonsPhoto[] = [];
  for (const page of parsed.data.query.pages) {
    const info = page.imageinfo[0];
    if (!info) continue;
    const mime = info.mime;
    if (mime === undefined || !ALLOWED_IMAGE_MIMES.has(mime)) continue;

    const downloadUrl = info.url ?? info.thumburl;
    const thumbUrl = info.thumburl ?? info.url;
    if (downloadUrl === undefined || thumbUrl === undefined) continue;

    const width = info.thumbwidth ?? info.width;
    const height = info.thumbheight ?? info.height;
    if (width === undefined || height === undefined || width <= 0 || height <= 0) continue;

    const license = info.extmetadata?.LicenseShortName?.value;
    if (license === undefined || license.length < 2) continue;

    const candidate = {
      pageId: page.pageid,
      title: page.title,
      downloadUrl,
      thumbUrl,
      width,
      height,
      mime,
      license,
      licenseUrl: info.extmetadata?.LicenseUrl?.value,
      attribution: info.extmetadata?.Artist?.value,
      description: info.extmetadata?.ImageDescription?.value,
    };
    const validated = NormalisedCommonsPhotoSchema.safeParse(candidate);
    if (validated.success) out.push(validated.data);
  }

  return ok(out);
}

/**
 * Fetch up to `maxN` photos from a Commons category, normalised and
 * filtered for hotel-gallery use.
 *
 * Strategy
 * --------
 * 1. Page through `categorymembers` (50 per page) until either
 *    `maxN` titles collected OR the category is exhausted.
 * 2. Fetch `imageinfo` in batches of 50 — Commons accepts up to 50
 *    titles per call via the `|` separator.
 * 3. Normalise + filter by MIME + drop entries without license info.
 *
 * Returns at most `maxN` photos, in the order Commons returned them
 * (chronological-ish — usually featured / older photos first).
 */
export async function fetchCategoryPhotos(
  cfg: CommonsClientConfig,
  category: string,
  maxN: number,
): Promise<Result<NormalisedCommonsPhoto[], CommonsError>> {
  if (category.trim().length === 0) {
    return err({ kind: 'category_not_found', category });
  }
  if (maxN <= 0) return ok([]);

  const titles: string[] = [];
  let cursor: string | undefined = undefined;
  let safety = 10; // worst case 500 files per category — way more than maxN
  while (titles.length < maxN && safety > 0) {
    safety -= 1;
    // eslint-disable-next-line no-await-in-loop -- intentional sequential pagination
    const page = await fetchCategoryPage(cfg, category, cursor);
    if (!page.ok) return err(page.error);
    if (page.value.titles.length === 0 && cursor === undefined) {
      return err({ kind: 'category_not_found', category });
    }
    for (const t of page.value.titles) {
      titles.push(t);
      if (titles.length >= maxN) break;
    }
    cursor = page.value.nextCursor;
    if (cursor === undefined) break;
  }

  if (titles.length === 0) return ok([]);

  // Slice — fetchImageInfo only consumes 50 per call.
  const photos: NormalisedCommonsPhoto[] = [];
  for (let i = 0; i < titles.length; i += 50) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential batching
    const batch = await fetchImageInfo(cfg, titles.slice(i, i + 50));
    if (!batch.ok) return err(batch.error);
    photos.push(...batch.value);
    if (photos.length >= maxN) break;
  }

  return ok(photos.slice(0, maxN));
}
