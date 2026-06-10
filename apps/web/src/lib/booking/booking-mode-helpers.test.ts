import { describe, expect, it } from 'vitest';

import {
  isConciergeBookingMode,
  isLiveBookingMode,
  isPaidBookingMode,
} from './booking-mode-helpers';

describe('booking-mode-helpers', () => {
  it('classifies concierge modes', () => {
    expect(isConciergeBookingMode('display_only')).toBe(true);
    expect(isConciergeBookingMode('email')).toBe(true);
    expect(isConciergeBookingMode('amadeus')).toBe(false);
  });

  it('classifies paid GDS modes', () => {
    expect(isPaidBookingMode('amadeus')).toBe(true);
    expect(isPaidBookingMode('little')).toBe(true);
    expect(isPaidBookingMode('display_only')).toBe(false);
    expect(isPaidBookingMode('travelport')).toBe(false);
  });

  it('detects any live booking affordance', () => {
    expect(isLiveBookingMode('display_only')).toBe(true);
    expect(isLiveBookingMode('amadeus')).toBe(true);
    expect(isLiveBookingMode('travelport')).toBe(false);
    expect(isLiveBookingMode(undefined)).toBe(false);
  });
});
