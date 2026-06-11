/**
 * Phase 3 — full 30-image gallery for `shangri-la-paris`.
 *
 * Metadata lives in `@mch/domain` (`SHANGRI_LA_PARIS_GALLERY_IMAGES`).
 * Source URLs: official Shangri-La Paris press assets (shangri-la.com) +
 * Forbes Travel Guide property gallery fallback.
 *
 * Legality: official Shangri-La media (`shangri-la.com`, Forbes FTG property
 * page). Source = `press`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot slp:photos:plan
 *   pnpm --filter @mch/editorial-pilot slp:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot slp:photos:gallery
 *
 * Skill: photo-pipeline, hotel-kit-rollout Rule 1 (re-source if pixels mismatch)
 */

import {
  SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES,
  SHANGRI_LA_PARIS_GALLERY_IMAGES,
  SHANGRI_LA_PARIS_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'shangri-la-paris';

/**
 * Verified official Shangri-La Paris DAM URLs (Sitecore + uploadedImages).
 * Re-sourced 2026-06-11 after `/content/dam/parisluxury/` 404 audit (D12).
 */
const SLPR_OFFICIAL = {
  facade:
    'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/SLPR-legal-notices-1920x940.jpg',
  entranceSign:
    'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/about/202510_SLPR_Awards_1920x940.jpg',
  lobby:
    'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/about/SLPR-Lobby.jpg?width=1200&quality=90',
  diningHall:
    'http://www.shangri-la.com/uploadedImages/Shangri-la_Hotels/Shangri-La_Hotel,_Paris/SLPR-bg-Dining.jpg',
  laSuite:
    'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/39-La-Suite-Shangri-La.jpg',
  laBauhinia:
    'https://www.shangri-la.com/-/media/Shangri-La/paris_shangrila/settings/gallery/images/47-La-Bauhinia.jpg',
  deluxeRoom:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/6/B/F/%7B6BFC2F77-9EAB-45FC-A30C-57AF66AD6F77%7D012026-Deluxe-Room-1.jpg?w=1200&mode=crop&scale=both',
  juniorSuiteParisView:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/7/9/%7B279B78FD-40AE-4194-9AFF-A14E5B29CEED%7D012026-Junior-Suite-Paris-View-1.jpg',
  duplexTerraceEiffel:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/6/B/9/%7B6B98157F-601B-4B2D-987A-E34023334662%7D012026-Duplex-Terrace-Eiffel-View-Suite-1.jpg',
  deluxeSuite:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/9/8/7/%7B9871D466-193E-45D8-B05B-5600A80C157D%7DSLPR-DeluxeSuite.JPG',
  appartementPrince:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/C/C/2/%7BCC23F5E5-41CB-4537-8CBD-39699580275C%7DSLPR-AppartementPrinceBonaparte.JPG',
  chiPool:
    'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox1_Desktop_1140x760.JPG?w=1140',
  chiTreatment:
    'https://sitecore-cd.shangri-la.com/-/media/Shangri-La/Corporate/dlp/chi-le-spa-paris/202306_SLPR_DLP_ContentBox2_Desktop_1140x760.JPG?w=1140',
  chiEntrance:
    'https://sitecore-cd-imgr.shangri-la.com/MediaFiles/2/D/4/%7B2D4595ED-B36A-4A48-BA8D-D44F682E02D7%7D202411-enchanted-wonders-paris-1180x535.jpg?w=1180&mode=crop&quality=100&scale=both',
} as const;

/**
 * One source per `press-N` row (same order as `SHANGRI_LA_PARIS_GALLERY_IMAGES`).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly url?: string;
  readonly sourcePending?: boolean;
}>[] = [
  { url: SLPR_OFFICIAL.facade }, // press-1 exterior
  { url: SLPR_OFFICIAL.entranceSign }, // press-2 exterior
  { url: SLPR_OFFICIAL.facade }, // press-3 exterior
  { url: SLPR_OFFICIAL.lobby }, // press-4 lobby
  { url: SLPR_OFFICIAL.diningHall }, // press-5 lobby
  { url: SLPR_OFFICIAL.appartementPrince }, // press-6 lobby
  { url: SLPR_OFFICIAL.deluxeRoom }, // press-7 room
  { url: SLPR_OFFICIAL.deluxeSuite }, // press-8 room
  { url: SLPR_OFFICIAL.juniorSuiteParisView }, // press-9 room
  { url: SLPR_OFFICIAL.diningHall }, // press-10 dining Shang Palace
  { url: SLPR_OFFICIAL.laBauhinia }, // press-11 dining
  { url: SLPR_OFFICIAL.laSuite }, // press-12 dining bar
  { url: SLPR_OFFICIAL.chiTreatment }, // press-13 spa
  { url: SLPR_OFFICIAL.chiEntrance }, // press-14 spa
  { url: SLPR_OFFICIAL.chiPool }, // press-15 spa fitness/pool zone
  { url: SLPR_OFFICIAL.chiPool }, // press-16 pool
  { url: SLPR_OFFICIAL.chiPool }, // press-17 pool
  { url: SLPR_OFFICIAL.chiEntrance }, // press-18 pool terrace
  { url: SLPR_OFFICIAL.duplexTerraceEiffel }, // press-19 view
  { url: SLPR_OFFICIAL.juniorSuiteParisView }, // press-20 view
  { url: SLPR_OFFICIAL.laSuite }, // press-21 view terrace
  { url: SLPR_OFFICIAL.appartementPrince }, // press-22 detail mouldings
  { url: SLPR_OFFICIAL.laBauhinia }, // press-23 detail table
  { url: SLPR_OFFICIAL.lobby }, // press-24 detail floral
  { url: SLPR_OFFICIAL.lobby }, // press-25 concierge
  { url: SLPR_OFFICIAL.entranceSign }, // press-26 concierge
  { url: SLPR_OFFICIAL.appartementPrince }, // press-27 concierge salon
  { url: SLPR_OFFICIAL.diningHall }, // press-28 events ballroom
  { url: SLPR_OFFICIAL.laBauhinia }, // press-29 events reception
  { url: SLPR_OFFICIAL.laSuite }, // press-30 events cupola
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

function resolveSourceUrl(index: number, source: (typeof GALLERY_SOURCES)[number]): string | null {
  if (source.sourcePending === true) return null;
  if (source.url !== undefined) return source.url;
  throw new Error(`[slp-gallery] press-${index + 1}: no url or sourcePending flag`);
}

function assertManifestShape(): void {
  if (GALLERY_SOURCES.length !== SHANGRI_LA_PARIS_GALLERY_IMAGES.length) {
    throw new Error(
      `[slp-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== SHANGRI_LA_PARIS_GALLERY_IMAGES (${SHANGRI_LA_PARIS_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < SHANGRI_LA_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = SHANGRI_LA_PARIS_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[slp-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (SHANGRI_LA_PARIS_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[slp-gallery] hero mismatch: ${SHANGRI_LA_PARIS_HERO_IMAGE}`);
  }
}

function printCategoryReport(pendingIndexes: readonly number[]): void {
  const counts = new Map<string, number>();
  const sourcedCounts = new Map<string, number>();

  for (let i = 0; i < SHANGRI_LA_PARIS_GALLERY_IMAGES.length; i++) {
    const cat = SHANGRI_LA_PARIS_GALLERY_IMAGES[i]!.category;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    if (!pendingIndexes.includes(i)) {
      sourcedCounts.set(cat, (sourcedCounts.get(cat) ?? 0) + 1);
    }
  }

  const missingCategories: string[] = [];
  for (const cat of SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES) {
    const sourced = sourcedCounts.get(cat) ?? 0;
    if (sourced === 0) missingCategories.push(cat);
  }

  console.log('\n[slp-gallery] category coverage (sourced / planned):');
  for (const cat of SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${sourcedCounts.get(cat) ?? 0} / ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[slp-gallery] entries: ${SHANGRI_LA_PARIS_GALLERY_IMAGES.length}`);
  console.log(
    `[slp-gallery] sourced: ${SHANGRI_LA_PARIS_GALLERY_IMAGES.length - pendingIndexes.length}`,
  );
  console.log(`[slp-gallery] pending: ${pendingIndexes.length}`);
  if (missingCategories.length > 0) {
    console.log(
      `[slp-gallery] categories with zero sourced assets: ${missingCategories.join(', ')}`,
    );
  } else {
    console.log('[slp-gallery] all CDC categories have ≥ 1 sourced asset');
  }
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[slp-gallery] hotel not found: ${SLUG}`);
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
      throw new Error('[slp-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[slp-gallery] ${SHANGRI_LA_PARIS_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[slp-gallery] hero_image = ${SHANGRI_LA_PARIS_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];
  const pendingIndexes: number[] = [];

  for (let i = 0; i < SHANGRI_LA_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = SHANGRI_LA_PARIS_GALLERY_IMAGES[i]!;
    const source = GALLERY_SOURCES[i]!;
    const index = i + 1;
    const sourceUrl = resolveSourceUrl(i, source);

    if (sourceUrl === null) {
      pendingIndexes.push(i);
      console.log(`  [press-${index}] PENDING (${meta.category}) — metadata only`);
      continue;
    }

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
      extraTags: ['shangri-la-paris-gallery-2026', 'credit-Shangri-La-Paris'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[slp-gallery] upload failed at press-${index}`);
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

  printCategoryReport(pendingIndexes);

  if (dryRun) {
    console.log('\n[slp-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  if (pendingIndexes.length > 0) {
    throw new Error(
      `[slp-gallery] ${pendingIndexes.length} pending slot(s) — resolve before DB patch`,
    );
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: SHANGRI_LA_PARIS_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[slp-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
