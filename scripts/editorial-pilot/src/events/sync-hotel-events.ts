/**
 * sync-hotel-events.ts — upcoming events orchestrator for hotel
 * detail pages (CDC §2 "À proximité" — events block).
 *
 * Pipeline per hotel
 * ------------------
 * 1. Detect urban/rural mode from city name (same whitelist as POIs).
 * 2. Fetch DT events around (radius = 10 km urban, 30 km rural,
 *    window = today + 7d to today + 60d, cap = 5).
 * 3. Optional: ask gpt-4o-mini for 1-2 sentence FR + EN descriptions
 *    per event (bounded concurrency, EEAT-safe).
 * 4. UPDATE `hotels.upcoming_events` (idempotent JSONB overwrite).
 * 5. Append a JSONL line to `out/events-runlog-YYYY-MM-DD.jsonl`.
 *
 * Selection (CLI)
 * ---------------
 *   --slug=<slug>          : single hotel
 *   --bucket=palaces|stars5|all
 *   --limit=N              : cap on the bucket
 *   --concurrency=N        : parallel hotels (default 3 — DT is slower than Overpass)
 *   --no-llm               : skip the description pass (free, fast)
 *   --dry-run              : skip the UPDATE step + print preview
 *
 * CLI examples
 * ------------
 *   pnpm events:sync --slug=le-bristol-paris --dry-run
 *   pnpm events:sync --slug=le-bristol-paris
 *   pnpm events:sync --bucket=palaces --concurrency=3
 *
 * Cost
 * ----
 * gpt-4o-mini, ~140 in / 80 out tokens per event. 109 hotels × ~3
 * events ≈ 327 calls ≈ $0.04. DT calls are free.
 *
 * Why a weekly cron is fine
 * --------------------------
 * Events surface in a 7-60d window — a week-old snapshot still shows
 * the same upcoming list 95 % of the time. Daily would be overkill
 * for the noise level (regional ODTs update once a week typically).
 */

