import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BookingMode } from '@mch/domain/hotels';

// Mutable mock so each case can flip the Phase 6 master kill-switch. The flag
// reader resolves `env.PHASE_6_BOOKING_ENABLED` at call time, so mutating the
// shared object between cases is enough. `vi.hoisted` lets the (hoisted)
// `vi.mock` factory reference it without a TDZ error.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as { PHASE_6_BOOKING_ENABLED?: unknown },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv }));

import {
  canEmitHotelOfferJsonLd,
  canEmitRoomOfferJsonLd,
  isPhase6BookingEnabled,
} from './phase-6-flags';

afterEach(() => {
  delete mockEnv.PHASE_6_BOOKING_ENABLED;
});

const PAID_OR_BOOKABLE: ReadonlyArray<{ supplierBookable: boolean; bookingMode: BookingMode }> = [
  { supplierBookable: true, bookingMode: 'display_only' },
  { supplierBookable: false, bookingMode: 'amadeus' },
  { supplierBookable: false, bookingMode: 'little' },
  { supplierBookable: true, bookingMode: 'amadeus' },
];

describe('isPhase6BookingEnabled (Phase 6 freeze kill-switch)', () => {
  it('defaults OFF when the env var is unset', () => {
    expect(isPhase6BookingEnabled()).toBe(false);
  });

  it.each([true, 'true', '1'])('is ON for truthy value %p', (value) => {
    mockEnv.PHASE_6_BOOKING_ENABLED = value;
    expect(isPhase6BookingEnabled()).toBe(true);
  });

  it.each([false, 'false', '0', '', undefined])('is OFF for falsy value %p', (value) => {
    mockEnv.PHASE_6_BOOKING_ENABLED = value;
    expect(isPhase6BookingEnabled()).toBe(false);
  });
});

describe('canEmitHotelOfferJsonLd — hotel fiche NEVER emits an Offer in Phase 1', () => {
  // Regression for AGENTS.md §4ter / ADR-0026 / Hard Rule 5: while Phase 6 is
  // frozen, NO `booking_mode` flip and no multi-supplier rate-shopping result
  // may reintroduce an `Offer` / `priceValidUntil` JSON-LD node.
  it.each(PAID_OR_BOOKABLE)(
    'returns false when Phase 6 is OFF even for %o',
    ({ supplierBookable, bookingMode }) => {
      expect(canEmitHotelOfferJsonLd({ phase6Enabled: false, supplierBookable, bookingMode })).toBe(
        false,
      );
    },
  );

  it('returns false when Phase 6 is ON but the row is editorial (not bookable)', () => {
    expect(
      canEmitHotelOfferJsonLd({
        phase6Enabled: true,
        supplierBookable: false,
        bookingMode: 'display_only',
      }),
    ).toBe(false);
  });

  it.each(PAID_OR_BOOKABLE)(
    'returns true once Phase 6 is ON and the row is bookable (%o)',
    ({ supplierBookable, bookingMode }) => {
      expect(canEmitHotelOfferJsonLd({ phase6Enabled: true, supplierBookable, bookingMode })).toBe(
        true,
      );
    },
  );
});

describe('canEmitRoomOfferJsonLd — room sub-page NEVER emits an Offer in Phase 1', () => {
  it('returns false when Phase 6 is OFF even with a live offer present', () => {
    expect(canEmitRoomOfferJsonLd({ phase6Enabled: false, hasLiveOffer: true })).toBe(false);
  });

  it('returns false when Phase 6 is ON but there is no live offer', () => {
    expect(canEmitRoomOfferJsonLd({ phase6Enabled: true, hasLiveOffer: false })).toBe(false);
  });

  it('returns true only once Phase 6 is ON and a live offer exists', () => {
    expect(canEmitRoomOfferJsonLd({ phase6Enabled: true, hasLiveOffer: true })).toBe(true);
  });
});
