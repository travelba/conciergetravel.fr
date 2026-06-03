import { err, ok, type Result } from '@mch/domain/shared';

import {
  searchByCoordinates,
  uniqueProperties,
  type TravelportCredentials,
} from './travelport-client';
import type { TravelportError } from './errors';
import type { PropertyItem } from './types';

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface CatalogHotel {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface CatalogMatch {
  readonly id: string;
  readonly name: string;
  readonly status: 'present' | 'absent';
  readonly chainCode?: string;
  readonly propertyCode?: string;
  readonly travelportName?: string;
  readonly distanceMeters?: number;
  readonly confidence?: MatchConfidence;
}

const NAME_STOPWORDS = new Set([
  'hotel',
  'the',
  'le',
  'la',
  'les',
  'paris',
  'resort',
  'spa',
  'and',
  'by',
  'de',
  'du',
]);

export function normalizeName(raw: string): Set<string> {
  const ascii = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ');
  const tokens = ascii.split(/\s+/).filter((t) => t.length > 0 && !NAME_STOPWORDS.has(t));
  return new Set(tokens);
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function scoreConfidence(distanceM: number, overlap: number): MatchConfidence {
  if (distanceM <= 150 && overlap >= 1) return 'high';
  if ((distanceM <= 400 && overlap >= 1) || overlap >= 2) return 'medium';
  return 'low';
}

export async function matchHotel(
  creds: TravelportCredentials,
  hotel: CatalogHotel,
  opts: { readonly checkIn: string; readonly checkOut: string; readonly radiusMi?: number },
): Promise<Result<CatalogMatch, TravelportError>> {
  const wanted = normalizeName(hotel.name);

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: opts.radiusMi ?? 1,
    unit: 'mi',
    checkInDate: opts.checkIn,
    checkOutDate: opts.checkOut,
    adults: 1,
    currency: 'EUR',
  });
  if (!search.ok) return err(search.error);

  const props = uniqueProperties(search.value);

  let best: PropertyItem | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOverlap = 0;

  for (const it of props) {
    const center = it.propertyInfo?.geolocation?.center;
    if (center === undefined) continue;
    const distance = haversineMeters(
      hotel.latitude,
      hotel.longitude,
      center.latitude,
      center.longitude,
    );
    const overlap = [...normalizeName(it.name)].filter((t) => wanted.has(t)).length;
    if (
      overlap > 0 &&
      (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance))
    ) {
      bestOverlap = overlap;
      bestDistance = distance;
      best = it;
    }
  }

  if (best === undefined) return ok({ id: hotel.id, name: hotel.name, status: 'absent' });

  return ok({
    id: hotel.id,
    name: hotel.name,
    status: 'present',
    chainCode: best.chainCode,
    propertyCode: best.propertyCode,
    travelportName: best.name,
    distanceMeters: Math.round(bestDistance),
    confidence: scoreConfidence(bestDistance, bestOverlap),
  });
}
