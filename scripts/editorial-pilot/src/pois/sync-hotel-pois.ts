/**
 * sync-hotel-pois.ts — POI orchestrator for hotel detail pages.
 *
 * Pipeline per hotel
 * ------------------
 * 1. Detect urban/rural mode from the city name (whitelist).
 * 2. Fetch DT POIs around (3-bucket curation, cap = 24).
 * 3. Fetch Overpass UTILITY amenities around (pharmacy/bakery/…).
 * 4. Fetch Overpass transit stations around (urban only).
 * 5. Merge DT + Overpass into a single list (cap 22, sorted by
 *    bucket + distance).
 * 6. Optional: ask gpt-4o-mini for 1-2 sentence FR + EN descriptions
 *    per POI (bounded concurrency, EEAT-safe).
 * 7. UPDATE `hotels.points_of_interest` (idempotent JSONB overwrite).
 * 8. Append a JSONL line to `out/pois-runlog-YYYY-MM-DD.jsonl`.
 *
 * Selection (CLI)
 * ---------------
 *   --slug=<slug>          : single hotel
 *   --bucket=palaces|stars5|enriched|all
 *   --limit=N              : cap on the bucket
 *   --concurrency=N        : parallel hotels (default 2 — Overpass throttles hard above 3)
 *   --no-llm               : skip the description pass (free, fast)
 *   --dry-run              : skip the UPDATE step + print preview
 *
 * CLI examples
 * ------------
 *   pnpm pois:sync --slug=le-bristol-paris --dry-run
 *   pnpm pois:sync --slug=cheval-blanc-courchevel
 *   pnpm pois:sync --bucket=palaces --concurrency=2
 *   pnpm pois:sync --bucket=all --no-llm
 *
 * Cost (109 hotels × ~25 POIs × gpt-4o-mini) ≈ $0.30 — see
 * `llm-describe-pois.ts` for the breakdown.
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defaultOverpassConfig,
  fetchAmenitiesAround,
  fetchTransitStationsAround,
} from '@mch/integrations/overpass';

import { fetchPOIsAround, DEFAULT_RADII_URBAN, DEFAULT_RADII_RURAL } from '../enrichment/datatourisme.js';
import { loadPhotoEnv } from '../photos/env-photos.js';
import { selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

import { describePoisBatch, type DescribePoiInput } from './llm-describe-pois.js';
import { mergePois, type MergedPoi } from './merge-pois.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

type Bucket = 'palaces' | 'stars5' | 'enriched' | 'all';

interface CliArgs {
  readonly slug: string | null;
  readonly bucket: Bucket | null;
  readonly limit: number;
  readonly concurrency: number;
  readonly noLlm: boolean;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let bucket: Bucket | null = null;
  let limit = 150;
  let concurrency = 2;
  let noLlm = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--no-llm') noLlm = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--bucket=')) {
      const v = arg.slice('--bucket='.length);
      if (v === 'palaces' || v === 'stars5' || v === 'enriched' || v === 'all') bucket = v;
      else throw new Error(`Unknown --bucket value: ${v}`);
    } else if (arg.startsWith('--limit=')) {
      limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(1, Number.parseInt(arg.slice('--concurrency='.length), 10));
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown CLI arg: ${arg}`);
    }
  }
  if (slug === null && bucket === null) {
    throw new Error('Either --slug=<hotel-slug> or --bucket=<name> is required. See --help.');
  }
  if (!Number.isFinite(limit) || limit <= 0) throw new Error('--limit must be a positive integer');
  return { slug, bucket, limit, concurrency, noLlm, dryRun };
}

function printHelp(): void {
  console.log(`Usage: pnpm pois:sync [options]

Options
-------
  --slug=<hotel-slug>   Single hotel
  --bucket=<name>       palaces | stars5 | enriched | all
  --limit=N             Cap hotels (default 150)
  --concurrency=N       Parallel hotels (default 2; Overpass throttles hard above 3)
  --no-llm              Skip LLM descriptions (free, fast)
  --dry-run             Skip UPDATE + print preview
  --help                Show this message

Examples
--------
  pnpm pois:sync --slug=le-bristol-paris --dry-run
  pnpm pois:sync --bucket=palaces --concurrency=2
  pnpm pois:sync --bucket=all --no-llm`);
}

// ---------------------------------------------------------------------------
// Urban / rural detection
// ---------------------------------------------------------------------------

/**
 * Cities for which we use the URBAN radii (tighter — denser POI mesh).
 * Every other city falls back to RURAL radii. Match is case-insensitive
 * and accent-insensitive — the city column is occasionally stored with
 * non-NFC accents.
 */
