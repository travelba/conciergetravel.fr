/**
 * Booking aggregation types — Phase 9 multi-supplier orchestrator (Q43).
 *
 * Distinct from `@mch/integrations/supplier` (rate-shopping v1 path) but
 * reuses the same stay / property-key shapes where possible.
 */
import type { BookingSupplierId, SupplierOffer } from '@mch/domain/booking';
import type { Result } from '@mch/domain/shared';
import type { HttpError } from '../http';

/** ISO calendar stay window shared by all connectors. */
export interface AggregationStayQuery {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly childAges?: readonly number[];
  readonly currency?: 'EUR' | 'USD' | 'GBP' | 'CHF';
}

/** GIATA-resolved property identity for one supplier channel. */
export type AggregationPropertyKey =
  | { readonly supplier: 'travelport'; readonly chainCode: string; readonly propertyCode: string }
  | { readonly supplier: 'ratehawk'; readonly hotelId: string }
  | { readonly supplier: 'little_emperors'; readonly propertyRef: string }
  | { readonly supplier: 'expedia'; readonly propertyId: string }
  | { readonly supplier: 'bedsonline'; readonly propertyId: string };

export type AggregationError =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'not_configured'; readonly details: string }
  | { readonly kind: 'unsupported'; readonly capability: string }
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'price_changed' }
  | { readonly kind: 'no_availability' };

export interface AggregationSearchInput {
  readonly propertyKey: AggregationPropertyKey;
  readonly stay: AggregationStayQuery;
  readonly priority: number;
}

export interface AggregationQuoteInput {
  readonly rateToken: string;
  readonly stay: AggregationStayQuery;
}

export interface AggregationGuest {
  readonly firstName: string;
  readonly lastName: string;
}

export interface AggregationBookInput {
  readonly rateToken: string;
  readonly partnerOrderId: string;
  readonly stay: AggregationStayQuery;
  readonly leadGuest: AggregationGuest;
  readonly guests: readonly AggregationGuest[];
  readonly email: string;
  readonly phone: string;
}

export interface AggregationBookingConfirmation {
  readonly supplierId: BookingSupplierId;
  readonly partnerOrderId: string;
  readonly supplierOrderId: string;
  readonly status: 'confirmed' | 'processing' | 'failed';
}

export interface AggregationCancelInput {
  readonly partnerOrderId: string;
}

export interface AggregationCancelResult {
  readonly cancelled: boolean;
  readonly status: string;
}

/**
 * Supplier connector contract for Phase 9 — search, quote, book, cancel.
 * Implementations live under `connectors/` and must never throw.
 */
export interface SupplierConnector {
  readonly supplierId: BookingSupplierId;
  readonly enabled: boolean;

  search(
    input: AggregationSearchInput,
  ): Promise<Result<readonly SupplierOffer[], AggregationError>>;

  quote(input: AggregationQuoteInput): Promise<Result<SupplierOffer, AggregationError>>;

  book(
    input: AggregationBookInput,
  ): Promise<Result<AggregationBookingConfirmation, AggregationError>>;

  cancel(input: AggregationCancelInput): Promise<Result<AggregationCancelResult, AggregationError>>;
}

/** Hotel crosswalk loaded from GIATA + `v2.hotel_supplier_codes`. */
export interface GiataMappedConnection {
  readonly supplierId: BookingSupplierId;
  readonly propertyKey: AggregationPropertyKey;
  readonly enabled: boolean;
  readonly priority: number;
}

export interface GiataHotelMapping {
  readonly hotelId: string;
  readonly giataId: string | null;
  readonly connections: readonly GiataMappedConnection[];
}

export interface AggregateOffersInput {
  readonly mapping: GiataHotelMapping;
  readonly stay: AggregationStayQuery;
  readonly connectors: ReadonlyMap<BookingSupplierId, SupplierConnector>;
}

export interface AggregateOffersOutput {
  readonly offers: readonly SupplierOffer[];
  readonly suppliersQueried: readonly BookingSupplierId[];
  readonly errors: Readonly<Partial<Record<BookingSupplierId, AggregationError>>>;
}
