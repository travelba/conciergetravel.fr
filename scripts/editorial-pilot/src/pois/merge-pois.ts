/**
 * merge-pois.ts — convert DT + Overpass results into a single ordered
 * POI list ready to be written to `hotels.points_of_interest`.
 *
 * Output shape EXACTLY matches `PointOfInterestSchema` in
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts` so the
 * Server Component can read it without any further normalisation.
 *
 * Sorting / capping happens HERE so the orchestrator stays thin and
 * the LLM describer only sees the POIs that will actually be persisted.
 */

import type { NormalisedOsmAmenity, NormalisedTransitStation } from '@mch/integrations/overpass';
import type { NormalisedPlacePoi } from '@mch/integrations/google-places';

import type { DtPoi, DtPoiBucket, DtPoiCategory } from '../enrichment/datatourisme.js';

// ---------------------------------------------------------------------------
// Output shape — mirror of PointOfInterestSchema (excluding LLM-only fields).
// ---------------------------------------------------------------------------

export type PoiBucket = 'visit' | 'do' | 'shop';

export interface MergedPoiPricing {
  readonly type: 'free' | 'paid' | 'donation' | 'mixed';
  readonly amount_eur?: number;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
  readonly notes?: string;
}

export interface MergedPoiNearestTransit {
  readonly mode: 'subway' | 'rer' | 'tram' | 'rail' | 'bus' | 'monorail' | 'light_rail';
  readonly name: string;
  readonly distance_meters: number;
  readonly walk_minutes?: number;
  readonly line_ref?: string;
}

/**
 * Final shape persisted to JSONB. Field names are snake_case so the
 * SQL JSONB column reads as-is by the Next.js zod parser.
 */
export interface MergedPoi {
  readonly name: string;
  readonly name_en?: string;
  readonly type: string;
  readonly category_fr?: string;
  readonly category_en?: string;
  readonly distance_meters: number;
  readonly walk_minutes: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly bucket: PoiBucket;
  readonly description_fr?: string;
  readonly description_en?: string;
  readonly opening_hours?: string;
  readonly nearest_transit?: MergedPoiNearestTransit;
  readonly pricing?: MergedPoiPricing;
  readonly schema_type?: string;
  readonly osm_id?: string;
}

// ---------------------------------------------------------------------------
// Walk time + transit helpers
// ---------------------------------------------------------------------------

/**
 * Walking speed used across the editorial pipeline + the frontend
 * helper `apps/web/src/lib/format-distance.ts#deriveWalkMinutes`.
 *
 * 83 m/min ≈ 5 km/h — slightly slower than the Mappy default to
 * account for tourists with luggage / strollers / window-shopping.
 */
const WALK_MPM = 83;

function walkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round(distanceMeters / WALK_MPM));
}

/**
 * Find the closest transit station to a POI. We only attach a
 * `nearest_transit` when the station is within `maxMeters` of the POI
 * (default 400 m) — past that, the editorial UX is more confusing
 * than helpful ("le métro Concorde est à 800 m du restaurant").
 */
function nearestTransitFor(
  poi: { latitude: number; longitude: number },
  stations: readonly NormalisedTransitStation[],
  maxMeters: number,
): MergedPoiNearestTransit | undefined {
  let best: { d: number; s: NormalisedTransitStation } | null = null;
  for (const s of stations) {
    const d = haversine(poi.latitude, poi.longitude, s.latitude, s.longitude);
    if (d <= maxMeters && (best === null || d < best.d)) {
      best = { d, s };
    }
  }
  if (best === null) return undefined;
  const out: MergedPoiNearestTransit = {
    mode: best.s.mode,
    name: best.s.name,
    distance_meters: Math.round(best.d),
    walk_minutes: walkMinutes(best.d),
  };
  if (best.s.lineRef !== null && best.s.lineRef.length > 0) {
    return { ...out, line_ref: best.s.lineRef };
  }
  return out;
}

// Same haversine as `@mch/integrations/overpass` — duplicated here
// so this file stays node-runtime-free (no extra import for one math).
const EARTH_RADIUS_M = 6_371_000;
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// ---------------------------------------------------------------------------
// Category labels (FR / EN) for the UI badge.
// ---------------------------------------------------------------------------

