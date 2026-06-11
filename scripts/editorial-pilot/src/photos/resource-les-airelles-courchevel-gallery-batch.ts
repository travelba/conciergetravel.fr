/**
 * Phase 3 — full 30-image gallery for `les-airelles-courchevel`.
 *
 * CDC §2.2-aligned batch (10 categories × 3 images). Metadata lives in
 * `@mch/domain` (`LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES`); this script maps each
 * `press-N` slot to official Airelles Imgix assets (`assets.airelles.com`).
 *
 * Legality: official Airelles DAM surfaced on airelles.com Courchevel pages.
 * Source = `press`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:plan
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:gallery
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import {
  LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES,
  LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES,
  LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'les-airelles-courchevel';
const IMGIX_PREFIX = 'https://assets.airelles.com/images/airelles2023/';
const IMGIX_SUFFIX = '?auto=format%2Ccompress&w=2600';

/**
 * One Imgix file per `press-N` row (same order as `LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES`).
 * Filenames match assets.airelles.com Courchevel hotel pages (URL-encoded where needed).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly imgixFile: string;
}>[] = [
  { imgixFile: 'abwDDbbci2UF6Rqd_VIDEOHEADERHOMEARL.jpg' },
  { imgixFile: 'abREoVxvIZEnjqaN_ARLVUEDRONE.png' },
  { imgixFile: 'abRDdVxvIZEnjqZa_DRONEARLVF.png' },
  {
    imgixFile: 'aNztf55xUNkB1VA3_ARL-Lieucommun-Salonavecservice%C2%A9JonathanDucrest.jpg',
  },
  { imgixFile: 'ZiojZvPdc1huKx1J_LesAirelles-LeBaravecmixologue.jpg' },
  { imgixFile: 'Zg_IRxrFxhpPBU9o_ARL-Fumoir.jpg' },
  {
    imgixFile: 'aXN9SgIvOtkhB3ey_ARL-Chambre-L%27Appartement%C2%A9VincentLeroux.jpg',
  },
  { imgixFile: 'ZkdQfiol0Zci9PdA_LesAirelles-LYS315-Chambre2-D%C3%A9tail.jpg' },
  { imgixFile: 'aNqBqJ5xUNkB1OEv_2m.jpg' },
  { imgixFile: 'ZharrjjCgu4jzuwV_BLOG-ARL-TabledesAirelles-Salle.jpeg' },
  { imgixFile: 'aV0ME3NYClf9o0Zi_ARL-Salle-Matsuhisa%C2%A9VincentLeroux.jpg' },
  {
    imgixFile: 'ZiogKfPdc1huKxvn_Moyen-LesAirelles-CoinSavoyard-Table%C2%A9ViaTolila.jpg',
  },
  { imgixFile: 'aQtMirpReVYa4F1T_ShootingExportWebseq3-7.jpg' },
  { imgixFile: 'Zkx5lyol0Zci9UIU_SuiteNecker-De%CC%81tails.jpg' },
  { imgixFile: 'aNzWJJ5xUNkB1Ujy_SPA.jpg' },
  { imgixFile: 'ZjoJh0MTzAJOCmvG_Moyen-Piscine-Vued%27ensemble-1.jpg' },
  { imgixFile: 'aNqCCZ5xUNkB1OFK_4m.jpg' },
  { imgixFile: 'aNqCgp5xUNkB1OFX_lastm.jpg' },
  { imgixFile: 'aNqINp5xUNkB1OKW_ARL-Vuemontagne%C2%A9YoannetMarco.jpg' },
  { imgixFile: 'abRDdVxvIZEnjqZa_DRONEARLVF.png' },
  {
    imgixFile: 'ZuQVhrVsGrYSvVEv_ChaletdePierres-Terrasse%C2%A9ViaTolila.-2.jpg',
  },
  { imgixFile: 'Zkxhmiol0Zci9T4T_Chambres%26Suites.jpg' },
  { imgixFile: 'aNqBhZ5xUNkB1OEm_1m.jpeg' },
  { imgixFile: 'aNup2Z5xUNkB1Q6I_4m.jpg' },
  { imgixFile: 'ZgPr27LRO5ile6wB_LesAirelles-BoutiqueV%26L.jpeg' },
  {
    imgixFile: 'aQMnHrpReVYa30xx_ARL-Service-TabledesAirelles%C2%A9Yoannetmarco.jpg',
  },
  { imgixFile: 'aV0K2nNYClf9o0Yr_ARL-FOLIEDOUCE.jpg' },
  { imgixFile: 'Zes593Uurf2G3N5n_ARL-MotoneigeExpe%CC%81rience.jpg' },
  { imgixFile: 'ZgPrBrLRO5ile6vt_Patinoire.jpeg' },
  {
    imgixFile: 'aV0M6HNYClf9o0Z3_ARL-Salle-Palladio%C2%A9VincentLeroux-1.jpg',
  },
];

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

function buildImgixUrl(file: string): string {
  return `${IMGIX_PREFIX}${file}${IMGIX_SUFFIX}`;
}

function assertManifestShape(): void {
  if (GALLERY_SOURCES.length !== LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length) {
    throw new Error(
      `[arl-cv-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES (${LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length; i++) {
    const meta = LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[arl-cv-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (LES_AIRELLES_COURCHEVEL_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[arl-cv-gallery] hero mismatch: ${LES_AIRELLES_COURCHEVEL_HERO_IMAGE}`);
  }
}

function printCategoryReport(uploadedCount: number): void {
  const counts = new Map<string, number>();
  for (const meta of LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES) {
    counts.set(meta.category, (counts.get(meta.category) ?? 0) + 1);
  }

  console.log('\n[arl-cv-gallery] category coverage:');
  for (const cat of LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[arl-cv-gallery] entries: ${LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length}`);
  console.log(`[arl-cv-gallery] uploaded: ${uploadedCount}`);
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[arl-cv-gallery] hotel not found: ${SLUG}`);
  return id;
}

async function main(): Promise<void> {
  assertManifestShape();

  const dryRun = process.argv.slice(2).includes('--dry-run');

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[arl-cv-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[arl-cv-gallery] ${LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[arl-cv-gallery] hero_image = ${LES_AIRELLES_COURCHEVEL_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];

  for (let i = 0; i < LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES.length; i++) {
    const meta = LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES[i]!;
    const source = GALLERY_SOURCES[i]!;
    const index = i + 1;
    const sourceUrl = buildImgixUrl(source.imgixFile);

    if (dryRun) {
      console.log(`  [press-${index}] (${meta.category}) ${sourceUrl}`);
      gallery.push({
        public_id: meta.public_id,
        alt_fr: meta.alt_fr,
        alt_en: meta.alt_en,
        caption_fr: meta.caption_fr,
        caption_en: meta.caption_en,
        category: meta.category,
        credit: meta.credit,
      });
      continue;
    }

    const result = await uploadFromUrl({
      sourceUrl,
      hotelSlug: SLUG,
      source: 'press',
      index,
      altFr: meta.alt_fr,
      altEn: meta.alt_en,
      category: meta.category,
      extraTags: ['les-airelles-courchevel-gallery-2026', 'credit-Airelles'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[arl-cv-gallery] upload failed at press-${index}`);
    }

    console.log(
      `  [press-${index}] OK ${result.value.public_id} — ${result.value.width}×${result.value.height} (${meta.category})`,
    );
    gallery.push({
      public_id: result.value.public_id,
      alt_fr: meta.alt_fr,
      alt_en: meta.alt_en,
      caption_fr: meta.caption_fr,
      caption_en: meta.caption_en,
      category: meta.category,
      credit: meta.credit,
      width: result.value.width,
      height: result.value.height,
    });
  }

  printCategoryReport(gallery.length);

  if (dryRun) {
    console.log('\n[arl-cv-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[arl-cv-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
