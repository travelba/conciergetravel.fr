/**
 * Hotel photo orchestrator (skill: api-integration + content-modeling).
 *
 * Pipeline
 * --------
 * 1. Pick a list of hotels (by --slug, --bucket, --limit).
 * 2. For each hotel:
 *    a. Tier 1 — Wikimedia Commons via `commons_category` (when set).
 *    b. Tier 2 — Google Places photos (when GOOGLE_PLACES_API_KEY is
 *       set AND --tier=all). Not yet implemented in this revision;
 *       hook stubbed so we can ship Commons-only today.
 *    c. De-dup, cap at --max-per-hotel.
 *    d. Upload each photo to Cloudinary under `cct/hotels/{slug}/`.
 *    e. UPDATE `public.hotels` (hero_image + gallery_images).
 * 3. Append every per-hotel outcome to a JSONL runlog so the orch
 *    is fully resumable / auditable.
 *
 * Buckets
 * -------
 *   - palaces-enriched: 27 Palaces with at least one editorial section
 *   - stars5-enriched : 3 non-Palace 5* with at least one editorial section
 *   - stubs           : 70 Atout-France-imported 5* with no photo yet
 *   - all             : every published hotel without 5+ photos
 *
 * Idempotent — re-runs are safe (Cloudinary overwrites on same public_id).
 *
 * CLI
 * ---
 *   pnpm photos:sync --dry-run --bucket=palaces-enriched
 *   pnpm photos:sync --slug=le-bristol-paris
 *   pnpm photos:sync --bucket=palaces-enriched --concurrency=2
 *   pnpm photos:sync --bucket=stubs --tier=commons --max-per-hotel=10
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  configureCloudinary,
  toGalleryRow,
  uploadFromUrl,
  type CloudinaryUploadInput,
} from '@mch/integrations/cloudinary';
import {
  defaultCommonsConfig,
  fetchCategoryPhotos,
  type NormalisedCommonsPhoto,
} from '@mch/integrations/wikimedia-commons';
import {
  defaultPlacesConfig,
  fetchPlacePhotos,
  searchPlaceByNameAndCity,
  type GooglePlacesClientConfig,
  type NormalisedPlacesPhoto,
} from '@mch/integrations/google-places';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import {
  selectHotels,
  updateHotelPhotos,
  type SupabaseRestConfig,
} from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

type Bucket = 'palaces-enriched' | 'stars5-enriched' | 'stubs' | 'all';
type Tier = 'commons' | 'places' | 'all';

interface CliArgs {
  readonly dryRun: boolean;
  readonly bucket: Bucket | null;
  readonly slug: string | null;
  readonly limit: number;
  readonly maxPerHotel: number;
  readonly concurrency: number;
  readonly tier: Tier;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let bucket: Bucket | null = null;
  let slug: string | null = null;
  let limit = 50;
  let maxPerHotel = 12;
  let concurrency = 1;
  let tier: Tier = 'commons';
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--bucket=')) {
      const v = arg.slice('--bucket='.length);
      if (v === 'palaces-enriched' || v === 'stars5-enriched' || v === 'stubs' || v === 'all') {
        bucket = v;
      } else {
        throw new Error(`Unknown bucket: ${v}`);
      }
    } else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--max-per-hotel=')) {
      maxPerHotel = Number.parseInt(arg.slice('--max-per-hotel='.length), 10);
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(1, Number.parseInt(arg.slice('--concurrency='.length), 10));
    } else if (arg.startsWith('--tier=')) {
      const v = arg.slice('--tier='.length);
      if (v === 'commons' || v === 'places' || v === 'all') tier = v;
      else throw new Error(`Unknown tier: ${v}`);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown CLI arg: ${arg}`);
    }
  }
  if (bucket === null && slug === null) {
    throw new Error('Either --bucket=<name> or --slug=<hotel-slug> is required. See --help.');
  }
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('--limit must be a positive integer');
  if (!Number.isFinite(maxPerHotel) || maxPerHotel <= 0) {
    throw new Error('--max-per-hotel must be a positive integer');
  }
  return { dryRun, bucket, slug, limit, maxPerHotel, concurrency, tier };
}

function printHelp(): void {
  console.log(`Usage: pnpm photos:sync [options]

Options
-------
  --bucket=<name>      palaces-enriched | stars5-enriched | stubs | all
  --slug=<hotel-slug>  Only process one specific hotel
  --tier=<tier>        commons (default) | places | all
  --max-per-hotel=N    Cap photos uploaded per hotel (default 12)
  --limit=N            Cap hotels processed (default 50)
  --concurrency=N      Parallel hotels (default 1; bump to 2-3 for big batches)
  --dry-run            Fetch sources but skip Cloudinary upload + DB write
  --help               Show this message

Examples
--------
  pnpm photos:sync --slug=le-bristol-paris --dry-run
  pnpm photos:sync --bucket=palaces-enriched --concurrency=2
  pnpm photos:sync --bucket=stubs --tier=commons --max-per-hotel=8`);
}

// ---------------------------------------------------------------------------
// Hotel selection
// ---------------------------------------------------------------------------

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly is_palace: boolean;
  readonly stars: number | null;
  readonly commons_category: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: unknown;
  readonly long_description_sections: unknown;
}

const HOTEL_COLS =
  'id, slug, name, city, is_palace, stars, commons_category, hero_image, gallery_images, long_description_sections';

async function pickHotels(cfg: SupabaseRestConfig, args: CliArgs): Promise<HotelRow[]> {
  if (args.slug !== null) {
    return selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLS,
      filters: [`slug=eq.${args.slug}`],
      limit: 1,
    });
  }

  const filters: string[] = ['is_published=eq.true'];
  if (args.bucket === 'palaces-enriched') {
    filters.push('is_palace=eq.true', 'long_description_sections=not.is.null');
  } else if (args.bucket === 'stars5-enriched') {
    filters.push('is_palace=eq.false', 'stars=eq.5', 'long_description_sections=not.is.null');
  } else if (args.bucket === 'stubs') {
    // Stubs = no editorial sections yet (the inverse of the two above).
    filters.push('long_description_sections=is.null');
  }
  return selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'priority.asc',
    limit: args.limit,
  });
}

// ---------------------------------------------------------------------------
// Runlog
// ---------------------------------------------------------------------------

interface RunlogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly tier1Count?: number;
  readonly tier2Count?: number;
  readonly uploaded?: number;
  readonly hero?: string;
  readonly reason?: string;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `photos-runlog-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Per-hotel processing
// ---------------------------------------------------------------------------

interface HotelOutcome {
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly tier1Count: number;
  readonly tier2Count: number;
  readonly uploaded: number;
  readonly hero: string | null;
  readonly reason?: string;
}

function altFromCommons(photo: NormalisedCommonsPhoto, hotelName: string, city: string): string {
  if (photo.description !== undefined) {
    return photo.description.replace(/<[^>]+>/gu, ' ').replace(/\s+/gu, ' ').trim();
  }
  // Build from title: "File:Hôtel Le Bristol Paris (2).jpg" → "Hôtel Le Bristol Paris (2)"
  const cleaned = photo.title
    .replace(/^File:/u, '')
    .replace(/\.[a-z0-9]+$/iu, '')
    .replace(/_/gu, ' ');
  return cleaned.length > 0 ? cleaned : `${hotelName}, ${city}`;
}

/**
 * `wikidata_id` aside, Commons categories vary. We pass exactly what's
 * in the DB; `buildCmTitle` normalises the prefix + spaces.
 */
