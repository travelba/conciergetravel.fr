/**
 * `HotelSupplierConnector` — the contract every supplier adapter implements.
 *
 * Scope (Phase 1-3): the BOOKABLE CATALOG side — availability search + static
 * room content. Booking execution (prebook/book/cancel) stays on each
 * supplier's existing path for now and will be normalised in a later phase;
 * connectors advertise that via `capabilities.book`.
 */
import type { Result } from '@mch/domain/shared';

import type {
  NormalizedRate,
  NormalizedRoomStatic,
  StayQuery,
  Supplier,
  SupplierBookInput,
  SupplierBookingConfirmation,
  SupplierCancelInput,
  SupplierCancelResult,
  SupplierError,
  SupplierPrebookResult,
  SupplierPropertyKey,
} from './types';

export interface SupplierCapabilities {
  /** Live availability + rates search. */
  readonly search: boolean;
  /** Preloadable static room content (room_groups / descriptions / media). */
  readonly staticContent: boolean;
  /** End-to-end booking execution through this connector (future phase). */
  readonly book: boolean;
}

export interface HotelSupplierConnector {
  readonly supplier: Supplier;
  readonly capabilities: SupplierCapabilities;

  /**
   * Live availability for a property + stay. Returns EUR-normalised rates.
   * Implementations must be best-effort and never throw — map every failure
   * to a `SupplierError`.
   */
  searchAvailability(input: {
    readonly propertyKey: SupplierPropertyKey;
    readonly stay: StayQuery;
  }): Promise<Result<readonly NormalizedRate[], SupplierError>>;

  /**
   * Preloadable static room content for a property. Used to build/validate
   * `room_supplier_mappings` and to provide a non-indexed funnel fallback.
   * Connectors without a content API return `err({ kind: 'unsupported' })`.
   */
  getStaticRoomContent(input: {
    readonly propertyKey: SupplierPropertyKey;
  }): Promise<Result<readonly NormalizedRoomStatic[], SupplierError>>;
}

/**
 * A connector that can additionally execute a booking end-to-end. The
 * rate-shopping orchestrator routes lock/book to the winning supplier's
 * connector only when it is booking-capable (see `isBookingCapable`).
 */
export interface BookingCapableConnector extends HotelSupplierConnector {
  /** Re-price a held rate immediately before booking. */
  prebook(input: {
    readonly rateToken: string;
  }): Promise<Result<SupplierPrebookResult, SupplierError>>;

  book(input: SupplierBookInput): Promise<Result<SupplierBookingConfirmation, SupplierError>>;

  cancel(input: SupplierCancelInput): Promise<Result<SupplierCancelResult, SupplierError>>;
}

export function isBookingCapable(
  connector: HotelSupplierConnector,
): connector is BookingCapableConnector {
  return (
    connector.capabilities.book === true &&
    typeof (connector as Partial<BookingCapableConnector>).book === 'function'
  );
}
