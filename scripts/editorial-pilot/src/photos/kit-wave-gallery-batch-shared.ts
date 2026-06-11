/**
 * Shared kit wave-5 gallery batch helpers — Rule 7 (hotel-kit-rollout).
 *
 * - Hero → dedicated `cct/hotels/{slug}/hero` (never a `press-*` in gallery)
 * - Every gallery row carries `url` for `kit.02.gallery_source_url_tracked`
 * - Duplicate source URLs fail fast before Cloudinary upload
 */

import { uploadFromUrl, type CloudinaryUploadResult } from '@mch/integrations/cloudinary';

export interface KitGalleryManifestMeta {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly credit?: string;
}

export interface KitGalleryDbRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly credit?: string;
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

export function kitHeroPublicId(slug: string): string {
  return `cct/hotels/${slug}/hero`;
}

export function assertGallerySourceCount(
  slug: string,
  manifestLen: number,
  sourceLen: number,
): void {
  if (manifestLen !== sourceLen) {
    throw new Error(
      `[${slug}-gallery] manifest (${manifestLen}) vs sources (${sourceLen}) length mismatch`,
    );
  }
}

export function assertUniqueGallerySourceUrls(slug: string, urls: readonly string[]): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]?.trim() ?? '';
    if (url.length < 12) {
      throw new Error(`[${slug}-gallery] slot ${i + 1} missing source url`);
    }
    const prev = seen.get(url);
    if (prev !== undefined) {
      throw new Error(
        `[${slug}-gallery] duplicate source url at press-${prev + 1} and press-${i + 1}: ${url}`,
      );
    }
    seen.set(url, i);
  }
}

export function assertHeroSourceNotInGallery(
  slug: string,
  heroSourceUrl: string,
  gallerySourceUrls: readonly string[],
): void {
  const hero = heroSourceUrl.trim();
  const idx = gallerySourceUrls.findIndex((u) => u.trim() === hero);
  if (idx >= 0) {
    throw new Error(
      `[${slug}-gallery] hero source url duplicates gallery press-${idx + 1} — pick a distinct overview shot`,
    );
  }
}

export function dryRunGalleryRow(meta: KitGalleryManifestMeta, sourceUrl: string): KitGalleryDbRow {
  return {
    public_id: meta.public_id,
    alt_fr: meta.alt_fr,
    alt_en: meta.alt_en,
    caption_fr: meta.caption_fr,
    caption_en: meta.caption_en,
    category: meta.category,
    ...(meta.credit !== undefined ? { credit: meta.credit } : {}),
    url: sourceUrl,
  };
}

export function uploadedGalleryRow(
  meta: KitGalleryManifestMeta,
  sourceUrl: string,
  upload: CloudinaryUploadResult,
): KitGalleryDbRow {
  return {
    public_id: upload.public_id,
    alt_fr: meta.alt_fr,
    alt_en: meta.alt_en,
    caption_fr: meta.caption_fr,
    caption_en: meta.caption_en,
    category: meta.category,
    ...(meta.credit !== undefined ? { credit: meta.credit } : {}),
    url: sourceUrl,
    width: upload.width,
    height: upload.height,
  };
}

export async function uploadKitHeroImage(input: {
  readonly slug: string;
  readonly sourceUrl: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly dryRun: boolean;
}): Promise<{ readonly publicId: string; readonly width?: number; readonly height?: number }> {
  const publicId = kitHeroPublicId(input.slug);
  if (input.dryRun) {
    console.log(`  [hero] ${publicId} ← ${input.sourceUrl}`);
    return { publicId };
  }
  const result = await uploadFromUrl({
    sourceUrl: input.sourceUrl,
    hotelSlug: input.slug,
    source: 'press',
    index: 0,
    publicIdShort: 'hero',
    altFr: input.altFr,
    altEn: input.altEn,
    category: 'exterior',
    extraTags: [`${input.slug}-hero-2026`, 'kit-wave-hero'],
  });
  if (!result.ok) {
    throw new Error(`[${input.slug}-gallery] hero upload failed: ${result.error.kind}`);
  }
  console.log(
    `  [hero] OK ${result.value.public_id} — ${result.value.width}×${result.value.height}`,
  );
  return {
    publicId: result.value.public_id,
    width: result.value.width,
    height: result.value.height,
  };
}

/** Attach `url` from parallel source list — used by promote scripts when DB lacks urls. */
export function attachGallerySourceUrls<T extends KitGalleryManifestMeta>(
  images: readonly T[],
  sourceUrls: readonly string[],
): readonly KitGalleryDbRow[] {
  assertGallerySourceCount('promote', images.length, sourceUrls.length);
  return images.map((meta, i) => dryRunGalleryRow(meta, sourceUrls[i] ?? ''));
}
