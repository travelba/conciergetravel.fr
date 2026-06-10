import type { BookingMode } from '@mch/domain/hotels';

/** Hotels bookable via the concierge email request funnel (no live supplier ARI). */
export function isConciergeBookingMode(
  mode: BookingMode | undefined,
): mode is 'display_only' | 'email' {
  return mode === 'display_only' || mode === 'email';
}

/**
 * @deprecated Amadeus / Little Hotelier legacy path — being removed (ADR-0026).
 * Prefer `railContext.supplierBookable` from `prepareHotelBookingRail`.
 */
export function isPaidBookingMode(mode: BookingMode | undefined): mode is 'amadeus' | 'little' {
  return mode === 'amadeus' || mode === 'little';
}

/** Live booking affordance: concierge request or supplier rate-shopping rail. */
export function isLiveBookingMode(mode: BookingMode | undefined): boolean {
  return isConciergeBookingMode(mode) || isPaidBookingMode(mode);
}

/** Multi-supplier paid rail (LE + RateHawk + Travelport via shopRates). */
export function isSupplierBookableRail(
  railContext:
    | { readonly supplierBookable: boolean; readonly lockActionUrl: string | null }
    | undefined,
  hotelId: string | undefined,
): boolean {
  return (
    hotelId !== undefined &&
    railContext !== undefined &&
    railContext.supplierBookable &&
    railContext.lockActionUrl !== null
  );
}
