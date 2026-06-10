/**
 * Phase 3 — full 30-image gallery for `prince-de-galles-paris`.
 *
 * Replaces the piecemeal append in `resource-prince-de-galles-photos.ts` with a
 * CDC §2.2-aligned batch (10 categories × 3 images). Metadata lives in
 * `@mch/domain` (`PRINCE_DE_GALLES_GALLERY_IMAGES`); this script maps each
 * `press-N` slot to a Marriott DAM source (PARLC renditions preferred).
 *
 * Legality: official Marriott media (`cache.marriott.com`, property code PARLC
 * or Scene7 `lc-parlc-*` assets surfaced on marriott.com). Source = `press`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot pdg:photos:plan
 *   pnpm --filter @mch/editorial-pilot pdg:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot pdg:photos:gallery
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import {
  PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES,
  PRINCE_DE_GALLES_GALLERY_IMAGES,
  PRINCE_DE_GALLES_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'prince-de-galles-paris';
const DAM_PREFIX = 'https://cache.marriott.com/content/dam/marriott-renditions/PARLC/';
const DAM_SUFFIX = '?output-quality=70&interpolation=progressive-bilinear&downsize=2880px:*';

/**
 * One source per `press-N` row (same order as `PRINCE_DE_GALLES_GALLERY_IMAGES`).
 * `damFile` → PARLC rendition; `url` → full Marriott URL (Scene7 fallback);
 * `sourcePending` → metadata-only slot (skipped on upload).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly damFile?: string;
  readonly url?: string;
  readonly sourcePending?: boolean;
}>[] = [
  { damFile: 'parlc-hotel-facade-5619-hor-wide' },
  { damFile: 'parlc-hotel-facade-5618-hor-clsc' },
  { damFile: 'parlc-exterior-4792-hor-clsc' },
  { damFile: 'parlc-lobby-9112-hor-clsc' },
  { damFile: 'parlc-marble-stairs-6041-ver-clsc' },
  { damFile: 'parlc-suite-living-8696-hor-wide' },
  { damFile: 'parlc-art-deco-1138-hor-wide' },
  { damFile: 'parlc-art-deco-6033-hor-wide' },
  { damFile: 'parlc-courtyardview-guestroom-0592-hor-wide' },
  { damFile: 'parlc-patio-5651-hor-clsc' },
  { damFile: 'parlc-le-patio-0640-hor-clsc' },
  {
    url: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-s-lection-shooting-oubrun-18140:Classic-Hor?wid=2880&fit=constrain',
  },
  { damFile: 'parlc-prince-7097-hor-clsc' },
  { damFile: 'parlc-mosaic-suite-6020-hor-wide' },
  { damFile: 'parlc-suite-bathroom-0856-hor-wide' },
  { damFile: 'parlc-prince-9106-hor-clsc' },
  { damFile: 'parlc-suite-bathroom-2591-hor-wide' },
  { damFile: 'parlc-patio-5653-hor-clsc' },
  { damFile: 'parlc-suite-patrick-hellmann-0852-hor-wide' },
  { damFile: 'parlc-george-view-2593-hor-wide' },
  { damFile: 'parlc-attraction-eiffel-0251-hor-clsc' },
  { damFile: 'parlc-art-deco-0642-hor-wide' },
  { damFile: 'parlc-art-deco-0643-hor-wide' },
  { damFile: 'parlc-suite-patrick-hellmann-0855-hor-clsc' },
  {
    url: 'https://cache.marriott.com/is/image/marriotts7prod/lc-parlc-lobby-and-concierge--23375:Classic-Hor?wid=2880&fit=constrain',
  },
  { damFile: 'parlc-prince-5630-hor-clsc' },
  { damFile: 'parlc-prince-9090-hor-wide' },
  { damFile: 'parlc-prince-5632-hor-wide' },
  { damFile: 'parlc-mosaic-suite-4802-hor-wide' },
  { damFile: 'parlc-patio-5653-hor-clsc' },
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

function buildDamUrl(file: string): string {
  return `${DAM_PREFIX}${file}.jpg${DAM_SUFFIX}`;
}

function resolveSourceUrl(index: number, source: (typeof GALLERY_SOURCES)[number]): string | null {
  if (source.sourcePending === true) return null;
  if (source.url !== undefined) return source.url;
  if (source.damFile !== undefined) return buildDamUrl(source.damFile);
  throw new Error(`[pdg-gallery] press-${index + 1}: no damFile, url, or sourcePending flag`);
}

function assertManifestShape(): void {
  if (GALLERY_SOURCES.length !== PRINCE_DE_GALLES_GALLERY_IMAGES.length) {
    throw new Error(
      `[pdg-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== PRINCE_DE_GALLES_GALLERY_IMAGES (${PRINCE_DE_GALLES_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < PRINCE_DE_GALLES_GALLERY_IMAGES.length; i++) {
    const meta = PRINCE_DE_GALLES_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[pdg-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (PRINCE_DE_GALLES_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[pdg-gallery] hero mismatch: ${PRINCE_DE_GALLES_HERO_IMAGE}`);
  }
}

function printCategoryReport(pendingIndexes: readonly number[]): void {
  const counts = new Map<string, number>();
  const sourcedCounts = new Map<string, number>();

  for (let i = 0; i < PRINCE_DE_GALLES_GALLERY_IMAGES.length; i++) {
    const cat = PRINCE_DE_GALLES_GALLERY_IMAGES[i]!.category;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    if (!pendingIndexes.includes(i)) {
      sourcedCounts.set(cat, (sourcedCounts.get(cat) ?? 0) + 1);
    }
  }

  const missingCategories: string[] = [];
  for (const cat of PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES) {
    const sourced = sourcedCounts.get(cat) ?? 0;
    if (sourced === 0) missingCategories.push(cat);
  }

  console.log('\n[pdg-gallery] category coverage (sourced / planned):');
  for (const cat of PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${sourcedCounts.get(cat) ?? 0} / ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[pdg-gallery] entries: ${PRINCE_DE_GALLES_GALLERY_IMAGES.length}`);
  console.log(
    `[pdg-gallery] sourced: ${PRINCE_DE_GALLES_GALLERY_IMAGES.length - pendingIndexes.length}`,
  );
  console.log(`[pdg-gallery] pending: ${pendingIndexes.length}`);
  if (missingCategories.length > 0) {
    console.log(
      `[pdg-gallery] categories with zero sourced assets: ${missingCategories.join(', ')}`,
    );
  } else {
    console.log('[pdg-gallery] all CDC categories have ≥ 1 sourced asset');
  }
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[pdg-gallery] hotel not found: ${SLUG}`);
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
      throw new Error('[pdg-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[pdg-gallery] ${PRINCE_DE_GALLES_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[pdg-gallery] hero_image = ${PRINCE_DE_GALLES_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];
  const pendingIndexes: number[] = [];

  for (let i = 0; i < PRINCE_DE_GALLES_GALLERY_IMAGES.length; i++) {
    const meta = PRINCE_DE_GALLES_GALLERY_IMAGES[i]!;
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
      extraTags: ['prince-de-galles-gallery-2026', 'credit-Marriott-Prince-de-Galles'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[pdg-gallery] upload failed at press-${index}`);
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
    console.log('\n[pdg-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  if (pendingIndexes.length > 0) {
    throw new Error(
      `[pdg-gallery] ${pendingIndexes.length} pending slot(s) — resolve before DB patch (indexes: ${pendingIndexes.map((n) => n + 1).join(', ')})`,
    );
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: PRINCE_DE_GALLES_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[pdg-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