import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchEventsAround, type DtEvent } from '../enrichment/datatourisme.js';
import { loadPhotoEnv } from '../photos/env-photos.js';
import { selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

import { describeEventsBatch, type DescribeEventInput } from './llm-describe-events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

type Bucket = 'palaces' | 'stars5' | 'all';

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
  let concurrency = 3;
  let noLlm = false;
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--no-llm') noLlm = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--bucket=')) {
      const b = arg.slice('--bucket='.length);
      if (b === 'palaces' || b === 'stars5' || b === 'all') bucket = b;
      else throw new Error(`Invalid --bucket=${b}. Expected palaces|stars5|all.`);
    } else if (arg.startsWith('--limit=')) {
      limit = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error('--limit must be a positive integer');
      }
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Number.parseInt(arg.slice('--concurrency='.length), 10);
      if (!Number.isFinite(concurrency) || concurrency <= 0) {
        throw new Error('--concurrency must be a positive integer');
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: pnpm events:sync [options]

Options
-------
  --slug=<slug>      Process a single hotel
  --bucket=<b>       palaces | stars5 | all (default = all, requires --concurrency=1 for caution)
  --limit=N          Cap hotels (default 150)
  --concurrency=N    Parallel hotels (default 3)
  --no-llm           Skip the LLM description pass
  --dry-run          Print would-be writes without touching the DB
  --help             Show this message`);
      process.exit(0);
    } else {
      console.warn(`Ignoring unknown CLI arg: ${arg}`);
    }
  }
  // Default bucket = all when no slug/bucket given.
  if (slug === null && bucket === null) bucket = 'all';
  return { slug, bucket, limit, concurrency, noLlm, dryRun };
}

// ---------------------------------------------------------------------------
// Urban / rural detection — same whitelist as sync-hotel-pois.ts
// ---------------------------------------------------------------------------

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
}

const HOTEL_COLS = 'id, slug, name, city, is_palace, stars, latitude, longitude';

async function pickHotels(cfg: SupabaseRestConfig, args: CliArgs): Promise<HotelRow[]> {
  if (args.slug !== null) {
    return selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLS,
      filters: [`slug=eq.${args.slug}`],
      limit: 1,
    });
  }
  const filters: string[] = [
    'is_published=eq.true',
    'latitude=not.is.null',
    'longitude=not.is.null',
  ];
  if (args.bucket === 'palaces') {
    filters.push('is_palace=eq.true');
  } else if (args.bucket === 'stars5') {
    filters.push('is_palace=eq.false', 'stars=eq.5');
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
  readonly persisted_count?: number;
  readonly llm_described?: number;
  readonly llm_failed?: number;
  readonly reason?: string;
}

function ensureRunlog(): string {
  const dir = resolve(__dirname, '../../out');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  return resolve(dir, `events-runlog-${date}.jsonl`);
}

function logEntry(path: string, entry: RunlogEntry): void {
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// Persistence shape (matches `upcoming_events` Zod schema in
// apps/web/src/server/hotels/get-hotel-by-slug.ts)
// ---------------------------------------------------------------------------

interface PersistedEvent {
  readonly name: string;
  readonly start_date: string;
  readonly end_date: string | null;
  readonly venue_name: string | null;
  readonly venue_address: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly distance_meters: number;
  readonly category: DtEvent['category'];
  readonly description_fr: string | null;
  readonly description_en: string | null;
  readonly pricing: { readonly type: 'free' | 'paid'; readonly amount_eur: number | null } | null;
  readonly url: string | null;
  readonly dt_uuid: string;
}

async function updateHotelEvents(
  cfg: SupabaseRestConfig,
  hotelId: string,
  events: readonly PersistedEvent[],
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
    body: JSON.stringify({ upcoming_events: events }),
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
  readonly persistedCount: number;
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
      persistedCount: 0,
      llmDescribed: 0,
      llmFailed: 0,
      reason: 'no lat/lng',
    };
  }

  const urban = isUrban(hotel.city);

  // 1. DT events
  let events: readonly DtEvent[] = [];
  try {
    events = await fetchEventsAround(hotel.latitude, hotel.longitude, {
      radiusMeters: urban ? 10_000 : 30_000,
      lookaheadDays: 0,
      horizonDays: 60,
      limit: 5,
    });
    console.log(`  [dt]    ${events.length} events (${urban ? 'urban' : 'rural'})`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`  [dt]    FAILED: ${msg.slice(0, 200)}`);
    return {
      slug: hotel.slug,
      outcome: 'fail',
      urban,
      dtCount: 0,
      persistedCount: 0,
      llmDescribed: 0,
      llmFailed: 0,
      reason: `dt: ${msg.slice(0, 200)}`,
    };
  }

  if (events.length === 0) {
    // Empty array is a valid outcome — we still persist `[]` so the
    // page surface knows we ran and found nothing. Avoids the
    // "stale events from previous sync" failure mode.
    if (!args.dryRun) {
      await updateHotelEvents(supa, hotel.id, []);
      console.log(`  [db]    UPDATED hotels.upcoming_events := [] (no events found)`);
    } else {
      console.log(`  [dry]   would UPDATE hotels.upcoming_events := []`);
    }
    return {
      slug: hotel.slug,
      outcome: 'ok',
      urban,
      dtCount: 0,
      persistedCount: 0,
      llmDescribed: 0,
      llmFailed: 0,
    };
  }

  // 2. LLM descriptions (optional)
  let descriptions: ReadonlyArray<{
    readonly descriptionFr: string;
    readonly descriptionEn: string;
  } | null> = [];
  let llmDescribed = 0;
  let llmFailed = 0;
  if (!args.noLlm) {
    const inputs: DescribeEventInput[] = events.map((e) => ({
      name: e.name,
      category: e.category,
      city: hotel.city,
      venueName: e.venueName,
      startDate: e.startDate,
      endDate: e.endDate,
      factAnchor: e.descriptionShort,
    }));
    descriptions = await describeEventsBatch(inputs, { concurrency: 4 });
    llmDescribed = descriptions.filter((d) => d !== null).length;
    llmFailed = descriptions.length - llmDescribed;
    console.log(`  [llm]   described ${llmDescribed}/${events.length} (failed ${llmFailed})`);
  } else {
    console.log(`  [llm]   skipped (--no-llm)`);
    descriptions = events.map(() => null);
  }

  // 3. Shape for persistence
  const persisted: PersistedEvent[] = events.map((e, i) => {
    const d = descriptions[i] ?? null;
    return {
      name: e.name,
      start_date: e.startDate,
      end_date: e.endDate,
      venue_name: e.venueName,
      venue_address: e.venueAddress,
      latitude: e.latitude,
      longitude: e.longitude,
      distance_meters: e.distanceMeters,
      category: e.category,
      description_fr: d?.descriptionFr ?? null,
      description_en: d?.descriptionEn ?? null,
      pricing: e.pricing ? { type: e.pricing.type, amount_eur: e.pricing.amountEur } : null,
      url: e.officialUrl,
      dt_uuid: e.uuid,
    };
  });

  // 4. UPDATE
  if (args.dryRun) {
    console.log(`  [dry]   would UPDATE hotels.upcoming_events with ${persisted.length} events`);
    console.log(`          first event preview: ${JSON.stringify(persisted[0]).slice(0, 250)}…`);
  } else {
    await updateHotelEvents(supa, hotel.id, persisted);
    console.log(`  [db]    UPDATED hotels.upcoming_events`);
  }

  return {
    slug: hotel.slug,
    outcome: 'ok',
    urban,
    dtCount: events.length,
    persistedCount: persisted.length,
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
  console.log(`Events orchestrator — args: ${JSON.stringify(args)}`);
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
          persisted_count: out.persistedCount,
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
          persistedCount: 0,
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
  const totalEvents = results.reduce((acc, r) => acc + r.persistedCount, 0);
  const totalDescribed = results.reduce((acc, r) => acc + r.llmDescribed, 0);

  console.log(`\n=== Summary ===`);
  console.log(`OK:   ${okCount}`);
  console.log(`SKIP: ${skipCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`Total events persisted: ${totalEvents}`);
  console.log(`Total LLM descriptions: ${totalDescribed}`);
  console.log(`Runlog: ${runlogPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
