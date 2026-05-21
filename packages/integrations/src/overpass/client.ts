/**
 * Overpass API client (skill: api-integration).
 *
 * We use Overpass for two things:
 *   1. `fetchAmenitiesAround` — daily-life utility shops (pharmacy, bakery,
 *      supermarket, ATM, post-office, taxi, clinic) that DATAtourisme
 *      barely covers.
 *   2. `fetchTransitStationsAround` — metro / RER / tram / train stations
 *      used to compute `nearest_transit` per POI in urban contexts.
 *
 * Both endpoints share the same plumbing: build a QL query, POST to
 * Overpass via `retryingJsonRequest`, parse with Zod, compute haversine
 * distance to the anchor point, dedupe by `(osmType, osmId)`, sort.
 *
 * The free public instance at `overpass-api.de` enforces a soft 1
 * req/s policy and rejects long-running queries with HTTP 200 + a tiny
 * HTML "runtime error: Query timed out" payload. We map that case to
 * `query_timeout` so callers can fall back gracefully (rural hotels can
 * tolerate "no commerces found" without crashing the pipeline).
 */

import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '../http/retry-request';

import type { OverpassError } from './errors';
import {
  NormalisedOsmAmenitySchema,
  OverpassResponseSchema,
  UTILITY_AMENITY_TAGS,
  type NormalisedOsmAmenity,
  type OverpassElement,
  type UtilityAmenityTag,
} from './types';

export interface OverpassClientConfig {
  /** Default `https://overpass-api.de/api/interpreter`. Override in tests. */
  readonly endpoint: string;
  /**
   * User-Agent header — Overpass admins ask for an identifying UA per
   * https://wiki.openstreetmap.org/wiki/Overpass_API#Usage_policy
   */
  readonly userAgent: string;
  /** Overpass server-side timeout (seconds). We pass it inside the QL `[timeout:N]`. */
  readonly queryTimeoutSec: number;
}

export const DEFAULT_OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

export function defaultOverpassConfig(siteUrl: string): OverpassClientConfig {
  return {
    endpoint: DEFAULT_OVERPASS_ENDPOINT,
    userAgent: `MyConciergeHotelBot/0.1 (${siteUrl}; tech@myconciergehotel.com) OverpassAPI`,
    queryTimeoutSec: 25,
  };
}

// ---------------------------------------------------------------------------
// Distance + dedup helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

/**
 * Great-circle distance in metres (haversine). Accurate to ~0.5 % for
 * urban distances — good enough for "nearest pharmacy" UX.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}

/** Resolve a (way|relation)'s centroid, falling back to node lat/lon. */
function elementCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  if (el.center !== undefined) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

// ---------------------------------------------------------------------------
// Generic POST helper
// ---------------------------------------------------------------------------

/**
 * Overpass accepts the QL query as the request body. We send it
 * unframed (no `data=` URL-encoding) because that's the canonical
 * format and avoids URL-encoding bloat on long queries.
 *
 * Overpass quirk: a server-side QL timeout returns HTTP 200 with a
 * plain-text body starting with `<osm-script>` or `runtime error:`.
 * We detect both cases and surface them as `query_timeout`.
 */
