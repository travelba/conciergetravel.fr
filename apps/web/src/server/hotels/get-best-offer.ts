import 'server-only';

import { getAmadeusClient } from '@/lib/amadeus';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';

import type {
  BookingWidgetLimitedAvailability,
  BookingWidgetPriceFrom,
} from '@/components/hotel/booking-widget';

export interface BestOfferInput {
  readonly amadeusHotelId: string | null;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly currency?: 'EUR' | 'USD' | 'GBP' | 'CHF';
}

/**
 * Real ARI verdict from Amadeus (C3 / DSA art. 25 — never fabricate).
 *
 *  - `available`      — Amadeus returned `bucket.available !== false` AND ≥ 1 offer.
 *  - `sold_out`       — Amadeus returned `bucket.available === false` or no offers
 *                       for the requested stay. Safe to surface as "complet pour ces dates".
 *  - `unknown`        — no Amadeus call possible (missing property id, vendor error,
 *                       fake mode). Display nothing.
 */
export type AvailabilityState = 'available' | 'sold_out' | 'unknown';

export interface BestOfferResult {
  /** Real offer id from Amadeus, or `null` when the hotel is not bookable / no offer found. */
  readonly offerId: string | null;
  readonly priceFrom: BookingWidgetPriceFrom | null;
  /**
   * "Plus que X chambres" — DSA art. 25 / DGCCRF: ONLY emitted when
   * Amadeus exposes an explicit remaining-count signal on the offer.
   * The Self-Service Hotels v3 schema does not (yet) ship that field,
   * so we default to `null`. When Amadeus rolls out the property OR
   * we bridge a Little Hotelier inventory channel, the derivation
   * lives in `deriveLimitedAvailability` below.
   */
  readonly limitedAvailability: BookingWidgetLimitedAvailability | null;
  /** Audit-friendly verdict — drives the "sold out for these dates" chip. */
  readonly availabilityState: AvailabilityState;
}

const EMPTY: BestOfferResult = {
  offerId: null,
  priceFrom: null,
  limitedAvailability: null,
  availabilityState: 'unknown',
};

/**
 * Fetches the cheapest live offer for a hotel's stay window.
 *
 * Cache strategy
 * --------------
 * Delegated to `AmadeusClient.getHotelOffers`, which caches the raw
 * Amadeus response in Upstash Redis (TTL ≈ 5 minutes per
 * `HOTEL_OFFERS_TTL_SEC` in `packages/integrations/src/amadeus/cache-keys.ts`).
 * The key is the tuple `{hotelIds, checkIn, checkOut, adults, childAges, currency}`,
 * matching the granularity of the booking form. Two visitors with the
 * same dates hit the cache; different dates miss but pay the round-
 * trip once per 5-minute window.
 *
 * Failure modes
 * -------------
 * Any of (missing `amadeusHotelId`, missing Amadeus env, network
 * failure, parse error, zero offers returned) → returns `EMPTY` so
 * the caller can fall back to "Sur demande" without a visible error.
 *
 * Test seam
 * ---------
 * When `MCH_E2E_FAKE_*` is enabled (see `dev-fake-offer.ts`), we
 * skip the real Amadeus call and return a fixed `TEST-OFFER-<id>` +
 * synthetic price. Keeps the E2E suite deterministic across cold
 * boots.
 *
 * Skill: amadeus-gds, api-integration, redis-caching.
 */