async function fetchTier1Commons(
  hotel: HotelRow,
  args: CliArgs,
): Promise<NormalisedCommonsPhoto[]> {
  if (hotel.commons_category === null) return [];
  const cfg = defaultCommonsConfig('https://myconciergehotel.com');
  const res = await fetchCategoryPhotos(cfg, hotel.commons_category, args.maxPerHotel + 4);
  if (!res.ok) {
    if (res.error.kind === 'category_not_found') {
      console.warn(`  [tier1] category not found: ${hotel.commons_category}`);
    } else {
      console.warn(`  [tier1] failed: ${JSON.stringify(res.error)}`);
    }
    return [];
  }
  return res.value;
}

async function fetchTier2Places(
  hotel: HotelRow,
  needed: number,
  placesCfg: GooglePlacesClientConfig | null,
): Promise<NormalisedPlacesPhoto[]> {
  if (placesCfg === null || needed <= 0) return [];
  const search = await searchPlaceByNameAndCity(placesCfg, hotel.name, hotel.city);
  if (!search.ok) {
    console.warn(`  [tier2] search failed: ${JSON.stringify(search.error)}`);
    return [];
  }
  if (search.value.photos.length === 0) {
    console.warn(`  [tier2] place ${search.value.id} has 0 photos`);
    return [];
  }
  const res = await fetchPlacePhotos(placesCfg, search.value.photos, needed);
  if (!res.ok) {
    console.warn(`  [tier2] fetch failed: ${JSON.stringify(res.error)}`);
    return [];
  }
  return res.value;
}

