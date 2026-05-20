/**
 * sync-hotel-geocoding.ts — fill `hotels.latitude` + `hotels.longitude`
 * for stubs imported without coordinates (typically the Atout France
 * 5-star bulk import).
 *
 * Why
 * ---
 * 70 of the 106 published hotels were imported as stubs without
 * lat/lng. That blocks downstream pipelines: POI sync (geo_distance
 * filter), map rendering, transit attribution, events sourcing. This
 * orchestrator runs once to backfill them so every other workstream
 * can target the full catalogue.
 *
 * Pipeline per hotel
 * ------------------
 * 1. Skip if `latitude IS NOT NULL` (idempotent).
 * 2. Build `name + city + country` query, hit Google Places
 *    `searchText` with `includedType: lodging` and `places.location`
 *    in the FieldMask.
 * 3. Persist `latitude`, `longitude`, plus `google_place_id` (handy
 *    for the photo Tier 2 later) and `address` if it was null.
 * 4. JSONL runlog.
 *
 * Cost: $32 / 1k requests → < $0.30 for 70 hotels.
 *
 * CLI
 * ---
 *   pnpm geocode:hotels --dry-run
 *   pnpm geocode:hotels --slug=hotel-de-paris-monte-carlo
 *   pnpm geocode:hotels --limit=10
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultPlacesConfig, geocodeHotelQuery } from '@mch/integrations/google-places';

import { loadPhotoEnv } from '../photos/env-photos.js';
import { selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  readonly dryRun: boolean;
  readonly slug: string | null;
  readonly limit: number;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let slug: string | null = null;
  let limit = 200;
  let force = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--force') force = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: pnpm geocode:hotels [options]

Options
-------
  --slug=<hotel-slug>   Only geocode this hotel (overrides --force/--limit)
  --limit=N             Cap hotels (default 200)
  --force               Re-geocode hotels that already have lat/lng (rare)
  --dry-run             Print would-be writes without touching the DB
  --help                Show this message`);
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown CLI arg: ${arg}`);
    }
  }
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('--limit must be a positive integer');
  return { dryRun, slug, limit, force };
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly google_place_id: string | null;
  readonly country_code: string | null;
}

const HOTEL_COLS =
  'id, slug, name, city, address, latitude, longitude, google_place_id, country_code';

/** ISO-3166-α2 → display name used in the Google Places query.
 *  We only list countries that appear in the catalogue; an unknown code
 *  falls back to the alpha-2 code itself, which Google understands well. */
const COUNTRY_NAMES: Readonly<Record<string, string>> = {
  AE: 'United Arab Emirates',
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Belgium',
  BL: 'Saint Barthélemy',
  BR: 'Brazil',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  CR: 'Costa Rica',
  CW: 'Curaçao',
  CZ: 'Czech Republic',
  DE: 'Germany',
  DM: 'Dominica',
  EG: 'Egypt',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  GR: 'Greece',
  HK: 'Hong Kong',
  HR: 'Croatia',
  HU: 'Hungary',
  ID: 'Indonesia',
  IN: 'India',
  IT: 'Italy',
  JP: 'Japan',
  KE: 'Kenya',
  KH: 'Cambodia',
  LC: 'Saint Lucia',
  LK: 'Sri Lanka',
  MA: 'Morocco',
  MC: 'Monaco',
  MN: 'Mongolia',
  MU: 'Mauritius',
  MV: 'Maldives',
  MX: 'Mexico',
  MY: 'Malaysia',
  NA: 'Namibia',
  NI: 'Nicaragua',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PH: 'Philippines',
  PT: 'Portugal',
  QA: 'Qatar',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SC: 'Seychelles',
  SE: 'Sweden',
  SG: 'Singapore',
  TH: 'Thailand',
  TR: 'Turkey',
  TZ: 'Tanzania',
  US: 'United States',
  VN: 'Vietnam',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

function countryNameFor(code: string | null): string {
  if (!code) return 'France';
  return COUNTRY_NAMES[code] ?? code;
}

async function pickHotels(cfg: SupabaseRestConfig, args: CliArgs): Promise<HotelRow[]> {
  if (args.slug !== null) {
    return selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLS,
      filters: [`slug=eq.${args.slug}`],
      limit: 1,
    });
  }
  // `MCH_INCLUDE_DRAFTS=1` extends the working set to draft hotels (e.g.
  // the 167 Yonder-derived rows scaffolded in May 2026 that are
  // `is_published=false` until editorial review).
  // `MCH_ONLY_SLUGS=slug-a,slug-b` further restricts the working set.
  const includeDrafts = process.env['MCH_INCLUDE_DRAFTS'] === '1';
  const onlySlugRaw = process.env['MCH_ONLY_SLUGS'] ?? '';
  const onlySlugs = onlySlugRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const filters: string[] = [];
  if (!includeDrafts) filters.push('is_published=eq.true');
  if (!args.force) {
    filters.push('latitude=is.null');
  }
  if (onlySlugs.length > 0) {
    filters.push(`slug=in.(${onlySlugs.join(',')})`);
  }
  return selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'priority.asc',
    limit: args.limit,
  });
}

