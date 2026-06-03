import type { Hotel, ItemList, ListItem, Place } from 'schema-dts';

import { type AggregateRatingInput } from './aggregate-rating';
import { hotelJsonLd } from './hotel';

export type ItemListNode = Exclude<ItemList, string>;
type ListItemNode = Exclude<ListItem, string>;
type PlaceNode = Exclude<Place, string>;
type HotelNode = Exclude<Hotel, string>;

/**
 * Optional Hotel payload embedded inside a `ListItem`. When provided,
 * the list switches from a "navigational" shape (just url + name) to a
 * "rich" shape (`item: { @type: 'Hotel', ... }`). Google then surfaces
 * the per-hotel rating in carousel rich-results for the hub page.
 *
 * Keep this union narrow on purpose — anything richer (offers, etc.)
 * belongs on the dedicated `hotelJsonLd` builder used by the detail
 * page.
 *
 * `latitude`/`longitude` are the one geo signal we forward here: the
 * directory pages (`/hotels/[pays]`, `/hotels/[pays]/[ville]`) carry a
 * map, so emitting `GeoCoordinates` per hotel makes the same payload
 * legible to map-aware crawlers + LLM agents. Both must be present for
 * the `geo` node to be emitted (no half-coordinates, no fabrication).
 */
export interface ItemListHotelDetails {
  readonly starRating?: 1 | 2 | 3 | 4 | 5;
  readonly aggregateRating?: AggregateRatingInput;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface ItemListEntry {
  readonly name: string;
  readonly url: string;
  /** When set, the entry becomes a nested `Hotel` ListItem with richer signals. */
  readonly hotel?: ItemListHotelDetails;
}

export interface ItemListInput {
  readonly name?: string;
  readonly items: ReadonlyArray<ItemListEntry>;
}

/**
 * ItemList JSON-LD (skill: structured-data-schema-org).
 * Used for `/selection/*`, hub regional pages, etc.
 */
export const itemListJsonLd = (input: ItemListInput): ItemListNode => {
  const out: ItemListNode = {
    '@type': 'ItemList',
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, index) => buildListItem(item, index)),
  };
  if (input.name !== undefined) {
    out.name = input.name;
  }
  return out;
};

function buildListItem(entry: ItemListEntry, index: number): ListItemNode {
  const details = entry.hotel;
  if (details === undefined) {
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: entry.url,
      name: entry.name,
    };
  }

  const hasGeo = details.latitude !== undefined && details.longitude !== undefined;
  const hasRichSignals = details.starRating !== undefined || details.aggregateRating !== undefined;

  // Rich path (star rating / aggregate rating) → reuse the canonical
  // `hotelJsonLd` builder so the nested shape stays in lock-step with
  // the detail page's JSON-LD (skill: structured-data-schema-org). Used
  // by curated hub carousels where the list is short.
  if (hasRichSignals) {
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: hotelJsonLd({
        name: entry.name,
        url: entry.url,
        ...(details.starRating !== undefined ? { starRating: details.starRating } : {}),
        ...(details.aggregateRating !== undefined
          ? { aggregateRating: details.aggregateRating }
          : {}),
        ...(hasGeo && details.latitude !== undefined && details.longitude !== undefined
          ? { geo: { latitude: details.latitude, longitude: details.longitude } }
          : {}),
      }),
    };
  }

  // Lean geo-only path → a minimal `Hotel` node carrying just name + url
  // + GeoCoordinates. Used by the exhaustive directory pages (hundreds
  // of entries) where reusing the full hotel builder would inject
  // page-level fields (speakable, mainEntityOfPage, payment constants)
  // that are meaningless per list-item and would bloat the envelope.
  // Geo gate: emit only when BOTH coordinates are present (no half-pin,
  // no fabricated 0,0).
  if (hasGeo && details.latitude !== undefined && details.longitude !== undefined) {
    const hotelNode: HotelNode = {
      '@type': 'Hotel',
      name: entry.name,
      url: entry.url,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: details.latitude,
        longitude: details.longitude,
      },
    };
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: hotelNode,
    };
  }

  // `hotel` present but carrying no usable signal → navigational shape.
  return {
    '@type': 'ListItem',
    position: index + 1,
    url: entry.url,
    name: entry.name,
  };
}

