/**
 * Google Places → press-kit discovery JSON generator.
 *
 * Produces discovery files in the EXACT shape consumed by
 * `upload-press-kit-images.ts` (DiscoveryReportSchema), sourced from the
 * Google Places Photo API instead of Tavily. This unlocks the
 * Vision-curated, APPEND-only upload pipeline for hotels whose press kit
 * is unreachable via Tavily (Relais & Châteaux portal pages render their
 * galleries client-side → 0 yield; Four Seasons DAM hotlink-blocks).
 *
 * Google Places is a trusted, attributed source already used by
 * `sync-hotel-photos.ts` tier 2. Its photo URLs resolve to
 * `lh3.googleusercontent.com`, whitelisted in `parent-group-mapping.ts`
 * (`HOSTNAME_WHITELIST_GLOBAL`) so the upload filter accepts them.
 *
 * The split (discovery JSON → curated upload) is preserved on purpose:
 * the upload step Vision-curates (category + alt FR/EN + caption +
 * quality + keep) and APPENDS to `hotels.gallery_images`, NEVER
 * overwriting the existing curated hero + gallery — unlike
 * `sync-hotel-photos.ts` which replaces them wholesale.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/gen-places-discovery.ts \
 *     --slugs-file=runs/tier-b-cohort.json --per-hotel=14
 *
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/gen-places-discovery.ts \
 *     --slugs=four-seasons-hotel-florence,gidleigh-park
 *
 * Then:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/upload-press-kit-images.ts \
 *     --discovery-dir=runs --slugs=<same> --limit=8 --dry-run
 *
 * Skills: photo-pipeline (§Tavily press-kit discovery, §Google Places),
 *         api-integration, llm-output-robustness
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defaultPlacesConfig,
  fetchPlacePhotos,
  searchPlaceByNameAndCity,
  type GooglePlacesClientConfig,
} from '@mch/integrations/google-places';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ─── CLI ────────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slugs: readonly string[];
  readonly perHotel: number;
  readonly throttleMs: number;
}

function readSlugsFile(path: string): string[] {
  const raw = readFileSync(resolve(path), 'utf8').trim();
  if (raw.startsWith('[')) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  return raw
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let perHotel = 14;
  let throttleMs = 400;
  for (const arg of argv) {
    if (arg.startsWith('--slugs-file=')) {
      slugs = readSlugsFile(arg.slice('--slugs-file='.length));
    } else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--per-hotel=')) {
      perHotel = Number.parseInt(arg.slice('--per-hotel='.length), 10);
    } else if (arg.startsWith('--throttle-ms=')) {
      throttleMs = Number.parseInt(arg.slice('--throttle-ms='.length), 10);
    }
  }
  if (slugs.length === 0) {
    throw new Error('Pass --slugs=a,b or --slugs-file=<path>');
  }
  if (!Number.isFinite(perHotel) || perHotel <= 0) perHotel = 14;
  return { slugs, perHotel, throttleMs };
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function buildSupabaseRestConfig(): SupabaseRestConfig {
  const env = loadPhotoEnv();
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

interface RawHotelRow {
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly official_url: unknown;
  readonly gallery_images: unknown;
}

interface HotelMeta {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly officialUrl: string | null;
  readonly galleryCount: number;
}

async function fetchHotelMeta(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<readonly HotelMeta[]> {
  const inFilter = `slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
  const raws = await selectHotels<RawHotelRow>(cfg, {
    columns: 'slug,name,city,official_url,gallery_images',
    filters: [inFilter],
    limit: slugs.length,
  });
  return raws.map((row) => {
    const gallery = Array.isArray(row.gallery_images) ? row.gallery_images : [];
    return {
      slug: String(row.slug),
      name: String(row.name),
      city: typeof row.city === 'string' ? row.city : '',
      officialUrl: typeof row.official_url === 'string' ? row.official_url : null,
      galleryCount: gallery.length,
    };
  });
}

// ─── Discovery JSON shape (must match upload-press-kit DiscoveryReportSchema) ─

interface DiscoveryImage {
  readonly url: string;
  readonly description: string | null;
  readonly fromQueries: readonly string[];
  readonly hostname: string;
  readonly extension: string | null;
}

interface DiscoveryReport {
  readonly slug: string;
  readonly name: string;
  readonly officialUrl: string | null;
  readonly inferredDomain: string | null;
  readonly currentGalleryCount: number;
  readonly totalUniqueImages: number;
  readonly images: readonly DiscoveryImage[];
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'lh3.googleusercontent.com';
  }
}

async function genForHotel(
  hotel: HotelMeta,
  placesCfg: GooglePlacesClientConfig,
  perHotel: number,
): Promise<DiscoveryReport | null> {
  const search = await searchPlaceByNameAndCity(placesCfg, hotel.name, hotel.city);
  if (!search.ok) {
    console.warn(`  [places] search failed for ${hotel.slug}: ${JSON.stringify(search.error)}`);
    return null;
  }
  if (search.value.photos.length === 0) {
    console.warn(`  [places] ${hotel.slug}: place ${search.value.id} has 0 photos`);
    return null;
  }
  const photos = await fetchPlacePhotos(placesCfg, search.value.photos, perHotel);
  if (!photos.ok) {
    console.warn(`  [places] fetch failed for ${hotel.slug}: ${JSON.stringify(photos.error)}`);
    return null;
  }
  const images: DiscoveryImage[] = photos.value.map((p) => ({
    url: p.downloadUrl,
    description: p.attribution ?? null,
    fromQueries: ['google-places'],
    hostname: hostnameOf(p.downloadUrl),
    extension: null,
  }));
  return {
    slug: hotel.slug,
    name: hotel.name,
    officialUrl: hotel.officialUrl,
    inferredDomain: null,
    currentGalleryCount: hotel.galleryCount,
    totalUniqueImages: images.length,
    images,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsGooglePlaces: true });
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    throw new Error('GOOGLE_PLACES_API_KEY required');
  }
  const placesCfg = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);
  const supaCfg = buildSupabaseRestConfig();

  const hotels = await fetchHotelMeta(supaCfg, args.slugs);
  const bySlug = new Map(hotels.map((h) => [h.slug, h]));
  const missing = args.slugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) {
    console.warn(
      `[gen-places-discovery] ${missing.length} slug(s) not found: ${missing.join(', ')}`,
    );
  }

  const outDir = resolve(__dirname, '../../runs');
  mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');

  let written = 0;
  let empty = 0;
  for (const slug of args.slugs) {
    const hotel = bySlug.get(slug);
    if (hotel === undefined) continue;
    console.log(
      `\n→ ${slug} (${hotel.name}, ${hotel.city}) — current gallery ${hotel.galleryCount}`,
    );
    const report = await genForHotel(hotel, placesCfg, args.perHotel);
    if (report === null || report.images.length === 0) {
      empty += 1;
    } else {
      const file = resolve(outDir, `press-kit-discovery-${slug}-${ts}.json`);
      writeFileSync(file, JSON.stringify(report, null, 2), 'utf8');
      console.log(`  wrote ${report.images.length} candidate(s) → ${file}`);
      written += 1;
    }
    if (args.throttleMs > 0) await sleep(args.throttleMs);
  }

  console.log(`\n=== gen-places-discovery done ===`);
  console.log(`Discovery files written: ${written}`);
  console.log(`Hotels with no Places photos: ${empty}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
