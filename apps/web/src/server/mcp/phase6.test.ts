import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Phase 6 freeze guard tests (Lot 4 — MCP server, ADR-0029).
 *
 * Two invariants:
 *  1. `compare-prices`, `request-quote` and `booking` always resolve to
 *     a `status: 'frozen'` envelope (never an `Offer`, never a live
 *     price/booking).
 *  2. Zero vendor calls: the frozen path must NOT reach the price
 *     comparison service nor the e-mail booking domain. We mock both
 *     vendors and assert their fns are never invoked — a future
 *     regression that wires them prematurely fails here.
 */

const getPriceComparison = vi.fn();
const submitEmailBookingRequest = vi.fn();
const getHotelBySlug = vi.fn();

vi.mock('@/server/price-comparison/service', () => ({
  getPriceComparison: (...args: unknown[]) => getPriceComparison(...args),
}));
vi.mock('@/server/booking/email-request', () => ({
  submitEmailBookingRequest: (...args: unknown[]) => submitEmailBookingRequest(...args),
}));
vi.mock('@/server/hotels/get-hotel-by-slug', () => ({
  getHotelBySlug: (...args: unknown[]) => getHotelBySlug(...args),
}));

import {
  buildFrozenBookingResult,
  buildFrozenComparePricesResult,
  buildFrozenQuoteResult,
  frozenCapabilityResult,
} from './phase6';

const FAKE_HOTEL = { row: { id: 'uuid-123', booking_mode: 'display_only' } };

beforeEach(() => {
  vi.clearAllMocks();
  getHotelBySlug.mockResolvedValue(FAKE_HOTEL);
});

describe('frozenCapabilityResult', () => {
  it('returns a uniform, ok:true frozen envelope', () => {
    const res = frozenCapabilityResult('booking');
    expect(res.status).toBe(200);
    expect(res.cacheControl).toBe('no-store');
    expect(res.body).toMatchObject({
      ok: true,
      capability: 'booking',
      status: 'frozen',
      phase: 6,
      reason: 'booking_apis_not_wired',
      bookingMode: 'display_only',
    });
  });
});

describe('buildFrozenComparePricesResult', () => {
  it('returns frozen and echoes the real booking_mode without calling the comparator', async () => {
    const res = await buildFrozenComparePricesResult({
      hotelSlug: 'le-bristol-paris',
      checkIn: '2026-07-01',
      checkOut: '2026-07-03',
      adults: 2,
      locale: 'fr',
    });

    expect(res.status).toBe(200);
    expect(res.body['status']).toBe('frozen');
    expect(res.body['bookingMode']).toBe('display_only');
    expect(getPriceComparison).not.toHaveBeenCalled();
  });

  it('404s on an unknown slug (DB read only, still no vendor call)', async () => {
    getHotelBySlug.mockResolvedValueOnce(null);
    const res = await buildFrozenComparePricesResult({
      hotelSlug: 'does-not-exist',
      checkIn: '2026-07-01',
      checkOut: '2026-07-03',
      adults: 2,
      locale: 'fr',
    });
    expect(res.status).toBe(404);
    expect(res.body['ok']).toBe(false);
    expect(getPriceComparison).not.toHaveBeenCalled();
  });
});

describe('buildFrozenQuoteResult', () => {
  it('returns frozen without submitting an e-mail booking request', async () => {
    const res = await buildFrozenQuoteResult({ hotelSlug: 'le-bristol-paris', locale: 'fr' });
    expect(res.body['status']).toBe('frozen');
    expect(submitEmailBookingRequest).not.toHaveBeenCalled();
  });
});

describe('buildFrozenBookingResult', () => {
  it('returns frozen with zero dependency reads', () => {
    const res = buildFrozenBookingResult();
    expect(res.body['status']).toBe('frozen');
    expect(res.body['capability']).toBe('booking');
    expect(getHotelBySlug).not.toHaveBeenCalled();
    expect(submitEmailBookingRequest).not.toHaveBeenCalled();
  });
});
