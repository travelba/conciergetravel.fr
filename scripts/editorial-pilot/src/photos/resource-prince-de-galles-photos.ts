/**
 * One-shot gallery enrichment for `prince-de-galles-paris` (reference fiche).
 *
 * Why this exists (2026-06-05):
 *   The fiche carried 7 gallery images but 4 were redundant facade shots and
 *   3 were 480×320 Google-Places thumbnails (below the ≥ 2400 px bar) with
 *   generic alt text. The interior/suite coverage was missing entirely.
 *
 *   The Tavily press-kit discovery (read-only) surfaced 4 genuine,
 *   PdG-specific official renditions on the Marriott DAM (`cache.marriott.com`,
 *   `PARLC` property code → guaranteed Prince de Galles, `downsize=2880px` →
 *   real ≥ 2400 px frames). This script APPENDS those 4 — hand-authored
 *   bilingual alt/captions (Hard Rule 16) — to the existing gallery and
 *   leaves the hero untouched. 3rd-party media (sortiraparis, squarespace,
 *   trvl-media/Expedia) from the discovery run were rejected — not official.
 *
 * Legality: every URL is the hotel's OWN official Marriott DAM (Scene7),
 * source = `press` (official media kit), `all-rights-reserved` (provenance
 * only, never a licence link — per photo-quality-seo-geo-agentique
 * §Provenance & Licensable). Credit goes in a Cloudinary tag.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-prince-de-galles-photos.ts --dry-run   # print plan
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-prince-de-galles-photos.ts             # upload + patch
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'prince-de-galles-paris';

interface CuratedImage {
  /** Full Marriott DAM (Scene7) source URL — already PdG-specific (PARLC). */
  readonly url: string;
  readonly category: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly captionFr: string;
  readonly captionEn: string;
}

/**
 * Curated set (4) — harvested + provenance-verified from the official
 * Marriott DAM on 2026-06-05 (`PARLC` = Prince de Galles property code).
 * Each requests a 2880 px rendition; Cloudinary's `uploadFromUrl` then
 * limits to 2400 max-side (`c_limit`, no upscale).
 */
const CURATED: readonly CuratedImage[] = [
  {
    url: 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/parlc-makassar-suite-6029-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*',
    category: 'suite',
    altFr: 'Salon de la Suite Makassar, Prince de Galles Paris',
    altEn: 'Lounge of the Makassar Suite, Prince de Galles Paris',
    captionFr:
      'Le salon de la Suite Makassar marie velours, boiseries laquées et palette Art déco, signature du Prince de Galles depuis 1929.',
    captionEn:
      'The Makassar Suite lounge blends velvet, lacquered panelling and an Art Deco palette — the Prince de Galles signature since 1929.',
  },
  {
    url: 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/parlc-suite-living-8696-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*',
    category: 'suite',
    altFr: 'Séjour d’une suite du Prince de Galles Paris',
    altEn: 'Suite living room at the Prince de Galles Paris',
    captionFr:
      'Le séjour d’une suite réunit fauteuils capitonnés et lustre, ouvert sur l’élégance feutrée de l’avenue George-V.',
    captionEn:
      'A suite living room gathers tufted armchairs and a chandelier, opening onto the hushed elegance of avenue George-V.',
  },
  {
    url: 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/parlc-suite-patrick-hellmann-0852-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*',
    category: 'view',
    altFr:
      'Balcon de la Suite Patrick Hellmann avec vue sur la tour Eiffel, Prince de Galles Paris',
    altEn: 'Balcony of the Patrick Hellmann Suite with Eiffel Tower view, Prince de Galles Paris',
    captionFr:
      'Le balcon de la Suite Patrick Hellmann domine les toits de Paris et la tour Eiffel, à deux pas des Champs-Élysées.',
    captionEn:
      'The Patrick Hellmann Suite balcony overlooks the Paris rooftops and the Eiffel Tower, steps from the Champs-Élysées.',
  },
  {
    url: 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/parlc-suite-patrick-hellmann-0855-hor-clsc.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*',
    category: 'room',
    altFr: 'Chambre de la Suite Patrick Hellmann, Prince de Galles Paris',
    altEn: 'Bedroom of the Patrick Hellmann Suite, Prince de Galles Paris',
    captionFr:
      'La chambre de la Suite Patrick Hellmann joue les contrastes graphiques, tête de lit ouvragée et art contemporain encadré.',
    captionEn:
      'The Patrick Hellmann Suite bedroom plays on graphic contrasts, with an ornate headboard and framed contemporary art.',
  },
];

interface GalleryRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly width?: number;
  readonly height?: number;
}

interface HotelRow {
  readonly id: string;
  readonly gallery_images: unknown;
}

async function fetchHotel(cfg: SupabaseRestConfig): Promise<HotelRow> {
  const rows = await selectHotels<HotelRow>(cfg, {
    columns: 'id, gallery_images',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const row = rows[0];
  if (row === undefined) throw new Error(`[resource-pdg-photos] hotel not found: ${SLUG}`);
  return row;
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[resource-pdg-photos] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const hotel = await fetchHotel(cfg);
  const existing: unknown[] = Array.isArray(hotel.gallery_images) ? hotel.gallery_images : [];
  console.log(
    `[resource-pdg-photos] existing gallery = ${existing.length} — appending ${CURATED.length} (dry-run: ${dryRun ? 'YES' : 'NO'})`,
  );

  const appended: GalleryRow[] = [];

  for (let i = 0; i < CURATED.length; i++) {
    const img = CURATED[i]!;
    const index = i + 1;

    if (dryRun) {
      console.log(`  [press-${index}] (${img.category}) ${img.url}`);
      appended.push({
        public_id: `cct/hotels/${SLUG}/press-${index}`,
        alt_fr: img.altFr,
        alt_en: img.altEn,
        caption_fr: img.captionFr,
        caption_en: img.captionEn,
        category: img.category,
      });
      continue;
    }

    const result = await uploadFromUrl({
      sourceUrl: img.url,
      hotelSlug: SLUG,
      source: 'press',
      index,
      altFr: img.altFr,
      altEn: img.altEn,
      category: img.category,
      extraTags: ['prince-de-galles-2026', 'credit-Marriott-Prince-de-Galles'],
    });

    if (!result.ok) {
      console.error(
        `  [press-${index}] UPLOAD FAILED (${img.category}): ${JSON.stringify(result.error)}`,
      );
      throw new Error(
        `[resource-pdg-photos] upload failed at index ${index}; aborting before DB patch`,
      );
    }

    console.log(
      `  [press-${index}] OK ${result.value.public_id} — ${result.value.width}×${result.value.height} (${img.category})`,
    );
    appended.push({
      public_id: result.value.public_id,
      alt_fr: img.altFr,
      alt_en: img.altEn,
      caption_fr: img.captionFr,
      caption_en: img.captionEn,
      category: img.category,
      width: result.value.width,
      height: result.value.height,
    });
  }

  const merged = [...existing, ...appended];
  console.log(`\n[resource-pdg-photos] new gallery length = ${merged.length}`);

  if (dryRun) {
    console.log('[resource-pdg-photos] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  await patchHotelById(cfg, hotel.id, { gallery_images: merged });
  console.log(`[resource-pdg-photos] DB patched (hotel ${hotel.id}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
