import 'server-only';

import { z } from 'zod';

import {
  normalizeComparison,
  type NormalizedComparison,
  type RawCompetitorEntry,
} from '@mch/domain/price-comparison';
import { Apify, Makcorps } from '@mch/integrations';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';

import { fetchConciergePriceMinor } from './concierge-price';
import { incrementAndCheckMakcorpsQuota, peekMakcorpsQuota } from './quota';
import { persistComparison, readLastPersistedComparison } from './persist';

const CACHE_TTL_SEC = 15 * 60;
const CACHE_PREFIX = 'price-cmp';

export interface PriceComparisonInput {
  readonly hotelId: string;
  readonly checkIn: string; // YYYY-MM-DD
  readonly checkOut: string; // YYYY-MM-DD
  readonly adults: number;
}

const InputSchema = z.object({
  hotelId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(9),
});

export type PriceComparisonSource = 'cache' | 'makcorps' | 'apify' | 'persisted_fallback';

export type PriceComparisonOutcome =
  | {
      readonly available: false;
      readonly reason:
        | 'invalid_input'
        | 'unknown_hotel'
        | 'no_makcorps_id'
        | 'vendor_error'
        | 'no_data';
    }
  | {
      readonly available: true;
      readonly source: PriceComparisonSource;
      readonly normalized: NormalizedComparison;
      /** Live MyConciergeHotel rate (EUR cents TTC) when supplier ARI exists. */
      readonly priceConciergeMinor: number | null;
      /**
       * When `true`, the data comes from the persisted fallback because
       * the Makcorps daily quota was exhausted. The widget shows a
       * "valeurs cachées" disclaimer.
       */
      readonly cached: boolean;
    };

function cacheKey(input: PriceComparisonInput): string {
  return `${CACHE_PREFIX}:${input.hotelId}:${input.checkIn}:${input.checkOut}:${input.adults}`;
}

async function readFromCache(input: PriceComparisonInput): Promise<NormalizedComparison | null> {
  try {
    const raw = await redis.get(cacheKey(input));
    if (raw === null || raw === undefined) return null;
    // Upstash auto-deserializes JSON; tolerate both string and object.
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed as NormalizedComparison;
  } catch {
    return null;
  }
}

async function writeToCache(
  input: PriceComparisonInput,
  normalized: NormalizedComparison,
): Promise<void> {
  try {
    await redis.set(cacheKey(input), JSON.stringify(normalized), {
      ex: CACHE_TTL_SEC,
    });
  } catch {
    // cache misses are non-fatal
  }
}

interface HotelLookup {
  readonly id: string;
  readonly makcorpsHotelId: string | null;
  readonly name: string;
  readonly city: string;
}

async function lookupHotel(hotelId: string): Promise<HotelLookup | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('id, makcorps_hotel_id, name, city')
      .eq('id', hotelId)
      .eq('is_published', true)
      .maybeSingle();
    if (error || data === null) return null;
    return {
      id: data.id as string,
      makcorpsHotelId: (data.makcorps_hotel_id as string | null) ?? null,
      name: data.name as string,
      city: data.city as string,
    };
  } catch {
    return null;
  }
}

function normalizedFromPersisted(
  row: NonNullable<Awaited<ReturnType<typeof readLastPersistedComparison>>>,
  stay: PriceComparisonInput,
): NormalizedComparison {
  // Explicit, exhaustive mapping — keeps the type system happy under
  // `noUncheckedIndexedAccess` (no dynamic key lookups).
  const entries: RawCompetitorEntry[] = [];
  if (row.priceBooking !== null) {
    entries.push({ provider: 'booking_com', price: row.priceBooking });
  }
  if (row.priceExpedia !== null) {
    entries.push({ provider: 'expedia', price: row.priceExpedia });
  }
  if (row.priceHotelscom !== null) {
    entries.push({ provider: 'hotels_com', price: row.priceHotelscom });
  }
  if (row.priceOfficial !== null) {
    entries.push({ provider: 'official_site', price: row.priceOfficial });
  }
  return normalizeComparison({
    entries,
    stay: { checkIn: stay.checkIn, checkOut: stay.checkOut, adults: stay.adults },
  });
}

interface CompetitorFetchResult {
  readonly entries: readonly RawCompetitorEntry[];
  readonly rawPayload: unknown;
  readonly source: PriceComparisonSource;
}

async function fetchCompetitorEntries(
  hotel: HotelLookup,
  input: PriceComparisonInput,
): Promise<CompetitorFetchResult> {
  let entries: readonly RawCompetitorEntry[] = [];
  let rawPayload: unknown = null;
  let source: PriceComparisonSource = 'makcorps';

  if (hotel.makcorpsHotelId !== null) {
    const mkCfg = Makcorps.makcorpsConfigFromSharedEnv();
    const mkResult = await Makcorps.fetchMakcorpsHotelQuotes(mkCfg, {
      hotelId: hotel.makcorpsHotelId,
      checkin: input.checkIn,
      checkout: input.checkOut,
      adults: input.adults,
      currency: 'EUR',
    });
    if (mkResult.ok) {
      rawPayload = mkResult.value;
      entries = Makcorps.parseMakcorpsResponse(mkResult.value);
    }
  }

  if (entries.length === 0) {
    const apifyCfg = Apify.apifyConfigFromSharedEnv();
    const apifyResult = await Apify.fetchApifyHotelQuotes(apifyCfg, {
      hotelName: hotel.name,
      city: hotel.city,
      checkin: input.checkIn,
      checkout: input.checkOut,
      adults: input.adults,
    });
    if (apifyResult.ok) {
      entries = apifyResult.value;
      source = 'apify';
      rawPayload = null;
    }
  }

  return { entries, rawPayload, source };
}

