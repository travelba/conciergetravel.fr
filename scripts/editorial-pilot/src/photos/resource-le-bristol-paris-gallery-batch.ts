/**
 * Phase 3 — full 30-image gallery for `le-bristol-paris`.
 *
 * Metadata lives in `@mch/domain` (`LE_BRISTOL_PARIS_GALLERY_IMAGES`).
 * Source URLs: Oetker Collection Contentful CDN (`images.eu.ctfassets.net/og3b0tarlg4b`).
 * Run `photos:discover --slug=le-bristol-paris` to backfill pending slots.
 *
 * Legality: official Oetker Collection media. Source = `press`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot bristol:photos:plan
 *   pnpm --filter @mch/editorial-pilot bristol:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot bristol:photos:gallery
 *
 * Skill: photo-pipeline, hotel-kit-rollout D12–D14
 */

import {
  LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES,
  LE_BRISTOL_PARIS_GALLERY_IMAGES,
  LE_BRISTOL_PARIS_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'le-bristol-paris';

/** Verified Oetker Collection Contentful assets (oetkerhotels.com homepage cards, 2026-06-10). */
const OETKER_CDN = 'https://images.eu.ctfassets.net/og3b0tarlg4b';

const URL_DELUXE_ROOM = `${OETKER_CDN}/5N67rO1TxjwDczzilOm4rO/f0fafea568a84e2b860c003862bfe060/Le_Bristol_Paris_-_Chambre_Deluxe_-_102_uncO8.jpg`;
const URL_SUITE_LUMIERE = `${OETKER_CDN}/31A6uJXqKmhXrlYsAo5sw2/d254902e4eecb979084b5b94f39a69e8/Le_Bristol_Paris_-_Suite_Lumi%C3%A8re_-_%C2%A9_Claire_Cocano_DmMbh.jpg`;
const URL_SUITE_EDEN_WELLNESS = `${OETKER_CDN}/5Uo6C7BC0um3QRaDsClQZw/eb30f03b37517879b86cc6562569240f/Suite_Eden_-_bien_%C3%AAtre_%C2%A9_Franck_Bohbot__PLuez.jpeg`;

/**
 * One source per `press-N` row (same order as `LE_BRISTOL_PARIS_GALLERY_IMAGES`).
 * `sourcePending` → metadata-only slot (skipped on upload until discovery backfill).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly url?: string;
  readonly sourcePending?: boolean;
}>[] = [
  { sourcePending: true }, // press-1 exterior — hero pending discovery
  { sourcePending: true }, // press-2 exterior
  { sourcePending: true }, // press-3 exterior
  { sourcePending: true }, // press-4 lobby
  { sourcePending: true }, // press-5 lobby
  { sourcePending: true }, // press-6 lobby
  { url: URL_DELUXE_ROOM }, // press-7 room
  { url: URL_SUITE_LUMIERE }, // press-8 room
  { sourcePending: true }, // press-9 room
  { sourcePending: true }, // press-10 dining Epicure
  { sourcePending: true }, // press-11 dining 114 Faubourg
  { sourcePending: true }, // press-12 dining Jardin Français
  { sourcePending: true }, // press-13 spa
  { sourcePending: true }, // press-14 spa
  { url: URL_SUITE_EDEN_WELLNESS }, // press-15 spa Suite Eden
  { sourcePending: true }, // press-16 pool
  { sourcePending: true }, // press-17 pool
  { sourcePending: true }, // press-18 pool
  { sourcePending: true }, // press-19 view
  { sourcePending: true }, // press-20 view
  { sourcePending: true }, // press-21 view
  { sourcePending: true }, // press-22 detail
  { sourcePending: true }, // press-23 detail
  { sourcePending: true }, // press-24 detail
  { sourcePending: true }, // press-25 concierge
  { sourcePending: true }, // press-26 concierge
  { sourcePending: true }, // press-27 concierge
  { sourcePending: true }, // press-28 events
  { sourcePending: true }, // press-29 events
  { sourcePending: true }, // press-30 events
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
  throw new Error(`[bristol-gallery] press-${index + 1}: no url or sourcePending flag`);
}

function assertManifestShape(): void {
  if (GALLERY_SOURCES.length !== LE_BRISTOL_PARIS_GALLERY_IMAGES.length) {
    throw new Error(
      `[bristol-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== LE_BRISTOL_PARIS_GALLERY_IMAGES (${LE_BRISTOL_PARIS_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < LE_BRISTOL_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = LE_BRISTOL_PARIS_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[bristol-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (LE_BRISTOL_PARIS_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[bristol-gallery] hero mismatch: ${LE_BRISTOL_PARIS_HERO_IMAGE}`);
  }
}

function printCategoryReport(pendingIndexes: readonly number[]): void {
  const counts = new Map<string, number>();
  const sourcedCounts = new Map<string, number>();

  for (let i = 0; i < LE_BRISTOL_PARIS_GALLERY_IMAGES.length; i++) {
    const cat = LE_BRISTOL_PARIS_GALLERY_IMAGES[i]!.category;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    if (!pendingIndexes.includes(i)) {
      sourcedCounts.set(cat, (sourcedCounts.get(cat) ?? 0) + 1);
    }
  }

  const missingCategories: string[] = [];
  for (const cat of LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES) {
    const sourced = sourcedCounts.get(cat) ?? 0;
    if (sourced === 0) missingCategories.push(cat);
  }

  console.log('\n[bristol-gallery] category coverage (sourced / planned):');
  for (const cat of LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${sourcedCounts.get(cat) ?? 0} / ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[bristol-gallery] entries: ${LE_BRISTOL_PARIS_GALLERY_IMAGES.length}`);
  console.log(
    `[bristol-gallery] sourced: ${LE_BRISTOL_PARIS_GALLERY_IMAGES.length - pendingIndexes.length}`,
  );
  console.log(`[bristol-gallery] pending: ${pendingIndexes.length}`);
  if (missingCategories.length > 0) {
    console.log(
      `[bristol-gallery] categories with zero sourced assets: ${missingCategories.join(', ')}`,
    );
  } else {
    console.log('[bristol-gallery] all CDC categories have ≥ 1 sourced asset');
  }
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[bristol-gallery] hotel not found: ${SLUG}`);
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
      throw new Error('[bristol-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[bristol-gallery] ${LE_BRISTOL_PARIS_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[bristol-gallery] hero_image = ${LE_BRISTOL_PARIS_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];
  const pendingIndexes: number[] = [];

  for (let i = 0; i < LE_BRISTOL_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = LE_BRISTOL_PARIS_GALLERY_IMAGES[i]!;
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
      extraTags: ['le-bristol-paris-gallery-2026', 'credit-Oetker-Collection'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[bristol-gallery] upload failed at press-${index}`);
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
    console.log('\n[bristol-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  if (pendingIndexes.length > 0) {
    throw new Error(
      `[bristol-gallery] ${pendingIndexes.length} pending slot(s) — resolve before DB patch (indexes: ${pendingIndexes.map((n) => n + 1).join(', ')})`,
    );
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: LE_BRISTOL_PARIS_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[bristol-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
