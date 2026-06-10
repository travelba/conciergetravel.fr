import { describe, expect, it } from 'vitest';

import { isConciergeBookingMode } from './concierge-booking-mode';

describe('isConciergeBookingMode', () => {
  it('returns true for display_only and email', () => {
    expect(isConciergeBookingMode('display_only')).toBe(true);
    expect(isConciergeBookingMode('email')).toBe(true);
  });

  it('returns false for paid and travelport modes', () => {
    expect(isConciergeBookingMode('amadeus')).toBe(false);
    expect(isConciergeBookingMode('little')).toBe(false);
    expect(isConciergeBookingMode('travelport')).toBe(false);
    expect(isConciergeBookingMode(undefined)).toBe(false);
  });
});
