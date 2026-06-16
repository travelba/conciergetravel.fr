/**
 * Canonical taxonomy for the "lieux à visiter" catalogue (public.places
 * `kind` column + Payload Places `kind` select). Two editorial buckets:
 *   - `visit` — patrimony / culture (standalone fiche),
 *   - `do`    — activities (standalone fiche).
 *
 * The Schema.org class mapping mirrors the OSM→Schema table in
 * packages/seo place-amenity so a place fiche and a hotel-embedded POI
 * emit the same `@type`.
 */
export const PLACE_BUCKETS = ['visit', 'do'] as const;
export type PlaceBucket = (typeof PLACE_BUCKETS)[number];

export const PLACE_KINDS = [
  'museum',
  'monument',
  'garden',
  'viewpoint',
  'place_of_worship',
  'theatre',
  'guided_tour',
  'shopping',
  'outdoor',
  'attraction',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export function isPlaceBucket(v: unknown): v is PlaceBucket {
  return typeof v === 'string' && (PLACE_BUCKETS as readonly string[]).includes(v);
}

export function isPlaceKind(v: unknown): v is PlaceKind {
  return typeof v === 'string' && (PLACE_KINDS as readonly string[]).includes(v);
}

/** Default bucket for a kind — keeps catalogue rows internally consistent. */
const KIND_DEFAULT_BUCKET: Readonly<Record<PlaceKind, PlaceBucket>> = {
  museum: 'visit',
  monument: 'visit',
  garden: 'visit',
  viewpoint: 'visit',
  place_of_worship: 'visit',
  theatre: 'do',
  guided_tour: 'do',
  shopping: 'do',
  outdoor: 'do',
  attraction: 'visit',
};

export function defaultBucketForKind(kind: PlaceKind): PlaceBucket {
  return KIND_DEFAULT_BUCKET[kind];
}

/** Bare Schema.org class for a place kind (drop straight into `@type`). */
const KIND_SCHEMA_CLASS: Readonly<Record<PlaceKind, string>> = {
  museum: 'Museum',
  monument: 'LandmarksOrHistoricalBuildings',
  garden: 'Park',
  viewpoint: 'TouristAttraction',
  place_of_worship: 'PlaceOfWorship',
  theatre: 'PerformingArtsTheater',
  guided_tour: 'TouristAttraction',
  shopping: 'ShoppingCenter',
  outdoor: 'TouristAttraction',
  attraction: 'TouristAttraction',
};

export function placeKindToSchemaClass(kind: PlaceKind): string {
  return KIND_SCHEMA_CLASS[kind];
}
