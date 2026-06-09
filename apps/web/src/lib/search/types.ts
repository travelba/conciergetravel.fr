/**
 * Shared types for the Lartisien-style hotel search bar.
 *
 * The logic (not the design) of the search bar is reproduced here: an
 * autocomplete destination field, a 2-month range date picker, an
 * occupancy stepper and an URL-encoded submission. Everything is typed
 * strictly — no `any`, no `as`, no non-null assertions (AGENTS.md §4).
 */

/** A destination is a geographic entity the user can search within. */
export type DestinationType = 'city' | 'region' | 'country';

/** The `searchType` carried in the results URL — a destination type, or
 * `hotel` when the user picked a specific property in the autocomplete. */
export type SearchType = DestinationType | 'hotel';

/** Which panel of the search bar is currently open (one at a time). */
export type ActivePanel = 'dest' | 'dates' | 'occ' | null;

export interface Destination {
  readonly id: string;
  readonly label: string;
  readonly type: DestinationType;
}

export interface HotelResult {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  /** Stable slug used to build the `/results/hotels/{hotelSlug}` URL. */
  readonly slug: string;
  /** The city the hotel belongs to, materialised as a `Destination` so the
   * field can pre-fill the destination label after a hotel is picked. */
  readonly cityDestination: Destination;
}

/** A date range with explicit nulls (vs `react-day-picker`'s `undefined`). */
export interface DateRangeState {
  from: Date | null;
  to: Date | null;
}

/**
 * The complete, serialisable state of the search bar. Mirrors the brief's
 * `SearchState`, plus an internal `hotelSlug` so the submission can build
 * the `/results/hotels/{hotelSlug}` path without re-querying the stub.
 */
export interface SearchState {
  destination: Destination | null;
  hotelId: string | null;
  hotelSlug: string | null;
  dateRange: DateRangeState;
  rooms: number;
  adults: number;
  children: number;
  activePanel: ActivePanel;
}