async function postOverpassQuery(
  cfg: OverpassClientConfig,
  query: string,
): Promise<Result<readonly OverpassElement[], OverpassError>> {
  // Overpass POST endpoint expects `data=<URL-encoded QL>` in a
  // `application/x-www-form-urlencoded` body. Our shared
  // `retryingJsonRequest` helper supports this via `kind: 'form'`.
  // The response is parsed as JSON because the QL starts with `[out:json]`.
  const res = await retryingJsonRequest({
    url: cfg.endpoint,
    method: 'POST',
    headers: {
      'User-Agent': cfg.userAgent,
      Accept: 'application/json',
    },
    body: { kind: 'form', pairs: { data: query } },
    timeoutMs: (cfg.queryTimeoutSec + 5) * 1000,
    maxAttempts: 3,
  });

  if (!res.ok) {
    if (res.error.kind === 'rate_limited') return err({ kind: 'too_many_requests' });
    return err({ kind: 'http', error: res.error });
  }
  if (res.value.json === undefined) return err({ kind: 'empty_response' });

  const parsed = OverpassResponseSchema.safeParse(res.value.json);
  if (!parsed.success) {
    const lower = JSON.stringify(res.value.json).slice(0, 200).toLowerCase();
    if (lower.includes('timeout') || lower.includes('time out')) {
      return err({ kind: 'query_timeout' });
    }
    return err({
      kind: 'parse_failure',
      details: `overpass response shape: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    });
  }

  return ok(parsed.data.elements);
}

// ---------------------------------------------------------------------------
// fetchAmenitiesAround — UTILITY_AMENITY_TAGS
// ---------------------------------------------------------------------------

export interface FetchAmenitiesOptions {
  /** Search radius in metres (default 800 = ~10 min walk). */
  readonly radiusMeters?: number;
  /** Subset of UTILITY_AMENITY_TAGS to fetch (default all 7). */
  readonly tags?: readonly UtilityAmenityTag[];
  /** Max results to return AFTER distance sort + dedupe (default 30). */
  readonly limit?: number;
}

/**
 * Build the Overpass QL query that hits the 7 utility tags around an anchor.
 *
 * Notes
 * -----
 * - We use `nwr(around:R, lat, lon)["amenity"="<tag>"]` so we get both
 *   nodes (single shops) and ways/relations (mall units, hospital
 *   buildings). `out tags center` returns tags + centroid for w/r.
 * - The QL `[timeout:N]` is the server-side ceiling. We mirror it in
 *   the HTTP timeout above (+5s slack).
 * - `[out:json]` is mandatory — without it Overpass returns OSM XML.
 */
function buildAmenitiesQuery(
  cfg: OverpassClientConfig,
  lat: number,
  lon: number,
  radiusMeters: number,
  tags: readonly UtilityAmenityTag[],
): string {
  const filters = tags
    .map((t) => `  nwr(around:${radiusMeters},${lat},${lon})["amenity"="${t}"];`)
    .join('\n');
  return `[out:json][timeout:${cfg.queryTimeoutSec}];
(
${filters}
);
out tags center;`;
}

/**
 * Normalise + sort + dedupe Overpass elements into our typed shape.
 * Drops elements without `name`, without coords, or with an unknown
 * amenity tag (defence in depth — the QL filter already restricts).
 */
function normaliseAmenityElements(
  elements: readonly OverpassElement[],
  anchorLat: number,
  anchorLon: number,
): NormalisedOsmAmenity[] {
  const seen = new Set<string>();
  const out: NormalisedOsmAmenity[] = [];

  for (const el of elements) {
    const coords = elementCoords(el);
    if (coords === null) continue;
    const tags = el.tags ?? {};
    const name = tags['name'];
    if (name === undefined || name.trim().length === 0) continue;
    const amenityTag = tags['amenity'];
    if (amenityTag === undefined) continue;
    if (!UTILITY_AMENITY_TAGS.includes(amenityTag as UtilityAmenityTag)) continue;

    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const distanceMeters = haversineMeters(anchorLat, anchorLon, coords.lat, coords.lon);
    const houseNumber = tags['addr:housenumber'];
    const street = tags['addr:street'];
    const streetAddress =
      street !== undefined && houseNumber !== undefined ? `${houseNumber} ${street}` : street;

    const candidate = {
      osmType: el.type,
      osmId: el.id,
      tag: amenityTag as UtilityAmenityTag,
      name: name.trim(),
      latitude: coords.lat,
      longitude: coords.lon,
      distanceMeters,
      ...(streetAddress !== undefined ? { streetAddress } : {}),
      ...(tags['opening_hours'] !== undefined ? { openingHours: tags['opening_hours'] } : {}),
      ...(tags['phone'] !== undefined ? { phone: tags['phone'] } : {}),
      ...(tags['website'] !== undefined && isHttpUrl(tags['website'])
        ? { website: tags['website'] }
        : {}),
      ...(tags['brand'] !== undefined ? { brand: tags['brand'] } : {}),
    };

    const validated = NormalisedOsmAmenitySchema.safeParse(candidate);
    if (validated.success) out.push(validated.data);
  }

  out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return out;
}

/** Drops malformed `website` tags so Zod's `.url()` doesn't reject the row. */
function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetch utility amenities (pharmacy, bakery, …) around an anchor point.
 *
 * Returns the closest `limit` matches sorted by distance ascending.
 * Empty array is a valid result (rural hotels often have nothing
 * within 800 m).
 */
export async function fetchAmenitiesAround(
  cfg: OverpassClientConfig,
  lat: number,
  lon: number,
  options: FetchAmenitiesOptions = {},
): Promise<Result<readonly NormalisedOsmAmenity[], OverpassError>> {
  const radiusMeters = options.radiusMeters ?? 800;
  const tags = options.tags ?? UTILITY_AMENITY_TAGS;
  const limit = options.limit ?? 30;

  if (tags.length === 0) return ok([]);
  if (radiusMeters <= 0 || radiusMeters > 5000) {
    return err({
      kind: 'parse_failure',
      details: `radius out of range: ${radiusMeters}m (allowed 1-5000)`,
    });
  }

  const query = buildAmenitiesQuery(cfg, lat, lon, radiusMeters, tags);
  const res = await postOverpassQuery(cfg, query);
  if (!res.ok) return err(res.error);

  const normalised = normaliseAmenityElements(res.value, lat, lon);
  return ok(normalised.slice(0, limit));
}

// ---------------------------------------------------------------------------
// fetchTransitStationsAround — metro / RER / tram / train
// ---------------------------------------------------------------------------

/**
 * Public-transport station modes we expose for the `nearest_transit`
 * attribution on POIs. Bus stops are NOT included on purpose — they're
 * too dense (5+ per 200 m in Paris) and add noise.
 */
export const TRANSIT_STATION_MODES = ['subway', 'light_rail', 'tram', 'rail', 'monorail'] as const;
export type TransitStationMode = (typeof TRANSIT_STATION_MODES)[number];

export interface NormalisedTransitStation {
  readonly osmType: 'node' | 'way' | 'relation';
  readonly osmId: number;
  readonly mode: TransitStationMode;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly distanceMeters: number;
  /** Comma-separated line refs when tagged, e.g. `"1, 9"` or `"A"`. */
  readonly lineRef: string | null;
}

export interface FetchTransitOptions {
  /** Default 600 m — Paris urban density tolerates 5-10 min walks. */
  readonly radiusMeters?: number;
  /** Subset of TRANSIT_STATION_MODES to fetch (default all 5). */
  readonly modes?: readonly TransitStationMode[];
  /** Cap on results (default 20 — usually enough to find each line once). */
  readonly limit?: number;
}

/**
 * Build the QL query for transit stations. We hit:
 *   - `railway=station` + `station=subway|light_rail|monorail` (metro/RER)
 *   - `railway=tram_stop` (tram)
 *   - `railway=station` (heavy rail TGV/Transilien)
 *   - `public_transport=station` as fallback for poorly-tagged nodes
 */
function buildTransitQuery(
  cfg: OverpassClientConfig,
  lat: number,
  lon: number,
  radiusMeters: number,
  modes: readonly TransitStationMode[],
): string {
  const wantSubway = modes.includes('subway');
  const wantLightRail = modes.includes('light_rail');
  const wantMonorail = modes.includes('monorail');
  const wantTram = modes.includes('tram');
  const wantRail = modes.includes('rail');

  const parts: string[] = [];

  if (wantSubway || wantLightRail || wantMonorail) {
    const stationKinds = [
      ...(wantSubway ? ['subway'] : []),
      ...(wantLightRail ? ['light_rail'] : []),
      ...(wantMonorail ? ['monorail'] : []),
    ].join('|');
    parts.push(
      `  nwr(around:${radiusMeters},${lat},${lon})["railway"="station"]["station"~"^(${stationKinds})$"];`,
    );
    parts.push(
      `  nwr(around:${radiusMeters},${lat},${lon})["public_transport"="station"]["station"~"^(${stationKinds})$"];`,
    );
  }
  if (wantTram) {
    parts.push(`  nwr(around:${radiusMeters},${lat},${lon})["railway"="tram_stop"];`);
  }
  if (wantRail) {
    parts.push(`  nwr(around:${radiusMeters},${lat},${lon})["railway"="station"]["station"!~"."];`);
  }

  return `[out:json][timeout:${cfg.queryTimeoutSec}];
(
${parts.join('\n')}
);
out tags center;`;
}

/** Map an Overpass element to a transit mode. Returns null if not parseable. */
function elementMode(el: OverpassElement): TransitStationMode | null {
  const tags = el.tags ?? {};
  if (tags['railway'] === 'tram_stop') return 'tram';
  const station = tags['station'];
  if (station === 'subway') return 'subway';
  if (station === 'light_rail') return 'light_rail';
  if (station === 'monorail') return 'monorail';
  if (tags['railway'] === 'station') return 'rail';
  return null;
}

/**
 * Fetch public-transport stations around an anchor.
 *
 * Returns the closest `limit` stations sorted by distance ascending.
 * For each POI consumer (sync-hotel-pois.ts), this helper is called
 * once per hotel and the results are spatially queried for each POI
 * individually (~O(transit_count × poi_count) which is cheap for
 * typical bounds — 50 transit × 30 POI = 1500 comparisons).
 */
export async function fetchTransitStationsAround(
  cfg: OverpassClientConfig,
  lat: number,
  lon: number,
  options: FetchTransitOptions = {},
): Promise<Result<readonly NormalisedTransitStation[], OverpassError>> {
  const radiusMeters = options.radiusMeters ?? 600;
  const modes = options.modes ?? TRANSIT_STATION_MODES;
  const limit = options.limit ?? 20;

  if (modes.length === 0) return ok([]);
  if (radiusMeters <= 0 || radiusMeters > 5000) {
    return err({
      kind: 'parse_failure',
      details: `radius out of range: ${radiusMeters}m (allowed 1-5000)`,
    });
  }

  const query = buildTransitQuery(cfg, lat, lon, radiusMeters, modes);
  const res = await postOverpassQuery(cfg, query);
  if (!res.ok) return err(res.error);

  const seen = new Set<string>();
  const out: NormalisedTransitStation[] = [];
  for (const el of res.value) {
    const coords = elementCoords(el);
    if (coords === null) continue;
    const tags = el.tags ?? {};
    const name = tags['name'];
    if (name === undefined || name.trim().length === 0) continue;
    const mode = elementMode(el);
    if (mode === null) continue;
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const distanceMeters = haversineMeters(lat, lon, coords.lat, coords.lon);
    out.push({
      osmType: el.type,
      osmId: el.id,
      mode,
      name: name.trim(),
      latitude: coords.lat,
      longitude: coords.lon,
      distanceMeters,
      lineRef: tags['ref'] ?? tags['route_ref'] ?? null,
    });
  }

  out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return ok(out.slice(0, limit));
}