export async function getBestOfferForHotel(
  input: BestOfferInput & { readonly hotelId: string },
): Promise<BestOfferResult> {
  if (isFakeOffersEnabled()) {
    return {
      offerId: `TEST-OFFER-${input.hotelId}`,
      priceFrom: {
        amount: { fromMinor: 25_000, toMinor: null, currency: 'EUR' },
        source: 'amadeus_live',
      },
      limitedAvailability: null,
      availabilityState: 'available',
    };
  }

  if (
    input.amadeusHotelId === null ||
    input.amadeusHotelId.length === 0 ||
    !/^[A-Z0-9]{8}$/.test(input.amadeusHotelId)
  ) {
    return EMPTY;
  }

  try {
    const client = getAmadeusClient();
    const res = await client.getHotelOffers({
      hotelIds: [input.amadeusHotelId],
      checkInDate: input.checkIn,
      checkOutDate: input.checkOut,
      adults: Math.max(1, Math.min(9, input.adults)),
      currency: input.currency ?? 'EUR',
      ...(input.childAges.length > 0 ? { childAges: [...input.childAges] } : {}),
    });
    if (!res.ok) return EMPTY;
    const bucket = res.value.data[0];
    // C3 — capture the bucket-level `available` flag BEFORE we early-
    // return on "no offers". Amadeus may return an empty offer array
    // alongside `available: false` for a sold-out property; we want to
    // surface that distinct from "vendor unreachable".
    if (bucket === undefined) return EMPTY;
    const bucketAvailable = bucket.available !== false; // default true if absent
    if (bucket.offers === undefined || bucket.offers.length === 0) {
      return {
        offerId: null,
        priceFrom: null,
        limitedAvailability: null,
        availabilityState: bucketAvailable ? 'unknown' : 'sold_out',
      };
    }
    // Pick the cheapest total — Amadeus does not guarantee order.
    let bestOffer = bucket.offers[0];
    if (bestOffer === undefined) return EMPTY;
    let bestTotalMinor = parsePriceToMinor(bestOffer.price.total);
    if (bestTotalMinor === null) return EMPTY;
    for (const candidate of bucket.offers.slice(1)) {
      const minor = parsePriceToMinor(candidate.price.total);
      if (minor !== null && minor < bestTotalMinor) {
        bestOffer = candidate;
        bestTotalMinor = minor;
      }
    }

    const nights = nightCount(input.checkIn, input.checkOut);
    const pricePerNightMinor = nights > 0 ? Math.round(bestTotalMinor / nights) : bestTotalMinor;
    const currency = normaliseCurrency(bestOffer.price.currency);

    return {
      offerId: bestOffer.id,
      priceFrom: {
        amount: { fromMinor: pricePerNightMinor, toMinor: null, currency },
        source: 'amadeus_live',
      },
      // C3 — `limitedAvailability` requires a per-offer remaining-count
      // signal from Amadeus. The Self-Service Hotels v3 schema does not
      // expose it yet. `deriveLimitedAvailability` is the single seam
      // where the fabrication risk is contained: it returns `null`
      // unless the vendor explicitly says so. Never replace this with
      // a heuristic on `bucket.offers.length` — that is exactly the
      // kind of dark pattern DSA art. 25 and DGCCRF target.
      limitedAvailability: deriveLimitedAvailability(bucket),
      availabilityState: 'available',
    };
  } catch {
    return EMPTY;
  }
}

/**
 * C3 — single source of truth for "Plus que X chambres" surfacing.
 *
 * Amadeus Self-Service Hotels v3 does NOT (as of 2026-05) expose a
 * per-offer `availability` field with a numeric `remainingCount`.
 * This helper is the place to wire any future signal:
 *
 *   - Amadeus v3 if/when they add `policies.availability` /
 *     `quantity` to the offer schema (per schema watchlist).
 *   - Little Hotelier inventory (private channel) when a hotel is
 *     wired to that integration AND the operator opts in.
 *
 * Until then, we return `null` (DSA-safe default). Heuristics like
 * "fewer offers than expected" are explicitly forbidden — they would
 * trigger the same legal exposure as Booking.com's 2020 DGCCRF
 * sanction and the 2023 EU Expedia/Tripadvisor inquiry.
 *
 * The function is exported so the Booking widget E2E tests can stub
 * it via `dev-fake-*` modules without poking the schema layer.
 */
function deriveLimitedAvailability(_bucket: {
  readonly offers?: readonly { readonly id: string }[] | undefined;
}): BookingWidgetLimitedAvailability | null {
  // Intentionally `null`. Do not infer. See JSDoc above.
  return null;
}

function parsePriceToMinor(amount: string): number | null {
  // Amadeus encodes amounts as decimal strings, e.g. "1234.56".
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function normaliseCurrency(raw: string): 'EUR' | 'USD' | 'GBP' | 'CHF' {
  const upper = raw.toUpperCase();
  if (upper === 'USD' || upper === 'GBP' || upper === 'CHF') return upper;
  return 'EUR';
}

function nightCount(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}
