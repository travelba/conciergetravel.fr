import type { Place } from 'schema-dts';

import { buildOpeningHoursSpecification, normalisePriceRange } from './place-amenity';

type PlaceNode = Exclude<Place, string>;

/**
 * JSON-LD builder for a canonical "lieu à visiter" fiche
 * (skill: structured-data-schema-org).
 *
 * Emits a `TouristAttraction` (or a narrower subtype — `Museum`,
 * `LandmarksOrHistoricalBuildings`, `Park`, `PerformingArtsTheater`,
 * `PlaceOfWorship`, …) carrying the geo signal, address, opening hours
 * and the city it sits in. The `@type` string is open-ended (editorial
 * taxonomy) so — like `poiItemListJsonLd` and `event.ts` — we build a
 * plain `Record` and cast to `PlaceNode` only at the boundary
 * (schema-dts narrows `@type` to a closed union incompatible with our
 * kinds).
 *
 * The "hôtels à proximité" block is emitted SEPARATELY as an
 * `ItemList` of `Hotel` nodes (see `itemListJsonLd`) — there is no
 * standard `nearbyLodging` property on `Place`, so we keep the two
 * payloads decoupled.
 */
export interface TouristAttractionInput {
  /** Schema.org class, e.g. `'Museum'`, `'TouristAttraction'`. */
  readonly schemaType: string;
  readonly name: string;
  /** Canonical absolute URL of the place fiche. */
  readonly url: string;
  readonly description?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly streetAddress?: string;
  /** Locality (city) for `address` + `containedInPlace`. */
  readonly addressLocality?: string;
  readonly addressCountry?: string;
  /** Absolute image URL(s). */
  readonly image?: readonly string[];
  /** Raw OSM-style `opening_hours` tag (parsed into a spec). */
  readonly openingHours?: string;
  /** Free-form price range (`'€€'`, `'À partir de 12 €'`, …). */
  readonly priceRange?: string;
  /** Authoritative external references (official site, Wikipedia, …). */
  readonly sameAs?: readonly string[];
}

export const touristAttractionJsonLd = (input: TouristAttractionInput): PlaceNode => {
  const node: Record<string, unknown> = {
    '@type': input.schemaType,
    name: input.name,
    url: input.url,
  };

  if (input.description !== undefined && input.description.length > 0) {
    node['description'] = input.description;
  }

  if (input.latitude !== undefined && input.longitude !== undefined) {
    node['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }

  const hasAddress =
    (input.streetAddress !== undefined && input.streetAddress.length > 0) ||
    (input.addressLocality !== undefined && input.addressLocality.length > 0);
  if (hasAddress) {
    const address: Record<string, unknown> = { '@type': 'PostalAddress' };
    if (input.streetAddress !== undefined && input.streetAddress.length > 0) {
      address['streetAddress'] = input.streetAddress;
    }
    if (input.addressLocality !== undefined && input.addressLocality.length > 0) {
      address['addressLocality'] = input.addressLocality;
    }
    if (input.addressCountry !== undefined && input.addressCountry.length > 0) {
      address['addressCountry'] = input.addressCountry;
    }
    node['address'] = address;
  }

  if (input.addressLocality !== undefined && input.addressLocality.length > 0) {
    node['containedInPlace'] = {
      '@type': 'City',
      name: input.addressLocality,
    };
  }

  if (input.image !== undefined && input.image.length > 0) {
    node['image'] = [...input.image];
  }

  const hours = buildOpeningHoursSpecification(input.openingHours);
  if (hours.length > 0) {
    node['openingHoursSpecification'] = hours;
  }

  const priceRange = normalisePriceRange(input.priceRange);
  if (priceRange !== null) {
    node['isAccessibleForFree'] = priceRange === 'Gratuit' || priceRange === 'Free';
  }

  if (input.sameAs !== undefined && input.sameAs.length > 0) {
    node['sameAs'] = [...input.sameAs];
  }

  return node as unknown as PlaceNode;
};
