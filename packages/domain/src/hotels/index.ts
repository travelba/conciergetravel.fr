/**
 * Hotels bounded context — public surface.
 * Concrete entities and services arrive in Phase 2/4 along with the
 * data model and search engineering work.
 */

/**
 * @deprecated Single-supplier-per-hotel model. Superseded by the multi-supplier
 * connections model (`hotel_supplier_connections`, migration 0071) consumed by
 * the rate-shopping orchestrator. Kept readable during the transition; new code
 * should resolve bookability from supplier connections, not from this flag.
 */
export type BookingMode = 'amadeus' | 'little' | 'travelport' | 'email' | 'display_only';
export type HotelPriority = 'P0' | 'P1' | 'P2';

export const isBookable = (mode: BookingMode): boolean =>
  mode === 'amadeus' || mode === 'little' || mode === 'travelport';

/**
 * Suppliers behind the supplier-agnostic booking abstraction
 * (`packages/integrations/src/supplier`). `amadeus` / `little` remain on their
 * legacy path and are intentionally excluded here.
 */
export type Supplier = 'travelport' | 'ratehawk' | 'little_emperors';

export const ABSTRACTED_SUPPLIERS: readonly Supplier[] = [
  'travelport',
  'ratehawk',
  'little_emperors',
];

export const isAbstractedSupplier = (value: string): value is Supplier =>
  (ABSTRACTED_SUPPLIERS as readonly string[]).includes(value);
