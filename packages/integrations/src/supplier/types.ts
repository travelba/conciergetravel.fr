/**
 * Supplier-agnostic booking abstraction (skill: product-architecture,
 * api-integration).
 *
 * Every bookable supplier (Travelport, RateHawk, Little Emperors, ...) is
 * adapted to this common shape so the rate-shopping orchestrator can fan out
 * to N suppliers, normalise their rates to EUR, group them by canonical room
 * (via `room_supplier_mappings`) and surface the best price.
 *
 * This module is pure types — no I/O, no env, edge-safe.
 */
import type { HttpError } from '@mch/integrations/http';

/** Active suppliers behind the abstraction. Legacy `amadeus`/`little` stay on
 *  their own path for now (the DB allow-list keeps them for forward-compat). */
export type Supplier = 'travelport' | 'ratehawk' | 'little_emperors';

export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

export type BoardType =
  | 'room_only'
  | 'breakfast'
  | 'half_board'
  | 'full_board'
  | 'all_inclusive'
  | 'unknown';

/** A stay to price. ISO calendar dates `YYYY-MM-DD`. */
export interface StayQuery {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly childAges?: readonly number[];
  /** Preferred settlement currency; the orchestrator still normalises to EUR. */
  readonly currency?: Currency;
}

/** Supplier-specific property identity (mirrors
 *  `hotel_supplier_connections.supplier_property_key`). */
export type SupplierPropertyKey =
  | { readonly supplier: 'travelport'; readonly chainCode: string; readonly propertyCode: string }
  | { readonly supplier: 'ratehawk'; readonly hotelId: string }
  | { readonly supplier: 'little_emperors'; readonly propertyRef: string };

/** Supplier room identity used to join live rates to a canonical editorial
 *  room (mirrors `room_supplier_mappings.supplier_room_key`). */
export type SupplierRoomKey =
  | {
      readonly supplier: 'travelport';
      readonly labels: readonly string[];
      readonly bookingCodes?: readonly string[];
    }
  | { readonly supplier: 'ratehawk'; readonly rgExt: Readonly<Record<string, number>> }
  | { readonly supplier: 'little_emperors'; readonly ref: string };

/** A single normalised, EUR-denominated rate from a supplier. */
export interface NormalizedRate {
  readonly supplier: Supplier;
  /** Opaque token to re-price / lock with the supplier (rateKey, book_hash...). */
  readonly rateToken: string;
  /** Supplier room identity (joins to `room_supplier_mappings`). */
  readonly roomKey: SupplierRoomKey;
  readonly roomLabel: string;
  readonly ratePlanLabel: string;
  /** EUR minor units (cents). Already converted from the supplier currency. */
  readonly priceMinor: number;
  readonly currency: 'EUR';
  /** Original supplier amount before conversion, when not EUR. */
  readonly originalPriceMinor?: number;
  readonly originalCurrency?: Currency;
  readonly board: BoardType;
  readonly breakfastIncluded: boolean | null;
  readonly refundable: boolean | null;
  readonly cancellationText: string;
  readonly maxOccupancy: number | null;
}

/** Static (preloadable) room content from a supplier Content API. */
export interface NormalizedRoomStatic {
  readonly roomKey: SupplierRoomKey;
  readonly name: string | null;
  readonly amenities: readonly string[];
  /** Supplier-hosted image URLs. May be NON-INDEXABLE (see `indexableContent`). */
  readonly imageUrls: readonly string[];
  /**
   * Whether this supplier's media/descriptions may be exposed on indexable
   * (index,follow) pages. RateHawk = false (contractual): such content may
   * only feed the non-indexed booking funnel.
   */
  readonly indexableContent: boolean;
}

export type SupplierError =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'not_configured'; readonly details: string }
  | { readonly kind: 'unsupported'; readonly capability: string }
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'price_changed' }
  | { readonly kind: 'no_availability' };

// --- Booking execution (prebook / book / cancel) -----------------------------

export interface SupplierGuest {
  readonly firstName: string;
  readonly lastName: string;
}

/** Result of re-pricing a held rate immediately before booking. */
export interface SupplierPrebookResult {
  /** Possibly-refreshed token to pass to `book`. */
  readonly rateToken: string;
  readonly priceMinor: number;
  readonly currency: 'EUR';
  /** True when the supplier returned a different price than the search rate. */
  readonly priceChanged: boolean;
  readonly available: boolean;
}

export interface SupplierBookInput {
  /** Token from `prebook` (or search when the supplier needs no prebook). */
  readonly rateToken: string;
  /** Idempotency key on OUR side (stable per booking attempt). */
  readonly partnerOrderId: string;
  readonly stay: StayQuery;
  readonly leadGuest: SupplierGuest;
  readonly guests: readonly SupplierGuest[];
  readonly email: string;
  readonly phone: string;
}

export interface SupplierBookingConfirmation {
  readonly supplier: Supplier;
  readonly partnerOrderId: string;
  readonly supplierOrderId: string;
  readonly status: 'confirmed' | 'processing' | 'failed';
}

export interface SupplierCancelInput {
  readonly partnerOrderId: string;
}

export interface SupplierCancelResult {
  readonly cancelled: boolean;
  readonly status: string;
}