interface RunlogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly lat?: number;
  readonly lng?: number;
  readonly confidence?: 'name_match' | 'fallback';
  readonly placeId?: string;
  readonly reason?: string;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `geocode-runlog-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

async function updateHotelGeo(
  cfg: SupabaseRestConfig,
  hotelId: string,
  payload: {
    readonly latitude: number;
    readonly longitude: number;
    readonly google_place_id: string;
    readonly address?: string;
  },
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    throw new Error(
      '[geocode] GOOGLE_PLACES_API_KEY is required. Add it to .env.local before running.',
    );
  }
  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const placesCfg = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);

  const runlogPath = ensureRunlog();
  console.log(`Geocoding orchestrator — args: ${JSON.stringify(args)}`);
  console.log(`Runlog: ${runlogPath}\n`);

  const hotels = await pickHotels(supa, args);
  if (hotels.length === 0) {
    console.log('No hotels matched (all already geocoded?). Done.');
    return;
  }
  console.log(`Selected ${hotels.length} hotel(s) to geocode.\n`);

  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Sequential — Google Text Search SKU has a soft 600 QPM cap and we
  // want predictable ordering for the runlog.
  for (const hotel of hotels) {
    process.stdout.write(`→ ${hotel.slug} (${hotel.name}, ${hotel.city})  `);

    if (!args.force && hotel.latitude !== null && hotel.longitude !== null) {
      console.log(`SKIP (already geocoded)`);
      skipCount += 1;
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: hotel.slug,
        outcome: 'skip',
        reason: 'already_geocoded',
      });
      continue;
    }

    const country = countryNameFor(hotel.country_code);
    const res = await geocodeHotelQuery(placesCfg, hotel.name, hotel.city, { country });
    if (!res.ok) {
      console.log(`FAIL ${JSON.stringify(res.error)}`);
      failCount += 1;
      logEntry(runlogPath, {
        ts: new Date().toISOString(),
        slug: hotel.slug,
        outcome: 'fail',
        reason: JSON.stringify(res.error).slice(0, 200),
      });
      continue;
    }

    const { latitude, longitude, placeId, formattedAddress, confidence } = res.value;
    console.log(
      `OK ${confidence} lat=${latitude.toFixed(5)} lng=${longitude.toFixed(5)} (${placeId})`,
    );

    if (!args.dryRun) {
      try {
        await updateHotelGeo(supa, hotel.id, {
          latitude,
          longitude,
          google_place_id: placeId,
          ...(hotel.address === null && formattedAddress !== null
            ? { address: formattedAddress }
            : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ↳ DB write failed: ${msg.slice(0, 200)}`);
        failCount += 1;
        logEntry(runlogPath, {
          ts: new Date().toISOString(),
          slug: hotel.slug,
          outcome: 'fail',
          reason: `db_write: ${msg.slice(0, 200)}`,
        });
        continue;
      }
    }

    okCount += 1;
    logEntry(runlogPath, {
      ts: new Date().toISOString(),
      slug: hotel.slug,
      outcome: 'ok',
      lat: latitude,
      lng: longitude,
      confidence,
      placeId,
    });
  }

  console.log(`\n=== Summary ===`);
  console.log(`OK:   ${okCount}`);
  console.log(`SKIP: ${skipCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`Runlog: ${runlogPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
