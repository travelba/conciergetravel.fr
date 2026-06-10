import 'server-only';

import type { GiataSupplierPropertyRow } from '@mch/integrations/giata';
import { fetchGiataPropertyById } from '@mch/integrations/giata';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

import { getGiataMulticodesClientConfig } from '@/server/giata/multicodes-config';

/** Default connection priorities — LE primary (ADR-0026). */
const SUPPLIER_PRIORITY: Readonly<Record<string, number>> = {
  little_emperors: 10,
  ratehawk: 100,
  travelport: 100,
};

export interface GiataSeedResult {
  readonly giataId: string;
  readonly hotelId: string;
  readonly supplierRowsStored: number;
  readonly connectionsUpserted: number;
}

async function upsertGiataSupplierRow(
  hotelId: string,
  row: GiataSupplierPropertyRow,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('giata_supplier_properties').upsert(
    {
      giata_id: row.giataId,
      supplier: row.supplier,
      supplier_property_key: row.supplierPropertyKey,
      hotel_id: hotelId,
      provider_code_raw: row.providerCodeRaw,
      confidence: 'giata_api',
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'giata_id,supplier' },
  );
  return error === null;
}

async function upsertHotelConnection(
  hotelId: string,
  row: GiataSupplierPropertyRow,
): Promise<boolean> {
  const priority = SUPPLIER_PRIORITY[row.supplier] ?? 100;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('hotel_supplier_connections').upsert(
    {
      hotel_id: hotelId,
      supplier: row.supplier,
      supplier_property_key: row.supplierPropertyKey,
      enabled: true,
      priority,
    },
    { onConflict: 'hotel_id,supplier' },
  );
  return error === null;
}

/**
 * Fetch GIATA crosswalk for a hotel, persist rows, and seed supplier connections.
 * Idempotent — safe to re-run after GIATA API spec updates.
 */
export async function seedSupplierConnectionsFromGiata(input: {
  readonly hotelId: string;
  readonly giataId: string;
}): Promise<GiataSeedResult> {
  const config = getGiataMulticodesClientConfig();
  if (config === null) {
    return {
      giataId: input.giataId,
      hotelId: input.hotelId,
      supplierRowsStored: 0,
      connectionsUpserted: 0,
    };
  }

  const property = await fetchGiataPropertyById(config, { giataId: input.giataId });
  if (!property.ok) {
    return {
      giataId: input.giataId,
      hotelId: input.hotelId,
      supplierRowsStored: 0,
      connectionsUpserted: 0,
    };
  }

  const supabase = getSupabaseAdminClient();
  await supabase.from('hotels').update({ giata_id: input.giataId }).eq('id', input.hotelId);

  let supplierRowsStored = 0;
  let connectionsUpserted = 0;

  for (const row of property.value.supplierRows) {
    if (await upsertGiataSupplierRow(input.hotelId, row)) supplierRowsStored += 1;
    if (await upsertHotelConnection(input.hotelId, row)) connectionsUpserted += 1;
  }

  return {
    giataId: input.giataId,
    hotelId: input.hotelId,
    supplierRowsStored,
    connectionsUpserted,
  };
}
