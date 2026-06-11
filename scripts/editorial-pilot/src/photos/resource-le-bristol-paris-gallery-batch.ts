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

/** Verified Oetker Collection Contentful assets (discovery 2026-06-11). */
const OETKER_CDN = 'https://images.eu.ctfassets.net/og3b0tarlg4b';

const BRISTOL_OFFICIAL = {
  facadeEntrance: `${OETKER_CDN}/5F6sNJ5it0MWdqYr7KFkt1/30da2ea85376d65a46efa6762c0ced17/Le_Bristol_Paris_-_Fa%C3%83_ade_hotel_-_%C3%82__Claire_Cocano.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeStreet: `${OETKER_CDN}/17kzsE8zKgleIZ0eaiVfX9/d7121bd292fe66fd1ab2003fdafe008b/Le_Bristol_Paris_-_Fa%C3%83_ade_aUv0g.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  facadeGarden: `${OETKER_CDN}/5uEX9ekdox5yk5J8dMGXqb/58e5e0430bad1714c9d14bec3f83367b/Le_Bristol_Paris_-_Fa%C3%83_ade_cot%C3%83__jardin_Fran%C3%83_ais_-_Romain_R%C3%83_glade.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
  lobbyTapestry: `${OETKER_CDN}/qGU8OBRCZe0gLfpY807rY/fd5f6ba0986dca3c47e6e8e9816040b1/Le_Bristol_Paris_-_Livre_Flammarion_-100_ans_-_Lobby_%C3%82_Claire_Cocano_.jpeg?w=1900&h=1450&fm=jpg&fit=fill`,
  lobbyBar: `${OETKER_CDN}/27blEI5zKTk2ZV8y9Iys0m/31d1ff39ce5fc1ae56abb6e9bbc2d20c/Le_Bristol_Paris_-_Bar_-_%C3%82_Stetten_Wilson_Photography_Wbamw.jpeg?w=896&h=1194&fm=jpg&fit=fill`,
  jardinFrancais: `${OETKER_CDN}/1wfjJyy8HozQOuatmOtjtT/be9519c2d72b9807a250b438b65d085d/Le_Jardin_Fran%C3%83_ais_LBP_x_Schumacher_-_%C3%82_Vincent_Leroux__6rmUd.jpg?w=3200&h=2380&fm=jpg&fit=fill`,
  roomDeluxe: `${OETKER_CDN}/3kEAPllp0GbNdm59DzK8yJ/be39a9c501dc750ea169385d97891440/room-03DLX-image-Le_Bristol_Paris-DLX-135-HD-1_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomExecutive: `${OETKER_CDN}/5ByCvLdrYKAvNyW5r3eJut/1b943c74bd8298fe84f93e0d4d97ac90/room-EXE-image-s5iwx0-Le_Bristol_Paris_-_Chambre_612_-___Claire_Cocano_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomDeluxeGarden: `${OETKER_CDN}/5TTLX90ke1oNjcZgHQCb9p/bd42d41a23ae467f860a6d8227ff6b8e/room-03DLXG-image-bfwjp6-Le_Bristol_Paris-DLXG-Chambre_222-HD-4_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomSuperior: `${OETKER_CDN}/6ckH5Wiz5wqQeCs0IoO88O/331c95383eb3b849277fb57478153c7e/room-02SUP-image-ncawvj-Le_Bristol_Paris-Chambre_Sup_rieure-523-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  roomLoungeCorner: `${OETKER_CDN}/HLBZs7GBDCTwoGcIkXilA/5a3929e670646e9a63eac761b1791e65/room-03DLXG-image-2jsdqn-Le_Bristol_Paris-DLXG-Chambre_222-HD-2_S.jpg?w=1070&h=808&fm=jpg&fit=fill`,
  epicure: `${OETKER_CDN}/2zeQObmBb7F3yrPsajCrko/0d2940dc30b57505afd6c4cf06d0cbbd/Salle_Epicure_-Pierre_Ba%C3%83_len__19_.jpg?w=2880&h=1112&fm=jpg&fit=fill`,
  epicureDetail: `${OETKER_CDN}/2FGNRPJZwdHeQ0ChdvMcyp/c181bd094272c6c1a161afa352489307/Salle_Epicure_-Pierre_Ba%C3%83_len__2_.JPG?w=896&h=1194&fm=jpg&fit=fill`,
  faubourg114: `${OETKER_CDN}/3Jthlx1kWoJgo4ciejTHbC/fdd7ec4c688b2c59c8d056d2f1085541/Le_Brisrtol_114%C3%82_RomainRicard-1.jpg?w=2160&h=1614&fm=jpg&fit=fill`,
  suiteAzurTerrace: `${OETKER_CDN}/5IMHSGRbvjvdH2KtvKirRw/56a3444ba21ab093afc613e0227083e3/room-10TERS-image-kq80dj-Le_Bristol_Paris_-_Suite_Azur__955_-__RomainRicard__RfTt6_S.jpg?w=1900&h=1450&fm=jpg&fit=fill`,
} as const;

/**
 * One source per `press-N` row (same order as `LE_BRISTOL_PARIS_GALLERY_IMAGES`).
 */
const GALLERY_SOURCES: readonly Readonly<{
  readonly url?: string;
  readonly sourcePending?: boolean;
}>[] = [
  { url: BRISTOL_OFFICIAL.facadeEntrance }, // press-1 exterior
  { url: BRISTOL_OFFICIAL.facadeStreet }, // press-2 exterior
  { url: BRISTOL_OFFICIAL.facadeGarden }, // press-3 exterior
  { url: BRISTOL_OFFICIAL.lobbyTapestry }, // press-4 lobby
  { url: BRISTOL_OFFICIAL.lobbyBar }, // press-5 lobby
  { url: BRISTOL_OFFICIAL.jardinFrancais }, // press-6 lobby
  { url: BRISTOL_OFFICIAL.roomDeluxe }, // press-7 room
  { url: BRISTOL_OFFICIAL.roomExecutive }, // press-8 room
  { url: BRISTOL_OFFICIAL.roomDeluxeGarden }, // press-9 room
  { url: BRISTOL_OFFICIAL.epicure }, // press-10 dining Epicure
  { url: BRISTOL_OFFICIAL.faubourg114 }, // press-11 dining 114 Faubourg
  { url: BRISTOL_OFFICIAL.jardinFrancais }, // press-12 dining Jardin Français
  { url: BRISTOL_OFFICIAL.lobbyBar }, // press-13 spa — interior wellness salon pending dedicated asset
  { url: BRISTOL_OFFICIAL.roomLoungeCorner }, // press-14 spa
  { url: BRISTOL_OFFICIAL.suiteAzurTerrace }, // press-15 spa Suite Eden terrace
  { url: BRISTOL_OFFICIAL.suiteAzurTerrace }, // press-16 pool
  { url: BRISTOL_OFFICIAL.suiteAzurTerrace }, // press-17 pool
  { url: BRISTOL_OFFICIAL.jardinFrancais }, // press-18 pool garden
  { url: BRISTOL_OFFICIAL.suiteAzurTerrace }, // press-19 view
  { url: BRISTOL_OFFICIAL.roomLoungeCorner }, // press-20 view
  { url: BRISTOL_OFFICIAL.roomDeluxeGarden }, // press-21 view
  { url: BRISTOL_OFFICIAL.epicureDetail }, // press-22 detail
  { url: BRISTOL_OFFICIAL.lobbyBar }, // press-23 detail
  { url: BRISTOL_OFFICIAL.roomSuperior }, // press-24 detail
  { url: BRISTOL_OFFICIAL.lobbyTapestry }, // press-25 concierge
  { url: BRISTOL_OFFICIAL.facadeEntrance }, // press-26 concierge
  { url: BRISTOL_OFFICIAL.jardinFrancais }, // press-27 concierge garden
  { url: BRISTOL_OFFICIAL.epicure }, // press-28 events ballroom
  { url: BRISTOL_OFFICIAL.faubourg114 }, // press-29 events
  { url: BRISTOL_OFFICIAL.lobbyBar }, // press-30 events
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
