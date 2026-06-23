/**
 * Pure proximity resolution for the "lieux à visiter" vertical.
 *
 * No I/O, no clock, no randomness (architecture-layers §Layer 1). The
 * batch resolver script (scripts/editorial-pilot) fetches places +
 * hotels from Supabase, then calls these functions to compute the
 * `place_hotel_links` rows. The same functions power:
 *   - the hotel "Autour" section (places near a hotel),
 *   - the place fiche "hôtels à proximité" block (hotels near a place).
 *
 * Distance is great-circle (haversine) — accurate to ~0.5 % at urban
 * scale, which is all the "X min walk" UX needs.
 */

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Average urban walking pace, metres per minute (~4.8 km/h). */
const WALK_METERS_PER_MIN = 80;

/** Great-circle distance in metres between two points (rounded). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_M * c);
}

/**
 * Estimate a walking time in minutes from a straight-line distance.
 * Returns `null` beyond ~2.5 km — past that "à pied" stops being a
 * useful UX signal and the fiche should surface transit instead.
 */
export function estimateWalkMinutes(meters: number): number | null {
  if (meters < 0) return null;
  if (meters > 2500) return null;
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));
}

export interface ProximityResult<T> {
  readonly item: T;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
}

export interface ProximityOptions {
  /** Discard candidates farther than this (metres). Default 1500. */
  readonly maxMeters?: number;
  /** Cap on results after the distance sort. Default 8. */
  readonly limit?: number;
}

/**
 * Rank candidates by straight-line distance from `anchor`, ascending.
 * Candidates without resolvable coordinates are skipped. Generic over
 * the candidate type so both directions (place→hotels, hotel→places)
 * reuse it.
 */
export function rankByProximity<T>(
  anchor: GeoPoint,
  candidates: readonly T[],
  getCoords: (item: T) => GeoPoint | null,
  options: ProximityOptions = {},
): readonly ProximityResult<T>[] {
  const maxMeters = options.maxMeters ?? 1500;
  const limit = options.limit ?? 8;

  const ranked: ProximityResult<T>[] = [];
  for (const item of candidates) {
    const coords = getCoords(item);
    if (coords === null) continue;
    const distanceMeters = haversineMeters(anchor, coords);
    if (distanceMeters > maxMeters) continue;
    ranked.push({ item, distanceMeters, walkMinutes: estimateWalkMinutes(distanceMeters) });
  }

  ranked.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return ranked.slice(0, limit);
}

/** Narrow a nullable lat/lng pair to a {@link GeoPoint} or null. */
export function toGeoPoint(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): GeoPoint | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return { latitude, longitude };
}
