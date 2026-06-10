/**
 * Re-upload press-13/14/16/17 from official Marriott Scene7 wellness assets
 * (Tavily discovery 2026-06-10 — cache.marriott.com PARLC spa + gym).
 *
 *   pnpm --filter @mch/editorial-pilot pdg:photos:wellness
 */

import { PRINCE_DE_GALLES_GALLERY_IMAGES } from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';
import type { CloudinaryError } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

interface GalleryRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly credit?: string;
  readonly width?: number;
  readonly height?: number;
}

const SLUG = 'prince-de-galles-paris';

function formatCloudinaryError(error: CloudinaryError): string {
  if (error.kind === 'unknown') return error.message;
  return error.kind;
}

/** 0-based gallery index → Scene7 source (Marriott official DAM). */
const SLOT_SOURCES: Readonly<Record<number, string>> = {
  12: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-hammam2-40183:Classic-Hor?wid=2880&fit=constrain',
  13: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-relax2-39825:Classic-Hor?wid=2880&fit=constrain',
  15: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-gym-27587:Classic-Hor?wid=2880&fit=constrain',
  16: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lux-parlc-spa-double-13746:Classic-Hor?wid=2880&fit=constrain',
};

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string; gallery_images: unknown }>(cfg, {
    columns: 'id,gallery_images',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const row = rows[0];
  if (row === undefined) throw new Error(`[pdg-wellness] hotel not found: ${SLUG}`);
  return row.id;
}

async function main(): Promise<void> {
  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: true, needsGooglePlaces: false });

  const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
  const apiKey = photoEnv.CLOUDINARY_API_KEY;
  const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('[pdg-wellness] Cloudinary creds missing');
  }
  configureCloudinary({ cloudName, apiKey, apiSecret });

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const gallery: GalleryRow[] = PRINCE_DE_GALLES_GALLERY_IMAGES.map((meta) => ({
    public_id: meta.public_id,
    alt_fr: meta.alt_fr,
    alt_en: meta.alt_en,
    caption_fr: meta.caption_fr,
    caption_en: meta.caption_en,
    category: meta.category,
    credit: meta.credit,
  }));

  for (const [idxStr, sourceUrl] of Object.entries(SLOT_SOURCES)) {
    const i = Number(idxStr);
    const meta = PRINCE_DE_GALLES_GALLERY_IMAGES[i];
    if (meta === undefined) throw new Error(`[pdg-wellness] missing meta index ${i}`);
    const index = i + 1;

    const result = await uploadFromUrl({
      sourceUrl,
      hotelSlug: SLUG,
      source: 'press',
      index,
      altFr: meta.alt_fr,
      altEn: meta.alt_en,
      category: meta.category,
      extraTags: ['prince-de-galles-wellness-2026', 'credit-Marriott-Prince-de-Galles'],
    });

    if (!result.ok) {
      throw new Error(
        `[pdg-wellness] upload failed press-${index}: ${formatCloudinaryError(result.error)}`,
      );
    }

    gallery[i] = {
      public_id: meta.public_id,
      alt_fr: meta.alt_fr,
      alt_en: meta.alt_en,
      caption_fr: meta.caption_fr,
      caption_en: meta.caption_en,
      category: meta.category,
      credit: meta.credit,
      width: result.value.width,
      height: result.value.height,
    };

    console.log(
      `[pdg-wellness] press-${index} OK ${result.value.width}×${result.value.height} (${meta.category})`,
    );
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, { gallery_images: gallery });
  console.log(`[pdg-wellness] DB patched gallery_images for ${SLUG}.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