const DT_CATEGORY_LABELS: Readonly<Record<DtPoiCategory, { fr: string; en: string }>> = {
  museum: { fr: 'Musée', en: 'Museum' },
  cultural: { fr: 'Site culturel', en: 'Cultural site' },
  religious: { fr: 'Édifice religieux', en: 'Religious site' },
  theater: { fr: 'Théâtre', en: 'Theatre' },
  building: { fr: 'Bâtiment remarquable', en: 'Remarkable building' },
  castle: { fr: 'Château', en: 'Castle' },
  memorial: { fr: 'Mémorial', en: 'Memorial' },
  park: { fr: 'Parc', en: 'Park' },
  beach: { fr: 'Plage', en: 'Beach' },
  trail: { fr: 'Sentier', en: 'Trail' },
  viewpoint: { fr: 'Point de vue', en: 'Viewpoint' },
  winery: { fr: 'Domaine viticole', en: 'Winery' },
  sports: { fr: 'Sports & loisirs', en: 'Sports & leisure' },
  restaurant: { fr: 'Restaurant', en: 'Restaurant' },
  store: { fr: 'Commerce', en: 'Shop' },
  other: { fr: 'Autre', en: 'Other' },
};

const OSM_AMENITY_LABELS: Readonly<
  Record<NormalisedOsmAmenity['tag'], { fr: string; en: string }>
> = {
  pharmacy: { fr: 'Pharmacie', en: 'Pharmacy' },
  bakery: { fr: 'Boulangerie', en: 'Bakery' },
  supermarket: { fr: 'Supermarché', en: 'Supermarket' },
  atm: { fr: 'Distributeur', en: 'ATM' },
  post_office: { fr: 'Bureau de poste', en: 'Post office' },
  taxi: { fr: 'Taxi', en: 'Taxi rank' },
  clinic: { fr: 'Centre médical', en: 'Clinic' },
};

const OSM_TO_SCHEMA_URL: Readonly<Record<NormalisedOsmAmenity['tag'], string>> = {
  pharmacy: 'https://schema.org/Pharmacy',
  bakery: 'https://schema.org/BakeryShop',
  supermarket: 'https://schema.org/GroceryStore',
  atm: 'https://schema.org/AutomatedTeller',
  post_office: 'https://schema.org/PostOffice',
  taxi: 'https://schema.org/TaxiStand',
  clinic: 'https://schema.org/MedicalClinic',
};

// ---------------------------------------------------------------------------
// Google Places (New) type → bucket + FR/EN label
// ---------------------------------------------------------------------------

interface GoogleTypeMapping {
  readonly bucket: PoiBucket;
  readonly fr: string;
  readonly en: string;
  readonly schema?: string;
}

/**
 * Maps Google Places (New) Table-A `primaryType`/`types[]` to the
 * editorial visit/do/shop buckets with localised labels. Only the types
 * we request in `DEFAULT_NEARBY_POI_TYPES` (+ a few common neighbours)
 * are listed; anything else falls back to a generic "visit" POI.
 */
const GOOGLE_TYPE_MAP: Readonly<Record<string, GoogleTypeMapping>> = {
  tourist_attraction: { bucket: 'visit', fr: 'Site touristique', en: 'Tourist attraction' },
  museum: { bucket: 'visit', fr: 'Musée', en: 'Museum', schema: 'https://schema.org/Museum' },
  art_gallery: {
    bucket: 'visit',
    fr: "Galerie d'art",
    en: 'Art gallery',
    schema: 'https://schema.org/ArtGallery',
  },
  historical_landmark: { bucket: 'visit', fr: 'Site historique', en: 'Historic landmark' },
  cultural_landmark: { bucket: 'visit', fr: 'Site culturel', en: 'Cultural landmark' },
  historical_place: { bucket: 'visit', fr: 'Lieu historique', en: 'Historic place' },
  monument: { bucket: 'visit', fr: 'Monument', en: 'Monument' },
  church: {
    bucket: 'visit',
    fr: 'Édifice religieux',
    en: 'Church',
    schema: 'https://schema.org/Church',
  },
  mosque: { bucket: 'visit', fr: 'Mosquée', en: 'Mosque', schema: 'https://schema.org/Mosque' },
  hindu_temple: {
    bucket: 'visit',
    fr: 'Temple',
    en: 'Temple',
    schema: 'https://schema.org/HinduTemple',
  },
  synagogue: {
    bucket: 'visit',
    fr: 'Synagogue',
    en: 'Synagogue',
    schema: 'https://schema.org/Synagogue',
  },
  place_of_worship: { bucket: 'visit', fr: 'Édifice religieux', en: 'Place of worship' },
  aquarium: { bucket: 'visit', fr: 'Aquarium', en: 'Aquarium' },
  zoo: { bucket: 'visit', fr: 'Zoo', en: 'Zoo', schema: 'https://schema.org/Zoo' },
  opera_house: { bucket: 'visit', fr: 'Opéra', en: 'Opera house' },
  performing_arts_theater: { bucket: 'visit', fr: 'Salle de spectacle', en: 'Performing arts' },
  observation_deck: { bucket: 'visit', fr: 'Point de vue', en: 'Observation deck' },
  park: { bucket: 'do', fr: 'Parc', en: 'Park', schema: 'https://schema.org/Park' },
  national_park: { bucket: 'do', fr: 'Parc national', en: 'National park' },
  botanical_garden: { bucket: 'do', fr: 'Jardin botanique', en: 'Botanical garden' },
  garden: { bucket: 'do', fr: 'Jardin', en: 'Garden' },
  plaza: { bucket: 'do', fr: 'Place', en: 'Square' },
  marina: { bucket: 'do', fr: 'Port de plaisance', en: 'Marina' },
  shopping_mall: { bucket: 'shop', fr: 'Centre commercial', en: 'Shopping mall' },
  department_store: { bucket: 'shop', fr: 'Grand magasin', en: 'Department store' },
  market: { bucket: 'shop', fr: 'Marché', en: 'Market' },
};

