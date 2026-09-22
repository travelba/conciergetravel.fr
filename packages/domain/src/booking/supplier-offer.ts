/**
 * Normalised supplier offer — Phase 9 booking aggregation (Q43).
 *
 * Pure domain shape consumed by `aggregate-offers` and surfaced opaquely
 * in v2 (single TTC price; winning supplier invisible to the traveller).
 * Adapters in `@mch/integrations/booking-aggregation` map vendor payloads
 * into this type — never the reverse.
 */
import type { CancellationPolicy } from './cancellation-policy';

/** Active bookable suppliers behind the GIATA crosswalk (CDC v2 Q43). */
export type BookingSupplierId =
  | 'travelport'
  | 'ratehawk'
  | 'little_emperors'
  | 'expedia'
  | 'bedsonline';

/** ISO 4217 currency code. Aggregation normalises to EUR at the integration boundary. */
export type OfferCurrency = 'EUR' | 'USD' | 'GBP' | 'CHF';

/** TTC price in integer minor units (cents) — always tax-inclusive per CDC. */
export interface SupplierOfferMoney {
  readonly amountMinor: number;
  readonly currency: OfferCurrency;
}

/** Canonical room identity for dedupe / grouping across suppliers. */
export interface SupplierOfferRoomType {
  /** Stable join key (GIATA RTM label hash, rg_ext key, Travelport booking code…). */
  readonly key: string;
  readonly label: string;
  readonly maxOccupancy: number | null;
}

/**
 * Vendor-agnostic offer row after GIATA property mapping and EUR normalisation.
 * `priceValidUntil` drives JSON-LD `Offer.priceValidUntil` (ADR-0026 — vendor TTL,
 * not a fixed +7d window).
 */
export interface SupplierOffer {
  /** Opaque id stable within a search batch (dedupe + UI keys). */
  readonly id: string;
  readonly supplierId: BookingSupplierId;
  /** Token required to quote / lock / book with the winning supplier. */
  readonly rateToken: string;
  readonly roomType: SupplierOfferRoomType;
  readonly ratePlanLabel: string;
  /** Total stay price TTC in `totalPriceTtc.currency`. */
  readonly totalPriceTtc: SupplierOfferMoney;
  /** Verbatim cancellation text + structured policy when the adapter parsed one. */
  readonly cancellation: {
    readonly rawText: string;
    readonly policy: CancellationPolicy | null;
    readonly refundable: boolean | null;
  };
  /** ISO-8601 instant after which the vendor price is void. */
  readonly priceValidUntil: string;
  /**
   * Connection priority (lower = preferred at price tie — Little Emperors = 10,
   * others typically 100). Mirrors `hotel_supplier_connections.priority`.
   */
  readonly priority: number;
}
