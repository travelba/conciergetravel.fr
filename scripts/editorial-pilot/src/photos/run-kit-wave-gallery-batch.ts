/**
 * Shared gallery batch runner — Rule 7 (hotel-kit-rollout).
 *
 * Hero → `cct/hotels/{slug}/hero` (never a `press-*` in gallery).
 * Every gallery row carries `url` for `kit.02.gallery_source_url_tracked`.
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import {
  assertGallerySourceCount,
  assertHeroSourceNotInGallery,
  assertUniqueGallerySourceUrls,
  dryRunGalleryRow,
  type KitGalleryDbRow,
  type KitGalleryManifestMeta,
  uploadKitHeroImage,
  uploadedGalleryRow,
} from './kit-wave-gallery-batch-shared.js';
import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

export interface RunKitWaveGalleryBatchInput {
  readonly slug: string;
  readonly logPrefix: string;
  readonly heroImage: string;
  readonly heroSourceUrl: string;
  readonly heroAltFr: string;
  readonly heroAltEn: string;
  readonly galleryImages: readonly KitGalleryManifestMeta[];
  readonly gallerySourceUrls: readonly string[];
  readonly cdcCategories: readonly string[];
  readonly extraUploadTags?: readonly string[];
}

async function fetchHotelId(
  cfg: SupabaseRestConfig,
  slug: string,
  logPrefix: string,
): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${slug}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`[${logPrefix}] hotel not found: ${slug}`);
  }
  return id;
}

function assertManifestPublicIds(
  slug: string,
  logPrefix: string,
  galleryImages: readonly KitGalleryManifestMeta[],
): void {
  for (let i = 0; i < galleryImages.length; i++) {
    const meta = galleryImages[i]!;
    const expected = `cct/hotels/${slug}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[${logPrefix}] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
}

function printCategoryReport(
  logPrefix: string,
  galleryImages: readonly KitGalleryManifestMeta[],
  cdcCategories: readonly string[],
): void {
  const counts = new Map<string, number>();
  for (const meta of galleryImages) {
    counts.set(meta.category, (counts.get(meta.category) ?? 0) + 1);
  }
  console.log(`\n[${logPrefix}] category coverage:`);
  for (const cat of cdcCategories) {
    console.log(`  ${cat}: ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[${logPrefix}] entries: ${galleryImages.length}`);
}

export async function runKitWaveGalleryBatch(input: RunKitWaveGalleryBatchInput): Promise<void> {
  const { slug, logPrefix } = input;
  assertManifestPublicIds(slug, logPrefix, input.galleryImages);
  assertGallerySourceCount(slug, input.galleryImages.length, input.gallerySourceUrls.length);
  assertUniqueGallerySourceUrls(slug, input.gallerySourceUrls);
  assertHeroSourceNotInGallery(slug, input.heroSourceUrl, input.gallerySourceUrls);

  if (input.heroImage !== `cct/hotels/${slug}/hero`) {
    throw new Error(
      `[${logPrefix}] hero_image must be cct/hotels/${slug}/hero — got ${input.heroImage}`,
    );
  }

  const dryRun = process.argv.slice(2).includes('--dry-run');
  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(`[${logPrefix}] Cloudinary creds missing despite requirePhotoEnv`);
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[${logPrefix}] ${input.galleryImages.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[${logPrefix}] hero_image = ${input.heroImage}`);

  const heroUpload = await uploadKitHeroImage({
    slug,
    sourceUrl: input.heroSourceUrl,
    altFr: input.heroAltFr,
    altEn: input.heroAltEn,
    dryRun,
  });

  const gallery: KitGalleryDbRow[] = [];
  const extraTags = input.extraUploadTags ?? [`${slug}-gallery-2026`];

  for (let i = 0; i < input.galleryImages.length; i++) {
    const meta = input.galleryImages[i]!;
    const sourceUrl = input.gallerySourceUrls[i] ?? '';
    const index = i + 1;

    if (dryRun) {
      console.log(`  [press-${index}] (${meta.category}) ${sourceUrl}`);
      gallery.push(dryRunGalleryRow(meta, sourceUrl));
      continue;
    }

    const result = await uploadFromUrl({
      sourceUrl,
      hotelSlug: slug,
      source: 'press',
      index,
      altFr: meta.alt_fr,
      altEn: meta.alt_en,
      category: meta.category,
      extraTags: [...extraTags],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[${logPrefix}] upload failed at press-${index}`);
    }

    console.log(
      `  [press-${index}] OK ${result.value.public_id} — ${result.value.width}×${result.value.height} (${meta.category})`,
    );
    gallery.push(uploadedGalleryRow(meta, sourceUrl, result.value));
  }

  printCategoryReport(logPrefix, input.galleryImages, input.cdcCategories);

  if (dryRun) {
    console.log(`\n[${logPrefix}] dry-run — no Cloudinary upload, no DB patch.`);
    console.log(`[${logPrefix}] hero would upload to ${heroUpload.publicId}`);
    return;
  }

  const hotelId = await fetchHotelId(cfg, slug, logPrefix);
  await patchHotelById(cfg, hotelId, {
    hero_image: heroUpload.publicId,
    gallery_images: gallery,
  });
  console.log(`\n[${logPrefix}] DB patched (hotel ${hotelId}). Done.`);
}