// ---------------------------------------------------------------------------
// Points-of-interest ItemList (WS5 phase 1) — used by the hotel detail
// page to surface the `visit` bucket as a Google-friendly `ItemList`.
// The shape is the same as the navigational `ItemList` above, but every
// entry nests a `Place` (or `TouristAttraction` subtype) under `item`,
// carrying the same fields the JSON-LD `nearbyAttractions` payload
// already ships (description, geo, openingHours). The signal is
// complementary: `nearbyAttractions` lives on the parent `Hotel` node
// (Google's hotel rich-result spec), while `ItemList` is what AI
// Overviews + Bing copilots ingest when they answer "Top X to visit
// near <hotel>". Capped at 8 entries — long enough to be useful, short
// enough to stay under the recommended 8 KB envelope alongside the
// other JSON-LD payloads of the page.
// ---------------------------------------------------------------------------

export interface PoiItemListEntry {
  readonly name: string;
  /** Schema.org `@type` (e.g. `TouristAttraction`, `Museum`, `Park`). */
  readonly schemaType: string;
  readonly latitude?: number;
  readonly longitude?: number;
  /** Short LLM-generated 1-2 sentence narrative. */
  readonly description?: string;
  /** Raw OSM `opening_hours` tag — forwarded as-is for downstream tooling. */
  readonly openingHours?: string;
  /** Full Schema.org URL (e.g. `https://schema.org/Pharmacy`) when narrower than `schemaType`. */
  readonly schemaTypeUrl?: string;
}

export interface PoiItemListInput {
  /** Section name (e.g. "Ce qu'on visite dans le quartier"). */
  readonly name: string;
  /** Optional short description of the list. */
  readonly description?: string;
  readonly items: ReadonlyArray<PoiItemListEntry>;
}

const POI_ITEM_LIST_MAX = 8;

/**
 * Builds an `ItemList` whose entries each carry a nested `Place`
 * (or subtype) node. Use for an editorial selection like "things to
 * visit near <hotel>" where there is no per-POI canonical URL.
 *
 * The builder caps at {@link POI_ITEM_LIST_MAX} entries to keep the
 * JSON-LD envelope small alongside the other payloads of the page.
 */
export const poiItemListJsonLd = (input: PoiItemListInput): ItemListNode => {
  const items = input.items.slice(0, POI_ITEM_LIST_MAX);
  const out: ItemListNode = {
    '@type': 'ItemList',
    name: input.name,
    numberOfItems: items.length,
    itemListElement: items.map((entry, index) => buildPoiListItem(entry, index)),
  };
  if (input.description !== undefined && input.description.length > 0) {
    out.description = input.description;
  }
  return out;
};

function buildPoiListItem(entry: PoiItemListEntry, index: number): ListItemNode {
  // We build the Place node as a plain `Record` so we can attach the
  // open-ended `@type` string (`TouristAttraction`, `Museum`, `Park`,
  // …) which schema-dts narrows to a closed union — incompatible with
  // editorial taxonomies. Cast to `PlaceNode` only at the boundary,
  // matching the same pattern used in `event.ts`.
  const placeNode: Record<string, unknown> = {
    '@type': entry.schemaType,
    name: entry.name,
  };
  if (entry.latitude !== undefined && entry.longitude !== undefined) {
    placeNode['geo'] = {
      '@type': 'GeoCoordinates',
      latitude: entry.latitude,
      longitude: entry.longitude,
    };
  }
  if (entry.description !== undefined && entry.description.length > 0) {
    placeNode['description'] = entry.description;
  }
  if (entry.openingHours !== undefined && entry.openingHours.length > 0) {
    placeNode['openingHours'] = entry.openingHours;
  }
  if (
    entry.schemaTypeUrl !== undefined &&
    entry.schemaTypeUrl.length > 0 &&
    !entry.schemaTypeUrl.endsWith(`/${entry.schemaType}`)
  ) {
    placeNode['additionalType'] = entry.schemaTypeUrl;
  }
  return {
    '@type': 'ListItem',
    position: index + 1,
    item: placeNode as unknown as PlaceNode,
  };
}
