/**
 * Occupancy encoding for the search URL — reproduces Lartisien's
 * `occ=a{adults}c{children}` format where each count is zero-padded to
 * exactly 2 digits (2 adults / 0 children → `a02c00`).
 */

export interface Occupancy {
  readonly adults: number;
  readonly children: number;
}

const OCC_PATTERN = /^a(\d{2})c(\d{2})$/;
const MAX_COUNT = 99;

/** Clamp to the `[0, 99]` window the 2-digit format can represent. */
function clampToTwoDigits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const int = Math.trunc(value);
  if (int < 0) return 0;
  if (int > MAX_COUNT) return MAX_COUNT;
  return int;
}

function pad2(value: number): string {
  return clampToTwoDigits(value).toString().padStart(2, '0');
}

/**
 * Encode an occupancy into the wire format. Counts are clamped to
 * `[0, 99]` so the output is always exactly the `aXXcYY` shape.
 */
export function encodeOccupancy(occupancy: Occupancy): string {
  return `a${pad2(occupancy.adults)}c${pad2(occupancy.children)}`;
}

/**
 * Decode an `aXXcYY` string back into an occupancy. Returns `null` for any
 * malformed input (wrong shape, non-numeric, missing groups) so callers can
 * fall back to defaults instead of trusting a bad URL.
 */
export function decodeOccupancy(value: string): Occupancy | null {
  const match = OCC_PATTERN.exec(value.trim());
  if (match === null) return null;
  const adultsRaw = match[1];
  const childrenRaw = match[2];
  if (adultsRaw === undefined || childrenRaw === undefined) return null;
  return {
    adults: Number.parseInt(adultsRaw, 10),
    children: Number.parseInt(childrenRaw, 10),
  };
}

/**
 * Build the French field label for an occupancy, e.g. «2 adultes»,
 * «2 adultes, 1 enfant», «3 adultes, 2 enfants». Plurals follow French
 * rules (singular only for exactly 1).
 */
export function formatOccupancyLabel(occupancy: Occupancy): string {
  const adultsPart = `${occupancy.adults} ${occupancy.adults > 1 ? 'adultes' : 'adulte'}`;
  if (occupancy.children <= 0) {
    return adultsPart;
  }
  const childrenPart = `${occupancy.children} ${occupancy.children > 1 ? 'enfants' : 'enfant'}`;
  return `${adultsPart}, ${childrenPart}`;
}
