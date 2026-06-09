/**
 * Build and parse the search results URL.
 *
 * Shape (mirrors Lartisien):
 *   /results/hotels/{slug}?occ=aXXcYY&from=YYYY-MM-DD&to=YYYY-MM-DD&rooms={n}&searchType={city|region|country|hotel}&page=1
 *
 * `slug` is the slugified destination label, or the hotel slug when the
 * user picked a specific property.
 */

import { decodeOccupancy, encodeOccupancy, type Occupancy } from './occupancy';
import type { SearchType } from './types';

const SEARCH_TYPES: readonly SearchType[] = ['city', 'region', 'country', 'hotel'];
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface SearchUrlInput {
  readonly slug: string;
  readonly searchType: SearchType;
  readonly occupancy: Occupancy;
  readonly from: Date;
  readonly to: Date;
  readonly rooms: number;
  /** Defaults to 1 when omitted. */
  readonly page?: number;
}

export interface ParsedSearchParams {
  readonly occupancy: Occupancy | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly rooms: number | null;
  readonly searchType: SearchType | null;
  readonly page: number | null;
}

/**
 * Slugify a destination label into a URL-safe segment.
 * "Région parisienne" → "region-parisienne".
 */
export function slugifyDestination(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Format a `Date` as a local `YYYY-MM-DD` (no UTC shift). */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a local `YYYY-MM-DD` into a `Date` at local midnight, or null. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (match === null) return null;
  const [, yearRaw, monthRaw, dayRaw] = match;
  if (yearRaw === undefined || monthRaw === undefined || dayRaw === undefined) {
    return null;
  }
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  const date = new Date(year, month - 1, day);
  // Reject overflow dates (e.g. 2026-02-31 → March): the round-trip must match.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function isSearchType(value: string): value is SearchType {
  return (SEARCH_TYPES as readonly string[]).includes(value);
}

/** Build the absolute results path + query string from a validated input. */
export function buildSearchUrl(input: SearchUrlInput): string {
  const params = new URLSearchParams();
  params.set('occ', encodeOccupancy(input.occupancy));
  params.set('from', formatIsoDate(input.from));
  params.set('to', formatIsoDate(input.to));
  params.set('rooms', Math.max(1, Math.trunc(input.rooms)).toString());
  params.set('searchType', input.searchType);
  params.set('page', Math.max(1, Math.trunc(input.page ?? 1)).toString());

  const slug = encodeURIComponent(input.slug);
  return `/results/hotels/${slug}?${params.toString()}`;
}

/**
 * Decode the query params of a results URL back into structured values so
 * the search bar can pre-fill itself when re-opened from a shared link.
 * Every field is independently nullable — a bad param never throws.
 */
export function parseSearchParams(params: URLSearchParams): ParsedSearchParams {
  const occRaw = params.get('occ');
  const fromRaw = params.get('from');
  const toRaw = params.get('to');
  const roomsRaw = params.get('rooms');
  const searchTypeRaw = params.get('searchType');
  const pageRaw = params.get('page');

  const rooms = roomsRaw === null ? null : Number.parseInt(roomsRaw, 10);
  const page = pageRaw === null ? null : Number.parseInt(pageRaw, 10);

  return {
    occupancy: occRaw === null ? null : decodeOccupancy(occRaw),
    from: fromRaw === null ? null : parseIsoDate(fromRaw),
    to: toRaw === null ? null : parseIsoDate(toRaw),
    rooms: rooms !== null && Number.isFinite(rooms) && rooms >= 1 ? rooms : null,
    searchType: searchTypeRaw !== null && isSearchType(searchTypeRaw) ? searchTypeRaw : null,
    page: page !== null && Number.isFinite(page) && page >= 1 ? page : null,
  };
}
