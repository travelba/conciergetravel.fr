import {
  clampAdults,
  clampChildAge,
  clampRooms,
  MAX_CHILDREN,
  type HotelStayOccupancy,
} from './hotel-stay';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SMALL_INT_PATTERN = /^\d{1,2}$/u;

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}

export function isSmallInt(value: string): boolean {
  return SMALL_INT_PATTERN.test(value);
}

/**
 * Parse `childAges=5,8,12` (Amadeus wire format) into a clamped age array.
 * Returns `[]` for missing or malformed input.
 */
export function parseChildAgesParam(raw: string | null | undefined): readonly number[] {
  if (raw === null || raw === undefined || raw.trim().length === 0) return [];
  const ages: number[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) continue;
    ages.push(clampChildAge(n));
    if (ages.length >= MAX_CHILDREN) break;
  }
  return ages;
}

/** Serialize ages for query strings and hidden form fields. */
export function serializeChildAges(childAges: readonly number[]): string {
  return childAges.map(clampChildAge).join(',');
}

export interface ParsedStayUrlParams {
  readonly checkIn: string | null;
  readonly checkOut: string | null;
  readonly occupancy: HotelStayOccupancy;
}

/**
 * Decode stay-related query params from a hotel fiche or search deep-link.
 * Each field falls back independently — bad values never throw.
 */
export function parseStayUrlParams(params: URLSearchParams): ParsedStayUrlParams {
  const checkInRaw = params.get('checkIn');
  const checkOutRaw = params.get('checkOut');
  const roomsRaw = params.get('rooms');
  const adultsRaw = params.get('adults');
  const childrenRaw = params.get('children');
  const childAgesRaw = params.get('childAges');

  const checkIn = checkInRaw !== null && isIsoDate(checkInRaw) ? checkInRaw : null;
  const checkOut = checkOutRaw !== null && isIsoDate(checkOutRaw) ? checkOutRaw : null;

  const roomsParsed = roomsRaw === null ? null : Number.parseInt(roomsRaw, 10);
  const adultsParsed = adultsRaw === null ? null : Number.parseInt(adultsRaw, 10);

  let childAges = parseChildAgesParam(childAgesRaw);
  if (childAges.length === 0 && childrenRaw !== null && isSmallInt(childrenRaw)) {
    const childrenCount = Number.parseInt(childrenRaw, 10);
    if (Number.isFinite(childrenCount) && childrenCount > 0) {
      childAges = Array.from({ length: Math.min(childrenCount, MAX_CHILDREN) }, () =>
        clampChildAge(8),
      );
    }
  }

  return {
    checkIn,
    checkOut,
    occupancy: {
      rooms: roomsParsed !== null && Number.isFinite(roomsParsed) ? clampRooms(roomsParsed) : 1,
      adults:
        adultsParsed !== null && Number.isFinite(adultsParsed) ? clampAdults(adultsParsed) : 2,
      childAges,
    },
  };
}
