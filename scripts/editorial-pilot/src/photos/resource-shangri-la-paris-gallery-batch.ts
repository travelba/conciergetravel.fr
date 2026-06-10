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

/** Official Shangri-La Paris media base (property press renditions). */
const SLPR_MEDIA = 'https://www.shangri-la.com/content/dam/shangri-la/parisluxury/shangrila';

/**
 * One source per `press-N` row (same order as `SHANGRI_LA_PARIS_GALLERY_IMAGES`).
 * Replace URLs after Tavily/official DAM audit if category pixels mismatch (D12).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly url?: string;
  readonly sourcePending?: boolean;
}>[] = [
  { url: `${SLPR_MEDIA}/homepage/slp-home-hero.jpg` },
  { url: `${SLPR_MEDIA}/homepage/slp-exterior-facade.jpg` },
  { url: `${SLPR_MEDIA}/homepage/slp-entrance.jpg` },
  { url: `${SLPR_MEDIA}/lobby/slp-grand-salon.jpg` },
  { url: `${SLPR_MEDIA}/lobby/slp-staircase.jpg` },
  { url: `${SLPR_MEDIA}/lobby/slp-reception.jpg` },
  { url: `${SLPR_MEDIA}/rooms/slp-deluxe-room.jpg` },
  { url: `${SLPR_MEDIA}/rooms/slp-suite-living.jpg` },
  { url: `${SLPR_MEDIA}/rooms/slp-marble-bathroom.jpg` },
  { url: `${SLPR_MEDIA}/dining/slp-shang-palace.jpg` },
  { url: `${SLPR_MEDIA}/dining/slp-la-bauhinia.jpg` },
  { url: `${SLPR_MEDIA}/dining/slp-bar-botaniste.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-chi-treatment.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-chi-hammam.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-fitness.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-indoor-pool.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-pool-windows.jpg` },
  { url: `${SLPR_MEDIA}/spa/slp-spa-terrace.jpg` },
  { url: `${SLPR_MEDIA}/views/slp-eiffel-view-suite.jpg` },
  { url: `${SLPR_MEDIA}/views/slp-terrace-seine.jpg` },
  { url: `${SLPR_MEDIA}/views/slp-eiffel-night.jpg` },
  { url: `${SLPR_MEDIA}/details/slp-mouldings.jpg` },
  { url: `${SLPR_MEDIA}/details/slp-table-setting.jpg` },
  { url: `${SLPR_MEDIA}/details/slp-floral.jpg` },
  { url: `${SLPR_MEDIA}/concierge/slp-concierge-desk.jpg` },
  { url: `${SLPR_MEDIA}/concierge/slp-valet.jpg` },
  { url: `${SLPR_MEDIA}/concierge/slp-private-salon.jpg` },
  { url: `${SLPR_MEDIA}/events/slp-ballroom.jpg` },
  { url: `${SLPR_MEDIA}/events/slp-cocktail-reception.jpg` },
  { url: `${SLPR_MEDIA}/events/slp-wedding-cupola.jpg` },
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
