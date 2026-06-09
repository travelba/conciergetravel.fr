/**
 * Typed stubs + mock data for the search autocomplete.
 *
 * These stand in for the real `searchDestinations` / `searchHotels`
 * endpoints. They simulate network latency and honour an `AbortSignal`
 * so the component can cancel stale requests — exactly like the eventual
 * Algolia-backed implementation will.
 */

import type { Destination, HotelResult } from './types';

/** Raised when a stubbed request is aborted via its `AbortSignal`. */
export class SearchAbortError extends Error {
  constructor() {
    super('Search request aborted');
    this.name = 'SearchAbortError';
  }
}

const SIMULATED_LATENCY_MS = 180;

const DESTINATIONS: readonly Destination[] = [
  { id: 'paris', label: 'Paris', type: 'city' },
  { id: 'region-parisienne', label: 'Région parisienne', type: 'region' },
  { id: 'nice', label: 'Nice', type: 'city' },
  { id: 'cote-d-azur', label: "Côte d'Azur", type: 'region' },
  { id: 'france', label: 'France', type: 'country' },
];

const PARIS_CITY: Destination = { id: 'paris', label: 'Paris', type: 'city' };

const HOTELS: readonly HotelResult[] = [
  {
    id: 'bulgari-paris',
    name: 'Bulgari Hotel Paris',
    city: 'Paris',
    country: 'France',
    slug: 'bulgari-hotel-paris',
    cityDestination: PARIS_CITY,
  },
  {
    id: 'mandarin-oriental-lutetia',
    name: 'Mandarin Oriental Lutetia',
    city: 'Paris',
    country: 'France',
    slug: 'mandarin-oriental-lutetia',
    cityDestination: PARIS_CITY,
  },
  {
    id: 'ritz-paris',
    name: 'Ritz Paris',
    city: 'Paris',
    country: 'France',
    slug: 'ritz-paris',
    cityDestination: PARIS_CITY,
  },
  {
    id: 'cheval-blanc-paris',
    name: 'Cheval Blanc Paris',
    city: 'Paris',
    country: 'France',
    slug: 'cheval-blanc-paris',
    cityDestination: PARIS_CITY,
  },
  {
    id: 'la-reserve-paris',
    name: 'La Réserve Paris',
    city: 'Paris',
    country: 'France',
    slug: 'la-reserve-paris',
    cityDestination: PARIS_CITY,
  },
];

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolve `value` after the simulated latency, rejecting with a
 * `SearchAbortError` if the signal fires first.
 */
function withLatency<T>(value: T, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new SearchAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    }, SIMULATED_LATENCY_MS);

    function onAbort(): void {
      clearTimeout(timer);
      reject(new SearchAbortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Stub: search cities / regions / countries matching `query`. */
export function searchDestinations(
  query: string,
  signal?: AbortSignal,
): Promise<readonly Destination[]> {
  const term = normalise(query);
  const matches =
    term.length === 0 ? [] : DESTINATIONS.filter((d) => normalise(d.label).includes(term));
  return withLatency(matches, signal);
}

/** Stub: search hotels by name or city matching `query`. */
export function searchHotels(query: string, signal?: AbortSignal): Promise<readonly HotelResult[]> {
  const term = normalise(query);
  const matches =
    term.length === 0
      ? []
      : HOTELS.filter((h) => normalise(h.name).includes(term) || normalise(h.city).includes(term));
  return withLatency(matches, signal);
}
