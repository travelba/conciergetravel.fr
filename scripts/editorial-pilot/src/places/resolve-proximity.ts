/**
 * resolve-proximity.ts — batch resolver for `place_hotel_links`.
 *
 * For every published place, find the nearest published hotels (and vice
 * versa, since the link table is symmetric) using the pure haversine
 * resolver in `@mch/domain/places`. UPSERTs the `place_hotel_links` rows
 * idempotently.
 *
 * CLI
 * ---
 *   --city=<city_key>   : only resolve places in this city (e.g. paris)
 *   --max-meters=N      : proximity cutoff (default 1500)
 *   --limit-per=N       : max hotels linked per place (default 8)
 *   --dry-run           : compute + print, skip the UPSERT
 *
 * Examples
 * --------
 *   pnpm places:proximity --city=paris --dry-run
 *   pnpm places:proximity --city=paris
 */
import { rankByProximity, toGeoPoint, type GeoPoint } from '@mch/domain/places';

import { loadPhotoEnv } from '../photos/env-photos.js';

import { selectTable, upsertRows, type SupabaseRestConfig } from './supabase-places.js';

interface PlaceRow {
  readonly id: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly city_key: string;
}

interface HotelRow {
  readonly id: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

interface CliArgs {
  readonly city: string | null;
  readonly maxMeters: number;
  readonly limitPer: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city: string | null = null;
  let maxMeters = 1500;
  let limitPer = 8;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--max-meters=')) maxMeters = Number.parseInt(arg.slice(13), 10);
    else if (arg.startsWith('--limit-per=')) limitPer = Number.parseInt(arg.slice(12), 10);
    else if (arg === '--dry-run') dryRun = true;
  }
  return { city, maxMeters, limitPer, dryRun };
}

function hotelCoords(h: HotelRow): GeoPoint | null {
  return toGeoPoint(h.latitude, h.longitude);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const placeFilters = ['is_published=eq.true'];
  if (args.city !== null) placeFilters.push(`city_key=eq.${args.city}`);

  const places = await selectTable<PlaceRow>(cfg, 'places', {
    columns: 'id, latitude, longitude, city_key',
    filters: placeFilters,
    order: 'id.asc',
  });

  // Published hotels with coordinates. The link table is geographic so we
  // fetch the full published set once and rank in-memory per place.
  const hotels = await selectTable<HotelRow>(cfg, 'hotels', {
    columns: 'id, latitude, longitude',
    filters: ['is_published=eq.true', 'latitude=not.is.null'],
    order: 'id.asc',
  });

  console.log(
    `[proximity] ${String(places.length)} places × ${String(hotels.length)} hotels` +
      `${args.city !== null ? ` (city=${args.city})` : ''}`,
  );

  let linkCount = 0;
  let resolvedPlaces = 0;
  for (const place of places) {
    const anchor = toGeoPoint(place.latitude, place.longitude);
    if (anchor === null) continue;
    const ranked = rankByProximity(anchor, hotels, hotelCoords, {
      maxMeters: args.maxMeters,
      limit: args.limitPer,
    });
    if (ranked.length === 0) continue;
    resolvedPlaces += 1;

    const rows = ranked.map((r) => ({
      place_id: place.id,
      hotel_id: r.item.id,
      distance_meters: r.distanceMeters,
      walk_minutes: r.walkMinutes,
    }));
    linkCount += rows.length;

    if (args.dryRun) {
      console.log(`  place ${place.id}: ${String(rows.length)} hotels`);
    } else {
      await upsertRows(cfg, 'place_hotel_links', rows, 'place_id,hotel_id');
    }
  }

  console.log(
    `[proximity] ${args.dryRun ? 'DRY-RUN ' : ''}resolved ${String(resolvedPlaces)} places, ` +
      `${String(linkCount)} links.`,
  );
}

main().catch((e: unknown) => {
  console.error('[proximity] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
