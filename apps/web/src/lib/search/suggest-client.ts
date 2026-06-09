'use client';

/**
 * Client-side adapter over the real suggest endpoint (`/api/search/suggest`,
 * Algolia-backed). Maps the wire payload into the search bar's
 * `Destination` / `HotelResult` shapes so `DestinationAutocomplete` can run
 * on live data instead of the local stubs.
 *
 * Failures (network, abort, bad payload) resolve to empty arrays so the
 * dropdown degrades silently — it never throws into the React tree.
 */

import type { Locale } from '@/i18n/routing';

import type { Destination, HotelResult } from './types';
import { slugifyDestination } from './url';

export interface Suggestions {
  readonly destinations: readonly Destination[];
  readonly hotels: readonly HotelResult[];
}

const EMPTY: Suggestions = { destinations: [], hotels: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseCities(raw: unknown): Destination[] {
  if (!Array.isArray(raw)) return [];
  const out: Destination[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item['objectID']) ?? asString(item['slug']);
    const label = asString(item['name']);
    if (id === undefined || label === undefined) continue;
    out.push({ id, label, type: 'city' });
  }
  return out;
}

function parseCountries(raw: unknown): Destination[] {
  if (!Array.isArray(raw)) return [];
  const out: Destination[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item['code']) ?? asString(item['slug']);
    const label = asString(item['name']);
    if (id === undefined || label === undefined) continue;
    out.push({ id, label, type: 'country' });
  }
  return out;
}

function parseHotels(raw: unknown): HotelResult[] {
  if (!Array.isArray(raw)) return [];
  const out: HotelResult[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item['objectID']);
    const name = asString(item['name']);
    const slug = asString(item['slug']);
    if (id === undefined || name === undefined || slug === undefined) continue;
    const city = asString(item['city']) ?? '';
    const country = asString(item['country']) ?? '';
    out.push({
      id,
      name,
      city,
      country,
      slug,
      cityDestination: {
        id: city.length > 0 ? slugifyDestination(city) : id,
        label: city.length > 0 ? city : name,
        type: 'city',
      },
    });
  }
  return out;
}

/**
 * Fetch destination + hotel suggestions from the live endpoint. Honours an
 * `AbortSignal` so the caller can cancel stale requests.
 */
export async function fetchSearchSuggestions(
  query: string,
  locale: Locale,
  signal?: AbortSignal,
): Promise<Suggestions> {
  const term = query.trim();
  if (term.length === 0) return EMPTY;

  const url =
    `/api/search/suggest?q=${encodeURIComponent(term)}` +
    `&locale=${locale}&hotels=6&cities=4&countries=3`;

  try {
    const res = await fetch(url, signal !== undefined ? { signal } : {});
    if (!res.ok) return EMPTY;
    const json: unknown = await res.json();
    if (!isRecord(json) || json['ok'] !== true) return EMPTY;
    return {
      destinations: [...parseCities(json['cities']), ...parseCountries(json['countries'])],
      hotels: parseHotels(json['hotels']),
    };
  } catch {
    // Aborted (stale) or network error — degrade to no suggestions.
    return EMPTY;
  }
}