/**
 * Common shape consumed by the Cloudinary upload step. Both
 * Commons and Places photos converge here so the upload loop is
 * source-agnostic.
 */
interface MergedPhoto {
  readonly source: 'commons' | 'places';
  readonly downloadUrl: string;
  readonly altFr: string;
  readonly tags: readonly string[];
}

function mergeCommons(
  hotel: HotelRow,
  photo: NormalisedCommonsPhoto,
): MergedPhoto {
  return {
    source: 'commons',
    downloadUrl: photo.downloadUrl,
    altFr: altFromCommons(photo, hotel.name, hotel.city),
    tags: [
      photo.license.replace(/\s+/gu, '_').toLowerCase(),
      ...(photo.attribution !== undefined ? ['attributed'] : []),
    ],
  };
}

function mergePlaces(
  hotel: HotelRow,
  photo: NormalisedPlacesPhoto,
): MergedPhoto {
  const attribution = photo.attribution ?? 'Google Places';
  return {
    source: 'places',
    downloadUrl: photo.downloadUrl,
    altFr: `${hotel.name}, ${hotel.city} — photo ${attribution}`.slice(0, 200),
    tags: ['google_places', 'attributed'],
  };
}

async function processHotel(
  hotel: HotelRow,
  args: CliArgs,
  supa: SupabaseRestConfig,
  placesCfg: GooglePlacesClientConfig | null,
): Promise<HotelOutcome> {
  console.log(`\n→ ${hotel.slug} (${hotel.name})`);

  const tier1 = await fetchTier1Commons(hotel, args);
  console.log(`  tier1 commons: ${tier1.length} photo(s)`);

  let tier2: NormalisedPlacesPhoto[] = [];
  if (args.tier === 'all' || args.tier === 'places') {
    const needed = Math.max(0, args.maxPerHotel - tier1.length);
    if (needed > 0) {
      tier2 = await fetchTier2Places(hotel, needed, placesCfg);
      console.log(`  tier2 places: ${tier2.length} photo(s)`);
    } else {
      console.log('  tier2 places: skipped (tier1 already filled quota)');
    }
  }

  const all: MergedPhoto[] = [
    ...tier1.map((p) => mergeCommons(hotel, p)),
    ...tier2.map((p) => mergePlaces(hotel, p)),
  ].slice(0, args.maxPerHotel);
  if (all.length === 0) {
    return {
      slug: hotel.slug,
      outcome: 'skip',
      tier1Count: 0,
      tier2Count: 0,
      uploaded: 0,
      hero: null,
      reason: 'no photos found in any tier',
    };
  }

  if (args.dryRun) {
    console.log(`  [dry-run] would upload ${all.length} photo(s) to cct/hotels/${hotel.slug}/`);
    return {
      slug: hotel.slug,
      outcome: 'ok',
      tier1Count: tier1.length,
      tier2Count: tier2.length,
      uploaded: all.length,
      hero: `cct/hotels/${hotel.slug}/${all[0]?.source ?? 'commons'}-1`,
    };
  }

  const gallery: ReadonlyArray<ReturnType<typeof toGalleryRow>>[] = [];
  let firstUpload: { readonly public_id: string } | null = null;
  let uploaded = 0;
  let perSourceIdx: Record<'commons' | 'places', number> = { commons: 0, places: 0 };
  let index = 0;
  for (const photo of all) {
    index += 1;
    perSourceIdx[photo.source] += 1;
    const input: CloudinaryUploadInput = {
      sourceUrl: photo.downloadUrl,
      hotelSlug: hotel.slug,
      source: photo.source,
      index: perSourceIdx[photo.source],
      altFr: photo.altFr,
      extraTags: photo.tags,
    };
    const res = await uploadFromUrl(input);
    if (!res.ok) {
      console.warn(`  [upload #${index}] FAILED: ${JSON.stringify(res.error)}`);
      continue;
    }
    const row = toGalleryRow(res.value, input);
    gallery.push([row]);
    uploaded += 1;
    if (firstUpload === null) firstUpload = { public_id: res.value.public_id };
    console.log(
      `  [upload #${index}] OK ${res.value.public_id} (${res.value.width}x${res.value.height}, ${res.value.bytes} bytes)`,
    );
  }

  if (uploaded === 0) {
    return {
      slug: hotel.slug,
      outcome: 'fail',
      tier1Count: tier1.length,
      tier2Count: tier2.length,
      uploaded: 0,
      hero: null,
      reason: 'all uploads failed',
    };
  }

  // Build the final DB payload — hero = first uploaded, gallery = the rest.
  const flatGallery = gallery.flat();
  const hero = firstUpload?.public_id ?? null;
  const galleryWithoutHero = flatGallery.filter((g) => g.public_id !== hero);

  await updateHotelPhotos(supa, hotel.id, {
    hero_image: hero,
    gallery_images: galleryWithoutHero,
  });
  console.log(
    `  DB updated: hero=${hero}, gallery=${galleryWithoutHero.length} item(s)`,
  );

  return {
    slug: hotel.slug,
    outcome: 'ok',
    tier1Count: tier1.length,
    tier2Count: tier2.length,
    uploaded,
    hero,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  requirePhotoEnv(env, {
    needsCloudinary: !args.dryRun,
    needsGooglePlaces: !args.dryRun && (args.tier === 'all' || args.tier === 'places'),
  });

  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (!args.dryRun) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
    if (
      CLOUDINARY_CLOUD_NAME === undefined ||
      CLOUDINARY_API_KEY === undefined ||
      CLOUDINARY_API_SECRET === undefined
    ) {
      throw new Error('Cloudinary env missing after requirePhotoEnv check');
    }
    configureCloudinary({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
    });
  }

  // Configure Google Places only when both (a) the user opted into a
  // tier that needs it and (b) the key is actually set. Dry-runs with
  // --tier=all without a key are allowed: they just print a notice
  // and skip the tier 2 fetch.
  const placesCfg: GooglePlacesClientConfig | null =
    (args.tier === 'all' || args.tier === 'places') && env.GOOGLE_PLACES_API_KEY !== undefined
      ? defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY)
      : null;
  if ((args.tier === 'all' || args.tier === 'places') && placesCfg === null) {
    console.warn(
      '[tier2] GOOGLE_PLACES_API_KEY is missing — Places tier will be skipped for every hotel.',
    );
  }

  const runlogPath = ensureRunlog();
  console.log(`Photo orchestrator — args: ${JSON.stringify(args)}`);
  console.log(`Runlog: ${runlogPath}\n`);

  const hotels = await pickHotels(supa, args);
  if (hotels.length === 0) {
    console.log('No hotels matched. Done.');
    return;
  }
  console.log(`Selected ${hotels.length} hotel(s) to process.`);

  // Lightweight worker pool — `args.concurrency` slots, sequential
  // hotels inside each slot. Good enough for 10-100 hotels (no need
  // for an external lib).
  const queue = [...hotels];
  const results: HotelOutcome[] = [];

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const hotel = queue.shift();
      if (hotel === undefined) break;
      try {
        const outcome = await processHotel(hotel, args, supa, placesCfg);
        results.push(outcome);
        const entry: RunlogEntry = {
          ts: new Date().toISOString(),
          slug: outcome.slug,
          outcome: outcome.outcome,
          tier1Count: outcome.tier1Count,
          tier2Count: outcome.tier2Count,
          uploaded: outcome.uploaded,
          ...(outcome.hero !== null ? { hero: outcome.hero } : {}),
          ...(outcome.reason !== undefined ? { reason: outcome.reason } : {}),
        };
        logEntry(runlogPath, entry);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  CRASH on ${hotel.slug}: ${msg}`);
        results.push({
          slug: hotel.slug,
          outcome: 'fail',
          tier1Count: 0,
          tier2Count: 0,
          uploaded: 0,
          hero: null,
          reason: `crash: ${msg.slice(0, 200)}`,
        });
        logEntry(runlogPath, {
          ts: new Date().toISOString(),
          slug: hotel.slug,
          outcome: 'fail',
          reason: `crash: ${msg.slice(0, 200)}`,
        });
      }
    }
  };

  const workers = Array.from({ length: args.concurrency }, () => worker());
  await Promise.all(workers);

  const okCount = results.filter((r) => r.outcome === 'ok').length;
  const skipCount = results.filter((r) => r.outcome === 'skip').length;
  const failCount = results.filter((r) => r.outcome === 'fail').length;
  const totalUploaded = results.reduce((acc, r) => acc + r.uploaded, 0);

  console.log(`\n=== Summary ===`);
  console.log(`OK:   ${okCount}`);
  console.log(`SKIP: ${skipCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`Total photos uploaded: ${totalUploaded}`);
  console.log(`Runlog: ${runlogPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
