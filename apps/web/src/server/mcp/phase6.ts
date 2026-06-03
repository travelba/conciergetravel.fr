import 'server-only';

import { getHotelBySlug } from '@/server/hotels/get-hotel-by-slug';

import { type AgentLocale, type BuilderResponse, errorResponse } from './builders/types';

/**
 * Phase 6 freeze guard (Lot 4 — MCP server, ADR-0029 + AGENTS.md §4ter).
 *
 * The freeze is DATA-driven, not a code flag: a hotel only exposes live
 * booking / pricing once its `booking_mode` flips to `amadeus` / `little`
 * (and, for the comparator, once it carries a `makcorps_hotel_id`). In
 * the editorial phase every one of the 2219 rows is `display_only`, so
 * every pricing/booking capability resolves to `frozen`.
 *
 * The MCP tools for `compare-prices`, `request-quote` and `booking`
 * short-circuit through these helpers BEFORE any vendor adapter
 * (Makcorps / Amadeus / Brevo) can be reached — guaranteeing zero live
 * calls from the agentic surface during the observation phase.
 */

export type FrozenCapability = 'compare-prices' | 'request-quote' | 'booking';

interface FrozenExtra {
  readonly [key: string]: unknown;
}

/**
 * Builds a uniform `frozen` capability envelope. The call "succeeds"
 * (`ok: true`) so an agent can branch on `status: 'frozen'` rather than
 * treating the capability as a hard error.
 */
export function frozenCapabilityResult(
  capability: FrozenCapability,
  extra: FrozenExtra = {},
): BuilderResponse {
  return {
    status: 200,
    cacheControl: 'no-store',
    body: {
      ok: true,
      capability,
      status: 'frozen',
      phase: 6,
      reason: 'booking_apis_not_wired',
      availableAt: 'phase_6',
      bookingMode: 'display_only',
      ...extra,
    },
  };
}

/**
 * Resolves a hotel by slug (a DB read — never a vendor call) so the
 * frozen envelope can still 404 on an unknown slug and echo the real
 * `booking_mode`, staying correct the day a hotel flips to bookable.
 */
async function resolveBookingMode(
  slug: string,
  locale: AgentLocale,
): Promise<{ readonly bookingMode: string } | null> {
  const hotel = await getHotelBySlug(slug, locale).catch(() => null);
  if (hotel === null) return null;
  return { bookingMode: hotel.row.booking_mode };
}

export interface FrozenComparePricesParams {
  readonly hotelSlug: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly locale: AgentLocale;
}

export async function buildFrozenComparePricesResult(
  params: FrozenComparePricesParams,
): Promise<BuilderResponse> {
  const resolved = await resolveBookingMode(params.hotelSlug, params.locale);
  if (resolved === null) {
    return errorResponse(404, { error: 'hotel_not_found', hotelSlug: params.hotelSlug });
  }
  return frozenCapabilityResult('compare-prices', {
    hotelSlug: params.hotelSlug,
    bookingMode: resolved.bookingMode,
    note: 'price_comparison_not_wired',
  });
}

export interface FrozenQuoteParams {
  readonly hotelSlug: string;
  readonly locale: AgentLocale;
}

export async function buildFrozenQuoteResult(params: FrozenQuoteParams): Promise<BuilderResponse> {
  const resolved = await resolveBookingMode(params.hotelSlug, params.locale);
  if (resolved === null) {
    return errorResponse(404, { error: 'hotel_not_found', slug: params.hotelSlug });
  }
  return frozenCapabilityResult('request-quote', {
    hotelSlug: params.hotelSlug,
    bookingMode: resolved.bookingMode,
    note: 'email_booking_not_wired',
  });
}

export function buildFrozenBookingResult(): BuilderResponse {
  return frozenCapabilityResult('booking', { note: 'booking_engine_not_wired' });
}
