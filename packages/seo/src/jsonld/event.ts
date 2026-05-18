/**
 * Event JSON-LD builder (skill: structured-data-schema-org).
 *
 * Used by the hotel detail page to surface up to 5 upcoming local
 * events around the property (CDC §2 "À proximité" block) as
 * machine-readable structured data for Google's "Events" rich result
 * and AI Overviews ingestion.
 *
 * Schema mapping (DATAtourisme → Schema.org):
 *   concert → MusicEvent
 *   expo    → ExhibitionEvent
 *   festival→ Festival
 *   sport   → SportsEvent
 *   theater → TheaterEvent
 *   other   → Event (generic)
 *
 * EEAT contract
 * -------------
 * Required for Google rich results: `name`, `startDate`, `location` with
 * either `name` or `address`. We also emit:
 *   - `endDate` (when known)
 *   - `eventAttendanceMode: OfflineEventAttendanceMode` (Palaces never
 *     surface online events — physical-only)
 *   - `eventStatus: EventScheduled` (DT does not flag cancellations;
 *     we'd need a Brevo-style webhook to flip to `EventCancelled`)
 *   - `description` truncated to 280 chars
 *   - `offers.price=0` for free events (Google requires the offer to be
 *     present even for free events)
 *   - `url` to the official source
 *   - `sameAs` to the DATAtourisme URI for provenance
 */

import type {
  Event,
  ExhibitionEvent,
  Festival,
  MusicEvent,
  SportsEvent,
  TheaterEvent,
} from 'schema-dts';

export type EventCategory = 'concert' | 'expo' | 'festival' | 'sport' | 'theater' | 'other';

const SCHEMA_TYPE_BY_CATEGORY: Record<EventCategory, string> = {
  concert: 'MusicEvent',
  expo: 'ExhibitionEvent',
  festival: 'Festival',
  sport: 'SportsEvent',
  theater: 'TheaterEvent',
  other: 'Event',
};

export interface EventPricingInput {
  readonly type: 'free' | 'paid';
  readonly amountEur: number | null;
}

export interface EventInput {
  readonly name: string;
  readonly category: EventCategory;
  /** ISO `YYYY-MM-DD` (mandatory). */
  readonly startDate: string;
  /** ISO `YYYY-MM-DD` (optional, defaults to startDate for single-day events). */
  readonly endDate?: string;
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly description?: string;
  readonly officialUrl?: string;
  /** DATAtourisme provenance URI — emitted as `sameAs`. */
  readonly sameAs?: string;
  readonly pricing?: EventPricingInput;
}

export type EventNode =
  | Exclude<Event, string>
  | Exclude<MusicEvent, string>
  | Exclude<ExhibitionEvent, string>
  | Exclude<Festival, string>
  | Exclude<SportsEvent, string>
  | Exclude<TheaterEvent, string>;

/**
 * Build a Schema.org Event node for a single upcoming event.
 *
 * Rules
 * -----
 * 1. We never fabricate `endDate` when missing — Google tolerates a
 *    single-day event by inferring `endDate = startDate`.
 * 2. `description` is truncated to 280 chars (Google snippet ceiling).
 * 3. We omit `offers` entirely when pricing is unknown — sending a
 *    half-formed Offer triggers the "Insufficient offer information"
 *    warning in Rich Results Test.
 */
/**
 * Plain-shaped object used internally — schema-dts unions are too
 * strict to compose ergonomically, so we build a permissive shape
 * and cast through `unknown` at the very end. The runtime payload
 * matches Schema.org regardless of the cast.
 */
interface MutableEventNode {
  '@type': string;
  name: string;
  startDate: string;
  endDate?: string;
  eventAttendanceMode: string;
  eventStatus: string;
  location: MutablePlaceNode;
  description?: string;
  url?: string;
  sameAs?: string;
  offers?: MutableOfferNode;
}

interface MutablePlaceNode {
  '@type': 'Place';
  name: string;
  geo: { '@type': 'GeoCoordinates'; latitude: number; longitude: number };
  address?: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressCountry: 'FR';
  };
}

interface MutableOfferNode {
  '@type': 'Offer';
  availability: string;
  priceCurrency: 'EUR';
  price?: string;
  priceValidUntil: string;
  url?: string;
}

export function eventJsonLd(input: EventInput): EventNode {
  const schemaType = SCHEMA_TYPE_BY_CATEGORY[input.category];

  const location: MutablePlaceNode = {
    '@type': 'Place',
    name: input.venueName ?? input.name,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: input.latitude,
      longitude: input.longitude,
    },
  };
  if (input.venueAddress !== null && input.venueAddress.length > 0) {
    location.address = {
      '@type': 'PostalAddress',
      streetAddress: input.venueAddress,
      addressCountry: 'FR',
    };
  }

  const node: MutableEventNode = {
    '@type': schemaType,
    name: input.name,
    startDate: input.startDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location,
  };

  if (input.endDate !== undefined && input.endDate.length > 0) {
    node.endDate = input.endDate;
  }
  if (input.description !== undefined) {
    const trimmed = input.description.trim();
    if (trimmed.length > 0) {
      node.description = trimmed.length > 280 ? `${trimmed.slice(0, 277)}…` : trimmed;
    }
  }
  if (input.officialUrl !== undefined && input.officialUrl.length > 0) {
    node.url = input.officialUrl;
  }
  if (input.sameAs !== undefined && input.sameAs.length > 0) {
    node.sameAs = input.sameAs;
  }
  if (input.pricing !== undefined) {
    const offer: MutableOfferNode = {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'EUR',
      // Google requires `priceValidUntil` — use the event's end date
      // (or start date for single-day events).
      priceValidUntil: input.endDate ?? input.startDate,
    };
    if (input.pricing.type === 'free') {
      offer.price = '0';
    } else if (input.pricing.amountEur !== null) {
      offer.price = String(input.pricing.amountEur);
    }
    if (input.officialUrl !== undefined && input.officialUrl.length > 0) {
      offer.url = input.officialUrl;
    }
    node.offers = offer;
  }

  return node as unknown as EventNode;
}

/**
 * Build a list of `Event` nodes — emit them as standalone JSON-LD
 * scripts (one per event) on the hotel detail page. Standalone is
 * preferable to `ItemList` here: Google's "Events" rich result requires
 * top-level `Event` nodes and ignores them inside an `ItemList`.
 */
export function buildEventListJsonLd(events: ReadonlyArray<EventInput>): readonly EventNode[] {
  return events.map((e) => eventJsonLd(e));
}
