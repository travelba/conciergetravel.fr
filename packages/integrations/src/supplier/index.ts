/**
 * @mch/integrations/supplier — supplier-agnostic booking abstraction.
 *
 * The rate-shopping orchestrator depends only on this surface; concrete vendor
 * adapters (Travelport here, RateHawk + Little Emperors in their own packages)
 * implement `HotelSupplierConnector`.
 */
export const SUPPLIER_ABSTRACTION_VERSION = '0.1.0' as const;

export type {
  Supplier,
  Currency,
  BoardType,
  StayQuery,
  SupplierPropertyKey,
  SupplierRoomKey,
  NormalizedRate,
  NormalizedRoomStatic,
  SupplierError,
  SupplierGuest,
  SupplierPrebookResult,
  SupplierBookInput,
  SupplierBookingConfirmation,
  SupplierCancelInput,
  SupplierCancelResult,
} from './types';

export type {
  HotelSupplierConnector,
  BookingCapableConnector,
  SupplierCapabilities,
} from './connector';
export { isBookingCapable } from './connector';

export { toEurMinor, parseCurrency, type EurAmount } from './money';

export { createTravelportConnector } from './connectors/travelport-connector';
