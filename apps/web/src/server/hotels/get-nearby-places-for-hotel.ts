import 'server-only';

import { cache } from 'react';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Reverse maillage for the hotel fiche "Lieux à visiter à proximité"
 * block: given a hotel, surface the canonical published `places` so the
 * hotel page can cross-link into the "lieux" vertical (the inverse of the
 * place fiche's "Hôtels à proximité" block).
 *
 * Two resolution strategies, in priority order:
 *   1. **Editorial links** — `place_hotel_links` rows for this hotel,
 *      published places only, closest first. This is the canonical,
 *      curated relationship (same table the place fiche reads in the
 *      other direction).
 *   2. **Geo fallback** — when no curated link exists, the nearest
 *      published places in the same city (matched by `city_key`),
 *      ranked by great-circle distance to the hotel's coordinates. This
 *      keeps the block useful for hotels that have not been wired into
 *      `place_hotel_links` yet, without fabricating a relationship for
 *      cities that simply have no published places (block self-elides).
 *
 * This reader is intentionally self-contained on the hotel side: it does
 * not import from the `server/places/*` vertical so the two surfaces can
 * evolve independently. Degrades to an empty result without Supabase env
 * (the caller self-elides — no empty block).
 */

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

export interface NearbyPlaceCard {
  readonly slug: string;
  readonly slugEn: string | null;
  readonly citySlug: string;
  readonly bucket: 'visit' | 'do';
  readonly kind: string;
  readonly name: string;
  readonly nameEn: string | null;
  readonly factualSummaryFr: string | null;
  readonly factualSummaryEn: string | null;
  readonly heroImage: string | null;
  /** Distance to the hotel in metres (curated link or computed geo). */
  readonly distanceMeters: number;
  /** Walking minutes when the curated link carries it, else `null`. */
  readonly walkMinutes: number | null;
}

export interface NearbyPlacesResult {
  readonly items: readonly NearbyPlaceCard[];
  /** Provenance of the list — useful for debugging / analytics, never rendered. */
  readonly source: 'links' | 'geo' | 'none';
}

const EMPTY: NearbyPlacesResult = { items: [], source: 'none' };

const LinkedPlaceRowSchema = z.object({
  distance_meters: z.number(),
  walk_minutes: numberOrNull,
  places: z
    .object({
      slug: z.string(),
      slug_en: z.string().nullish(),
      city_key: z.string(),
      bucket: z.enum(['visit', 'do']),
      kind: z.string(),
      name: z.string(),
      name_en: z.string().nullish(),
      factual_summary_fr: z.string().nullish(),
      factual_summary_en: z.string().nullish(),
      hero_image: z.string().nullish(),
      is_published: z.boolean(),
    })
    .nullish(),
});

const GeoPlaceRowSchema = z.object({
  slug: z.string(),
  slug_en: z.string().nullish(),
  city_key: z.string(),
  bucket: z.enum(['visit', 'do']),
  kind: z.string(),
  name: z.string(),
  name_en: z.string().nullish(),
  factual_summary_fr: z.string().nullish(),
  factual_summary_en: z.string().nullish(),
  hero_image: z.string().nullish(),
  latitude: numberOrNull,
  longitude: numberOrNull,
});

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two WGS-84 points, in metres. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Strategy 1 — curated `place_hotel_links` for the hotel (closest first). */
async function listLinkedPlaces(hotelId: string, limit: number): Promise<NearbyPlaceCard[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('place_hotel_links')
    .select(
      'distance_meters, walk_minutes, places!inner(slug, slug_en, city_key, bucket, kind, name, name_en, factual_summary_fr, factual_summary_en, hero_image, is_published)',
    )
    .eq('hotel_id', hotelId)
    .order('distance_meters', { ascending: true })
    .limit(limit * 4);
  if (error || !Array.isArray(data)) return [];

  const out: NearbyPlaceCard[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    const parsed = LinkedPlaceRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const p = parsed.data.places;
    if (!p || p.is_published !== true || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({
      slug: p.slug,
      slugEn: p.slug_en ?? null,
      citySlug: p.city_key,
      bucket: p.bucket,
      kind: p.kind,
      name: p.name,
      nameEn: p.name_en ?? null,
      factualSummaryFr: p.factual_summary_fr ?? null,
      factualSummaryEn: p.factual_summary_en ?? null,
      heroImage: p.hero_image ?? null,
      distanceMeters: parsed.data.distance_meters,
      walkMinutes: parsed.data.walk_minutes,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Strategy 2 — nearest published places in the same city (geo fallback). */
async function listGeoNearbyPlaces(
  citySlug: string,
  latitude: number,
  longitude: number,
  limit: number,
): Promise<NearbyPlaceCard[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('places')
    .select(
      'slug, slug_en, city_key, bucket, kind, name, name_en, factual_summary_fr, factual_summary_en, hero_image, latitude, longitude',
    )
    .eq('city_key', citySlug)
    .eq('is_published', true)
    .limit(200);
  if (error || !Array.isArray(data)) return [];

  const scored: NearbyPlaceCard[] = [];
  for (const raw of data) {
    const parsed = GeoPlaceRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const p = parsed.data;
    if (p.latitude === null || p.longitude === null) continue;
    scored.push({
      slug: p.slug,
      slugEn: p.slug_en ?? null,
      citySlug: p.city_key,
      bucket: p.bucket,
      kind: p.kind,
      name: p.name,
      nameEn: p.name_en ?? null,
      factualSummaryFr: p.factual_summary_fr ?? null,
      factualSummaryEn: p.factual_summary_en ?? null,
      heroImage: p.hero_image ?? null,
      distanceMeters: Math.round(haversineMeters(latitude, longitude, p.latitude, p.longitude)),
      walkMinutes: null,
    });
  }
  scored.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return scored.slice(0, limit);
}

export interface NearbyPlacesArgs {
  readonly hotelId: string;
  /** City slug of the hotel (`citySlug(row.city)`), for the geo fallback. */
  readonly citySlug: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly limit?: number;
}

/**
 * Resolve the nearby published places for a hotel — curated links first,
 * geo fallback second. Returns an empty result (caller self-elides) when
 * neither strategy yields a published place.
 */
export const getNearbyPlacesForHotel = cache(
  async ({
    hotelId,
    citySlug,
    latitude,
    longitude,
    limit = 6,
  }: NearbyPlacesArgs): Promise<NearbyPlacesResult> => {
    try {
      const linked = await listLinkedPlaces(hotelId, limit);
      if (linked.length > 0) return { items: linked, source: 'links' };

      if (citySlug !== null && citySlug.length > 0 && latitude !== null && longitude !== null) {
        const geo = await listGeoNearbyPlaces(citySlug, latitude, longitude, limit);
        if (geo.length > 0) return { items: geo, source: 'geo' };
      }
      return EMPTY;
    } catch {
      return EMPTY;
    }
  },
);
