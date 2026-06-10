import type { BookingMode } from '@mch/domain/hotels';

/** Hotels bookable via the concierge email request funnel (no GDS). */
export function isConciergeBookingMode(
  mode: BookingMode | undefined,
): mode is 'display_only' | 'email' {
  return mode === 'display_only' || mode === 'email';
}

/** Hotels wired for the paid GDS tunnel (Amadeus / Little — Phase 6). */
export function isPaidBookingMode(mode: BookingMode | undefined): mode is 'amadeus' | 'little' {
  return mode === 'amadeus' || mode === 'little';
}

/** Any fiche that ships a live booking affordance today (concierge or paid). */
export function isLiveBookingMode(mode: BookingMode | undefined): boolean {
  return isConciergeBookingMode(mode) || isPaidBookingMode(mode);
}