const URBAN_CITIES = new Set(
  [
    'paris',
    'lyon',
    'marseille',
    'nice',
    'cannes',
    'bordeaux',
    'lille',
    'toulouse',
    'nantes',
    'strasbourg',
    'rennes',
    'montpellier',
    'reims',
    'rouen',
    'biarritz',
    'saint-tropez',
    'aix-en-provence',
    'avignon',
    'monaco',
    'monte-carlo',
  ].map((c) => c.toLowerCase()),
);

function normalise(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .trim();
}

function isUrban(city: string): boolean {
  return URBAN_CITIES.has(normalise(city));
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
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly long_description_sections: unknown;
}

const HOTEL_COLS =
  'id, slug, name, city, is_palace, stars, latitude, longitude, long_description_sections';

async function pickHotels(cfg: SupabaseRestConfig, args: CliArgs): Promise<HotelRow[]> {
  if (args.slug !== null) {
    return selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLS,
      filters: [`slug=eq.${args.slug}`],
      limit: 1,
    });
  }
  const filters: string[] = ['is_published=eq.true', 'latitude=not.is.null', 'longitude=not.is.null'];
  if (args.bucket === 'palaces') {
    filters.push('is_palace=eq.true');
  } else if (args.bucket === 'stars5') {
    filters.push('is_palace=eq.false', 'stars=eq.5');
  } else if (args.bucket === 'enriched') {
    filters.push('long_description_sections=not.is.null');
  }
  return selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'is_palace.desc.nullslast,priority.asc',
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
  readonly urban: boolean;
  readonly dt_count?: number;
  readonly osm_count?: number;
  readonly transit_count?: number;
  readonly merged_count?: number;
  readonly llm_described?: number;
  readonly llm_failed?: number;
  readonly reason?: string;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `pois-runlog-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Supabase REST UPDATE (the photos helper only patches the photo columns)
// ---------------------------------------------------------------------------

async function updateHotelPois(
  cfg: SupabaseRestConfig,
  hotelId: string,
  pois: readonly MergedPoi[],
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
    body: JSON.stringify({ points_of_interest: pois }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------------------
// Per-hotel processing
// ---------------------------------------------------------------------------

interface HotelOutcome {
  readonly slug: string;
  readonly outcome: 'ok' | 'skip' | 'fail';
  readonly urban: boolean;
  readonly dtCount: number;
  readonly osmCount: number;
  readonly transitCount: number;
  readonly mergedCount: number;
  readonly llmDescribed: number;
  readonly llmFailed: number;
  readonly reason?: string;
}

async function processHotel(
  hotel: HotelRow,
  args: CliArgs,
  supa: SupabaseRestConfig,
): Promise<HotelOutcome> {
  console.log(`\n→ ${hotel.slug} (${hotel.name}, ${hotel.city})`);

  if (hotel.latitude === null || hotel.longitude === null) {
    return {
      slug: hotel.slug,
      outcome: 'skip',
      urban: false,
      dtCount: 0,
      osmCount: 0,
      transitCount: 0,
      mergedCount: 0,
      llmDescribed: 0,
      llmFailed: 0,
      reason: 'no lat/lng',
    };
  }

  const urban = isUrban(hotel.city);
  const ovCfg = defaultOverpassConfig('https://myconciergehotel.com');

  // 1. DT POIs
  const dtRadii = urban ? DEFAULT_RADII_URBAN : DEFAULT_RADII_RURAL;
  let dtPois: Awaited<ReturnType<typeof fetchPOIsAround>> = [];
  try {
    dtPois = await fetchPOIsAround(hotel.latitude, hotel.longitude, {
      radiusMeters: dtRadii,
      caps: { visit: 8, do: 6, shop: 5 },
      limit: 80,
    });
    console.log(`  [dt]    ${dtPois.length} POIs (${urban ? 'urban' : 'rural'} radii)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  [dt]    FAILED: ${msg.slice(0, 200)} — continuing with OSM only`);
  }

  // 2. Overpass utility amenities (always 400 m urban, 800 m rural)
  const amenRadius = urban ? 400 : 800;
  const amenRes = await fetchAmenitiesAround(ovCfg, hotel.latitude, hotel.longitude, {
    radiusMeters: amenRadius,
    limit: 12,
  });
  let osmAmenities: typeof amenRes extends infer R
    ? R extends { value: infer V }
      ? V
      : never
    : never = [] as never;
  if (amenRes.ok) {
    osmAmenities = amenRes.value as typeof osmAmenities;
    console.log(`  [osm]   ${osmAmenities.length} utility amenities (radius ${amenRadius}m)`);
  } else {
    console.warn(`  [osm]   FAILED: ${JSON.stringify(amenRes.error)} — proceeding`);
  }

  // 3. Overpass transit stations (urban only — rural rarely has metro)
  let transit: Awaited<ReturnType<typeof fetchTransitStationsAround>> extends infer R
    ? R extends { value: infer V }
      ? V
      : never
    : never = [] as never;
  if (urban) {
    const trRes = await fetchTransitStationsAround(ovCfg, hotel.latitude, hotel.longitude, {
      radiusMeters: 600,
      limit: 20,
    });
    if (trRes.ok) {
      transit = trRes.value as typeof transit;
      console.log(`  [tr]    ${transit.length} transit stations within 600m`);
    } else {
      console.warn(`  [tr]    FAILED: ${JSON.stringify(trRes.error)} — proceeding without transit`);
    }
  }

  // 4. Merge
  const merged = mergePois(dtPois, osmAmenities, transit);
  console.log(`  [merge] ${merged.length} POIs after cap+dedup`);

  if (merged.length === 0) {
    return {
      slug: hotel.slug,
      outcome: 'skip',
      urban,
      dtCount: dtPois.length,
      osmCount: osmAmenities.length,
      transitCount: transit.length,
      mergedCount: 0,
      llmDescribed: 0,
      llmFailed: 0,
      reason: 'no POIs found',
    };
  }

  // 5. LLM descriptions (optional)
  let described: readonly MergedPoi[] = merged;
  let llmDescribed = 0;
  let llmFailed = 0;
  if (!args.noLlm) {
    const inputs: DescribePoiInput[] = merged.map((p) => ({
      name: p.name,
      type: p.type,
      bucket: p.bucket,
      category: p.category_fr ?? null,
      city: hotel.city,
      distanceMeters: p.distance_meters,
      walkMinutes: p.walk_minutes,
      factAnchor: null,
    }));
    const descriptions = await describePoisBatch(inputs, { concurrency: 4 });
    described = merged.map((p, i) => {
      const d = descriptions[i];
      if (d === null || d === undefined) {
        llmFailed += 1;
        return p;
      }
      llmDescribed += 1;
      return { ...p, description_fr: d.descriptionFr, description_en: d.descriptionEn };
    });
    console.log(`  [llm]   described ${llmDescribed}/${merged.length} (failed ${llmFailed})`);
  } else {
    console.log(`  [llm]   skipped (--no-llm)`);
  }

  // 6. UPDATE
  if (args.dryRun) {
    console.log(`  [dry]   would UPDATE hotels.points_of_interest with ${described.length} POIs`);
    console.log(`          first POI preview: ${JSON.stringify(described[0]).slice(0, 200)}…`);
  } else {
    await updateHotelPois(supa, hotel.id, described);
    console.log(`  [db]    UPDATED hotels.points_of_interest`);
  }

  return {
    slug: hotel.slug,
    outcome: 'ok',
    urban,
    dtCount: dtPois.length,
    osmCount: osmAmenities.length,
    transitCount: transit.length,
    mergedCount: described.length,
    llmDescribed,
    llmFailed,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const supa: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const runlogPath = ensureRunlog();
  console.log(`POI orchestrator — args: ${JSON.stringify(args)}`);
  console.log(`Runlog: ${runlogPath}`);

  const hotels = await pickHotels(supa, args);
  if (hotels.length === 0) {
    console.log('No hotels matched. Done.');
    return;
  }
  console.log(`Selected ${hotels.length} hotel(s) to process.`);

  const queue = [...hotels];
  const results: HotelOutcome[] = [];

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const hotel = queue.shift();
      if (hotel === undefined) break;
      try {
        const out = await processHotel(hotel, args, supa);
        results.push(out);
        logEntry(runlogPath, {
          ts: new Date().toISOString(),
          slug: out.slug,
          outcome: out.outcome,
          urban: out.urban,
          dt_count: out.dtCount,
          osm_count: out.osmCount,
          transit_count: out.transitCount,
          merged_count: out.mergedCount,
          llm_described: out.llmDescribed,
          llm_failed: out.llmFailed,
          ...(out.reason !== undefined ? { reason: out.reason } : {}),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  CRASH on ${hotel.slug}: ${msg}`);
        const failed: HotelOutcome = {
          slug: hotel.slug,
          outcome: 'fail',
          urban: false,
          dtCount: 0,
          osmCount: 0,
          transitCount: 0,
          mergedCount: 0,
          llmDescribed: 0,
          llmFailed: 0,
          reason: `crash: ${msg.slice(0, 200)}`,
        };
        results.push(failed);
        logEntry(runlogPath, {
          ts: new Date().toISOString(),
          slug: hotel.slug,
          outcome: 'fail',
          urban: false,
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
  const totalPois = results.reduce((acc, r) => acc + r.mergedCount, 0);
  const totalDescribed = results.reduce((acc, r) => acc + r.llmDescribed, 0);

  console.log(`\n=== Summary ===`);
  console.log(`OK:   ${okCount}`);
  console.log(`SKIP: ${skipCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`Total POIs persisted: ${totalPois}`);
  console.log(`Total LLM descriptions: ${totalDescribed}`);
  console.log(`Runlog: ${runlogPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
