import { z } from 'zod';

import type { Supplier } from '../supplier/types';

/** GIATA supplier slug aligned with `hotel_supplier_connections.supplier`. */
export const GiataSupplierSchema = z.enum(['travelport', 'ratehawk', 'little_emperors']);

export type GiataSupplier = z.infer<typeof GiataSupplierSchema>;

/**
 * Normalised crosswalk row produced by the GIATA client after parsing the
 * vendor response. Shape is stable regardless of GIATA API wire format —
 * adapt `parseGiataPropertyResponse` when the PO supplies the API spec.
 */
export interface GiataSupplierPropertyRow {
  readonly giataId: string;
  readonly supplier: GiataSupplier;
  readonly supplierPropertyKey: Record<string, string>;
  readonly providerCodeRaw: string | null;
}

export const GiataPropertyLookupInputSchema = z.object({
  giataId: z.string().min(1),
});

export type GiataPropertyLookupInput = z.infer<typeof GiataPropertyLookupInputSchema>;

export const GiataHotelMatchInputSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  countryCode: z.string().length(2).optional(),
});

export type GiataHotelMatchInput = z.infer<typeof GiataHotelMatchInputSchema>;

export interface GiataPropertyResult {
  readonly giataId: string;
  readonly name: string | null;
  readonly city: string | null;
  readonly countryCode: string | null;
  readonly supplierRows: readonly GiataSupplierPropertyRow[];
}

/**
 * Maps GIATA `providerCode` values to MCH booking suppliers.
 * Test MC access is limited to Restel / GoGlobal / AIC — production unlocks ~500 providers.
 */
export const GIATA_PROVIDER_TO_SUPPLIER: Readonly<Record<string, Supplier>> = {
  travelport: 'travelport',
  galileo: 'travelport',
  apollo: 'travelport',
  worldspan: 'travelport',
  '1g': 'travelport',
  '1v': 'travelport',
  '1p': 'travelport',
  gta: 'travelport',
  ratehawk: 'ratehawk',
  etg: 'ratehawk',
  worldota: 'ratehawk',
  'little emperors': 'little_emperors',
  little_emperors: 'little_emperors',
};
