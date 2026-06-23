/**
 * Places domain — pure logic for the "lieux à visiter" vertical
 * (proximity resolution + place taxonomy). No I/O (architecture-layers
 * §Layer 1).
 */
export {
  type GeoPoint,
  type ProximityOptions,
  type ProximityResult,
  haversineMeters,
  estimateWalkMinutes,
  rankByProximity,
  toGeoPoint,
} from './proximity';
export {
  PLACE_BUCKETS,
  PLACE_KINDS,
  type PlaceBucket,
  type PlaceKind,
  isPlaceBucket,
  isPlaceKind,
  defaultBucketForKind,
  placeKindToSchemaClass,
} from './place-kind';