/**
 * Orchestrates the full comparator pipeline (skill:
 * competitive-pricing-comparison §Architecture).
 *
 *   1. validate input → bad input ⇒ `invalid_input`
 *   2. lookup hotel  → unpublished/missing ⇒ `unknown_hotel`
 *   3. no makcorps id ⇒ `no_makcorps_id`
 *   4. cache hit       ⇒ return cached normalized
 *   5. quota exhausted ⇒ persisted fallback (`cached: true`)
 *   6. Makcorps call   ⇒ success: normalize + cache + persist
 *   7. Makcorps failed ⇒ try Apify (when configured)
 *   8. all sources failed ⇒ `vendor_error`
 */
export async function getPriceComparison(
  rawInput: PriceComparisonInput,
): Promise<PriceComparisonOutcome> {
  const parsed = InputSchema.safeParse(rawInput);
  if (!parsed.success) return { available: false, reason: 'invalid_input' };
  const input = parsed.data;

  const hotel = await lookupHotel(input.hotelId);
  if (hotel === null) return { available: false, reason: 'unknown_hotel' };

  const stayQuery = {
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    currency: 'EUR' as const,
  };

  const [cached, priceConciergeMinorEarly] = await Promise.all([
    readFromCache(input),
    fetchConciergePriceMinor(input.hotelId, stayQuery),
  ]);
  if (cached !== null && cached.competitors.length > 0) {
    return {
      available: true,
      source: 'cache',
      normalized: cached,
      priceConciergeMinor: priceConciergeMinorEarly,
      cached: false,
    };
  }

  const apifyConfigured =
    Apify.apifyConfigFromSharedEnv().token.length > 0 &&
    Apify.apifyConfigFromSharedEnv().actorId.length > 0;
  if (hotel.makcorpsHotelId === null && !apifyConfigured) {
    const priceConciergeMinor = await fetchConciergePriceMinor(input.hotelId, stayQuery);
    if (priceConciergeMinor !== null) {
      return {
        available: true,
        source: 'cache',
        normalized: normalizeComparison({
          entries: [],
          stay: stayQuery,
        }),
        priceConciergeMinor,
        cached: false,
      };
    }
    return { available: false, reason: 'no_makcorps_id' };
  }

  // Quota check **before** the Makcorps call (Apify-only hotels skip this gate).
  if (hotel.makcorpsHotelId !== null) {
    const peek = await peekMakcorpsQuota();
    if (peek.used >= peek.quota) {
      const persisted = await readLastPersistedComparison(
        input.hotelId,
        input.checkIn,
        input.checkOut,
      );
      const priceConciergeMinor = await fetchConciergePriceMinor(input.hotelId, stayQuery);
      if (persisted !== null) {
        const normalized = normalizedFromPersisted(persisted, input);
        if (normalized.competitors.length > 0) {
          return {
            available: true,
            source: 'persisted_fallback',
            normalized,
            priceConciergeMinor,
            cached: true,
          };
        }
      }
      if (priceConciergeMinor !== null) {
        return {
          available: true,
          source: 'persisted_fallback',
          normalized: normalizeComparison({ entries: [], stay: stayQuery }),
          priceConciergeMinor,
          cached: true,
        };
      }
      return { available: false, reason: 'vendor_error' };
    }

    await incrementAndCheckMakcorpsQuota();
  }

  const [priceConciergeMinor, { entries, rawPayload, source }] = await Promise.all([
    fetchConciergePriceMinor(input.hotelId, stayQuery),
    fetchCompetitorEntries(hotel, input),
  ]);

  const normalized = normalizeComparison({
    entries,
    stay: stayQuery,
  });

  if (normalized.competitors.length === 0) {
    // Final resort: persisted history.
    const persisted = await readLastPersistedComparison(
      input.hotelId,
      input.checkIn,
      input.checkOut,
    );
    if (persisted !== null) {
      const fallback = normalizedFromPersisted(persisted, input);
      if (fallback.competitors.length > 0) {
        return {
          available: true,
          source: 'persisted_fallback',
          normalized: fallback,
          priceConciergeMinor,
          cached: true,
        };
      }
    }
    if (priceConciergeMinor !== null) {
      return {
        available: true,
        source,
        normalized,
        priceConciergeMinor,
        cached: false,
      };
    }
    return { available: false, reason: 'no_data' };
  }

  await writeToCache(input, normalized);
  await persistComparison({
    hotelId: input.hotelId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    normalized,
    ttlSec: CACHE_TTL_SEC,
    rawPayload,
  });

  return { available: true, source, normalized, priceConciergeMinor, cached: false };
}