const GOOGLE_TYPE_FALLBACK: GoogleTypeMapping = {
  bucket: 'visit',
  fr: 'À découvrir',
  en: 'Point of interest',
};

function resolveGoogleType(poi: NormalisedPlacePoi): GoogleTypeMapping {
  if (poi.primaryType !== undefined) {
    const direct = GOOGLE_TYPE_MAP[poi.primaryType];
    if (direct !== undefined) return direct;
  }
  for (const t of poi.types) {
    const m = GOOGLE_TYPE_MAP[t];
    if (m !== undefined) return m;
  }
  return GOOGLE_TYPE_FALLBACK;
}

function fromGooglePoi(
  poi: NormalisedPlacePoi,
  anchor: { latitude: number; longitude: number },
  transit: readonly NormalisedTransitStation[],
): MergedPoi {
  const mapping = resolveGoogleType(poi);
  const distance = Math.round(
    haversine(anchor.latitude, anchor.longitude, poi.latitude, poi.longitude),
  );
  const transitRef = nearestTransitFor(poi, transit, 400);
  return {
    name: poi.name,
    type: poi.primaryType ?? mapping.en.toLowerCase().replace(/\s+/gu, '_'),
    category_fr: mapping.fr,
    category_en: mapping.en,
    distance_meters: distance,
    walk_minutes: walkMinutes(distance),
    latitude: poi.latitude,
    longitude: poi.longitude,
    bucket: mapping.bucket,
    osm_id: `gplaces/${poi.placeId}`,
    ...(mapping.schema !== undefined ? { schema_type: mapping.schema } : {}),
    ...(transitRef !== undefined ? { nearest_transit: transitRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// DT POI → MergedPoi
// ---------------------------------------------------------------------------

function fromDtPoi(poi: DtPoi, transit: readonly NormalisedTransitStation[]): MergedPoi {
  const labels = DT_CATEGORY_LABELS[poi.category];
  const wm = walkMinutes(poi.distanceMeters);
  const transitRef = nearestTransitFor(poi, transit, 400);
  return {
    name: poi.name,
    type: poi.category,
    category_fr: labels.fr,
    category_en: labels.en,
    distance_meters: poi.distanceMeters,
    walk_minutes: wm,
    latitude: poi.latitude,
    longitude: poi.longitude,
    bucket: poi.bucket as PoiBucket,
    osm_id: `dt/${poi.uuid}`,
    ...(transitRef !== undefined ? { nearest_transit: transitRef } : {}),
  };
}

// ---------------------------------------------------------------------------
// Overpass amenity → MergedPoi
// ---------------------------------------------------------------------------

function fromOsmAmenity(
  amen: NormalisedOsmAmenity,
  transit: readonly NormalisedTransitStation[],
): MergedPoi {
  const labels = OSM_AMENITY_LABELS[amen.tag];
  const wm = walkMinutes(amen.distanceMeters);
  const transitRef = nearestTransitFor(amen, transit, 400);
  const out: MergedPoi = {
    name: amen.brand !== undefined ? `${labels.fr} ${amen.brand}` : amen.name,
    type: amen.tag,
    category_fr: labels.fr,
    category_en: labels.en,
    distance_meters: amen.distanceMeters,
    walk_minutes: wm,
    latitude: amen.latitude,
    longitude: amen.longitude,
    bucket: 'shop',
    osm_id: `${amen.osmType}/${amen.osmId}`,
    schema_type: OSM_TO_SCHEMA_URL[amen.tag],
    ...(amen.openingHours !== undefined ? { opening_hours: amen.openingHours } : {}),
    ...(transitRef !== undefined ? { nearest_transit: transitRef } : {}),
  };
  return out;
}

// ---------------------------------------------------------------------------
// Top-level merger
// ---------------------------------------------------------------------------

export interface MergeCaps {
  readonly visit: number;
  readonly do: number;
  readonly shop: number;
}

export const DEFAULT_MERGE_CAPS: MergeCaps = { visit: 8, do: 6, shop: 8 };

/**
 * Merge DT POIs + Overpass amenities into a single list ordered by
 * `(bucket priority, distance asc)`. The 3-bucket structure matches
 * the front-end `<HotelLocation>` 3-section layout.
 *
 * Dedup strategy: DT POIs are trusted first; an Overpass amenity is
 * dropped if its coordinates fall within 50 m of an already-included
 * DT POI with the same bucket. This avoids "Pharmacie X" appearing
 * twice when DT and OSM both reference it.
 */
export interface MergeExtras {
  /** Worldwide Google Places POIs (fallback when DT/Overpass are empty). */
  readonly googlePois?: readonly NormalisedPlacePoi[];
  /** Hotel anchor — required to compute Google POI distances. */
  readonly anchor?: { readonly latitude: number; readonly longitude: number };
}

export function mergePois(
  dtPois: readonly DtPoi[],
  osmAmenities: readonly NormalisedOsmAmenity[],
  transit: readonly NormalisedTransitStation[],
  caps: MergeCaps = DEFAULT_MERGE_CAPS,
  extras: MergeExtras = {},
): readonly MergedPoi[] {
  const byBucket: Record<PoiBucket, MergedPoi[]> = { visit: [], do: [], shop: [] };

  for (const dt of dtPois) {
    const merged = fromDtPoi(dt, transit);
    byBucket[merged.bucket].push(merged);
  }

  // Google Places POIs (visit/do) — deduped against already-included
  // POIs in the same bucket (within 50 m) so France hotels that have
  // both DT and Google coverage don't list the same monument twice.
  const { googlePois, anchor } = extras;
  if (googlePois !== undefined && googlePois.length > 0 && anchor !== undefined) {
    for (const g of googlePois) {
      const candidate = fromGooglePoi(g, anchor, transit);
      const dupe = byBucket[candidate.bucket].some(
        (existing) =>
          haversine(
            existing.latitude,
            existing.longitude,
            candidate.latitude,
            candidate.longitude,
          ) < 50,
      );
      if (!dupe) byBucket[candidate.bucket].push(candidate);
    }
  }

  for (const osm of osmAmenities) {
    const candidate = fromOsmAmenity(osm, transit);
    const dupe = byBucket.shop.some(
      (existing) =>
        haversine(existing.latitude, existing.longitude, candidate.latitude, candidate.longitude) <
        50,
    );
    if (!dupe) byBucket.shop.push(candidate);
  }

  // Sort by distance ascending within each bucket.
  for (const b of ['visit', 'do', 'shop'] as const) {
    byBucket[b].sort((a, b2) => a.distance_meters - b2.distance_meters);
  }

  return [
    ...byBucket.visit.slice(0, caps.visit),
    ...byBucket.do.slice(0, caps.do),
    ...byBucket.shop.slice(0, caps.shop),
  ];
}

// ---------------------------------------------------------------------------
// Helpers re-exported for the orchestrator
// ---------------------------------------------------------------------------

export const _internals = {
  walkMinutes,
  haversine,
  nearestTransitFor,
  fromDtPoi,
  fromOsmAmenity,
  fromGooglePoi,
  resolveGoogleType,
  GOOGLE_TYPE_MAP,
  DT_CATEGORY_LABELS,
  OSM_AMENITY_LABELS,
  OSM_TO_SCHEMA_URL,
};

// Re-export the DT bucket type so the orchestrator + tests stay decoupled
// from the enrichment module's internals.
export type { DtPoiBucket };
