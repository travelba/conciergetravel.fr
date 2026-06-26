import 'server-only';

import type { BookingMode } from '@mch/domain/hotels';

import { isPaidBookingMode } from '@/lib/booking/booking-mode-helpers';
import { env } from '@/lib/env';

/**
 * Phase 6 booking master kill-switch — AGENTS.md §4ter + ADR-0026, rules
 * `12-schema-ota` / `31-hotel-page-blueprint`.
 *
 * Phase 6 (live booking APIs: Amadeus / Little Hotelier / multi-supplier
 * rate-shopping) is the LAST brick of the project and is frozen until the
 * editorial catalogue ships. Until this flag flips ON, NO public surface may
 * emit an `Offer` / `priceValidUntil` JSON-LD node: emitting one without a
 * real, currently-bookable rate is a SEO + DSA art. 25 violation (Hard Rule 5).
 *
 * This makes the freeze EXPLICIT instead of relying on every catalogue row
 * staying editorial. A single row flipped to `booking_mode = amadeus|little`,
 * or `MULTI_SUPPLIER_RATESHOPPING_ENABLED` turned on, must NOT silently
 * reintroduce an Offer node without opening Phase 6 first.
 *
 * Default OFF. Mirrors `isMultiSupplierRateShoppingEnabled` string-coercion so
 * `SKIP_ENV_VALIDATION=true` (raw `.env.local` strings) still resolves.
 */
export function isPhase6BookingEnabled(): boolean {
  const raw: unknown = env.PHASE_6_BOOKING_ENABLED;
  return raw === true || raw === 'true' || raw === '1';
}

export interface HotelOfferJsonLdGateInput {
  /** `isPhase6BookingEnabled()` — the master kill-switch. */
  readonly phase6Enabled: boolean;
  /** Multi-supplier rate-shopping returned a lockable winning rate. */
  readonly supplierBookable: boolean;
  /** The hotel row's persisted booking mode. */
  readonly bookingMode: BookingMode;
}

/**
 * Pure gate for the hotel-fiche `Offer` JSON-LD node. Returns `false` whenever
 * Phase 6 is frozen, regardless of `booking_mode` or supplier availability —
 * the legacy data conditions only matter once Phase 6 is open.
 */
export function canEmitHotelOfferJsonLd(input: HotelOfferJsonLdGateInput): boolean {
  if (!input.phase6Enabled) return false;
  return input.supplierBookable || isPaidBookingMode(input.bookingMode);
}

export interface RoomOfferJsonLdGateInput {
  /** `isPhase6BookingEnabled()` — the master kill-switch. */
  readonly phase6Enabled: boolean;
  /** A live, non-fabricated supplier rate was resolved for the room. */
  readonly hasLiveOffer: boolean;
}

/**
 * Pure gate for the room sub-page `Offer` JSON-LD node. Returns `false` whenever
 * Phase 6 is frozen, even if a (test/fake) live rate is present.
 */
export function canEmitRoomOfferJsonLd(input: RoomOfferJsonLdGateInput): boolean {
  return input.phase6Enabled && input.hasLiveOffer;
}
