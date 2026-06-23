/**
 * Deterministic slug + Google-type mapping helpers for the places
 * sourcing pipeline. Kept separate (no I/O) so they are unit-testable.
 */
import type { PlaceBucket, PlaceKind } from '@mch/domain/places';

/** Strip accents, lowercase, collapse to a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/['’]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

export interface KindMapping {
  readonly kind: PlaceKind;
  readonly bucket: PlaceBucket;
}

/**
 * Map a Google Places (New) Table-A `primaryType` (or any of `types[]`)
 * to our editorial kind/bucket. Returns `null` for types that are not
 * "lieux à visiter" (lodging, food, transit, utilities) — those are out
 * of scope for this catalogue.
 */
const GOOGLE_TYPE_TO_KIND: Readonly<Record<string, KindMapping>> = {
  museum: { kind: 'museum', bucket: 'visit' },
  art_gallery: { kind: 'museum', bucket: 'visit' },
  historical_landmark: { kind: 'monument', bucket: 'visit' },
  monument: { kind: 'monument', bucket: 'visit' },
  historical_place: { kind: 'monument', bucket: 'visit' },
  cultural_landmark: { kind: 'monument', bucket: 'visit' },
  church: { kind: 'place_of_worship', bucket: 'visit' },
  place_of_worship: { kind: 'place_of_worship', bucket: 'visit' },
  hindu_temple: { kind: 'place_of_worship', bucket: 'visit' },
  mosque: { kind: 'place_of_worship', bucket: 'visit' },
  synagogue: { kind: 'place_of_worship', bucket: 'visit' },
  park: { kind: 'garden', bucket: 'visit' },
  national_park: { kind: 'garden', bucket: 'visit' },
  botanical_garden: { kind: 'garden', bucket: 'visit' },
  garden: { kind: 'garden', bucket: 'visit' },
  tourist_attraction: { kind: 'attraction', bucket: 'visit' },
  observation_deck: { kind: 'viewpoint', bucket: 'visit' },
  zoo: { kind: 'attraction', bucket: 'visit' },
  aquarium: { kind: 'attraction', bucket: 'visit' },
  performing_arts_theater: { kind: 'theatre', bucket: 'do' },
  opera_house: { kind: 'theatre', bucket: 'do' },
  concert_hall: { kind: 'theatre', bucket: 'do' },
  shopping_mall: { kind: 'shopping', bucket: 'do' },
  department_store: { kind: 'shopping', bucket: 'do' },
  market: { kind: 'shopping', bucket: 'do' },
  amusement_park: { kind: 'attraction', bucket: 'visit' },
};

export function mapGoogleTypeToKind(
  primaryType: string | undefined,
  types: readonly string[],
): KindMapping | null {
  if (primaryType !== undefined) {
    const direct = GOOGLE_TYPE_TO_KIND[primaryType];
    if (direct !== undefined) return direct;
  }
  for (const t of types) {
    const m = GOOGLE_TYPE_TO_KIND[t];
    if (m !== undefined) return m;
  }
  return null;
}
