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
/**
 * Rich image entry for a place fiche — normalised into a Schema.org
 * `ImageObject` (https://schema.org/ImageObject). Mirrors the hotel
 * `ImageObjectInput` contract (`packages/seo/src/jsonld/hotel.ts`) but
 * uses `contentUrl` (the actual bytes) rather than `url` (a landing
 * page), and carries the localised `caption` + delivered `width`/`height`
 * so search + LLMs can reconstruct the aspect ratio (Hard Rule 16).
 */
export interface PlaceImageObjectInput {
  /** Absolute, delivery-ready image URL (the transformed Cloudinary URL). */
  readonly contentUrl: string;
  /** Localised alt/caption. Empty captions degrade to a bare URL string. */
  readonly caption?: string;
  /** Intrinsic width of the delivered transform (must match `contentUrl`). */
  readonly width?: number;
  /** Intrinsic height of the delivered transform (must match `contentUrl`). */
  readonly height?: number;
  /** `true` for the hero shot (canonical SERP thumbnail). */
  readonly representativeOfPage?: boolean;
}

type ImageObjectNode = {
  '@type': 'ImageObject';
  contentUrl: string;
  caption?: string;
  width?: number;
  height?: number;
  representativeOfPage?: boolean;
};

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
  /**
   * Place images for `Place.image[]`.
   *
   * Accepts bare absolute URL strings (legacy contract) or rich
   * `PlaceImageObjectInput` entries (hero + gallery with caption +
   * dimensions). Mixed arrays are normalised entry-by-entry; an entry
   * with no caption / dimensions / rep-flag falls back to a bare URL.
   */
  readonly image?: readonly (string | PlaceImageObjectInput)[];
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
    const nodes: (string | ImageObjectNode)[] = [];
    for (const entry of input.image) {
      if (typeof entry === 'string') {
        if (entry.length > 0) nodes.push(entry);
        continue;
      }
      if (entry.contentUrl.length === 0) continue;
      const caption = entry.caption?.trim();
      const hasCaption = caption !== undefined && caption.length > 0;
      const hasWidth = entry.width !== undefined && entry.width > 0;
      const hasHeight = entry.height !== undefined && entry.height > 0;
      const hasRepFlag = entry.representativeOfPage !== undefined;
      // No enrichment at all → keep the compact bare-URL shape.
      if (!hasCaption && !hasWidth && !hasHeight && !hasRepFlag) {
        nodes.push(entry.contentUrl);
        continue;
      }
      const imageNode: ImageObjectNode = { '@type': 'ImageObject', contentUrl: entry.contentUrl };
      if (hasCaption && caption !== undefined) imageNode.caption = caption;
      if (hasWidth && entry.width !== undefined) imageNode.width = entry.width;
      if (hasHeight && entry.height !== undefined) imageNode.height = entry.height;
      if (entry.representativeOfPage !== undefined) {
        imageNode.representativeOfPage = entry.representativeOfPage;
      }
      nodes.push(imageNode);
    }
    if (nodes.length > 0) node['image'] = nodes;
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
