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
 *   - `isAccessibleForFree: true` for free events — the canonical
 *     Schema.org free-event signal that does NOT require an `Offer`
 *   - `url` to the official source
 *   - `sameAs` to the DATAtourisme URI for provenance
 *
 * Phase 6 booking-freeze contract (AGENTS.md §4ter)
 * -------------------------------------------------
 * This builder MUST NOT emit any `Offer` / `priceValidUntil` node. The
 * booking layer (pricing, availability, offers) is frozen until Phase 6,
 * and the hotel detail page that embeds these `Event` nodes must expose
 * zero `Offer` (a third-party event ticket price on a palace fiche risks
 * a misleading Google rich-result + contradicts the freeze). The
 * `pricing` input is therefore only used to flag free events via
 * `isAccessibleForFree`; paid-event prices are intentionally dropped.
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
  /**
   * Locality (commune) of the venue. Strengthens `location.address` so
   * Google's Events rich result + AI overviews resolve the place precisely.
   * Emitted only when non-empty.
   */
  readonly addressLocality?: string;
  /**
   * Administrative region of the venue (e.g. "Provence-Alpes-Côte d'Azur").
   * Emitted only when non-empty.
   */
  readonly addressRegion?: string;
  /**
   * Absolute HTTPS URL of an image representing the event (Google-recommended
   * field for the Events rich result). The builder defensively requires an
   * `https://` URL and silently drops anything else — never fabricate or reuse
   * an unrelated photo (Google requires the image to depict the event itself).
   */
  readonly imageUrl?: string;
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
 * 3. We never emit an `Offer` / `priceValidUntil` (Phase 6 freeze). A
 *    free event is signalled with `isAccessibleForFree: true`; a paid
 *    event surfaces no price at all until the booking layer ships.
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
  image?: string;
  description?: string;
  url?: string;
  sameAs?: string;
  isAccessibleForFree?: boolean;
}

interface MutablePlaceNode {
  '@type': 'Place';
  name: string;
  geo: { '@type': 'GeoCoordinates'; latitude: number; longitude: number };
  address?: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    addressCountry: 'FR';
  };
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
  const streetAddress =
    input.venueAddress !== null && input.venueAddress.length > 0 ? input.venueAddress : undefined;
  const addressLocality =
    input.addressLocality !== undefined && input.addressLocality.trim().length > 0
      ? input.addressLocality.trim()
      : undefined;
  const addressRegion =
    input.addressRegion !== undefined && input.addressRegion.trim().length > 0
      ? input.addressRegion.trim()
      : undefined;
  if (streetAddress !== undefined || addressLocality !== undefined || addressRegion !== undefined) {
    location.address = {
      '@type': 'PostalAddress',
      ...(streetAddress !== undefined ? { streetAddress } : {}),
      ...(addressLocality !== undefined ? { addressLocality } : {}),
      ...(addressRegion !== undefined ? { addressRegion } : {}),
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
  // `image` — Google-recommended for the Events rich result. Defensively
  // HTTPS-only; we never fabricate or borrow an unrelated photo (the image
  // must depict the event itself).
  if (input.imageUrl !== undefined && /^https:\/\/[^\s<>]+$/iu.test(input.imageUrl)) {
    node.image = input.imageUrl;
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
  // Phase 6 freeze: we never emit an `Offer` / `priceValidUntil` here. A
  // free event keeps the `isAccessibleForFree` flag (not an Offer); a paid
  // event surfaces no price until the booking layer ships.
  if (input.pricing !== undefined && input.pricing.type === 'free') {
    node.isAccessibleForFree = true;
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
