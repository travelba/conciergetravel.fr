import 'server-only';

import type { SupplierPropertyKey, SupplierRoomKey } from '@mch/integrations/supplier';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Read-side repository for the multi-supplier bookable catalog (migration
 * 0071). Service-role reads — the tables carry no PII and are operational.
 *
 * - `hotel_supplier_connections` : which suppliers can sell a given hotel.
 * - `room_supplier_mappings`     : deterministic editorial room <-> supplier
 *   room identity (replaces the runtime fuzzy matcher).
 *
 * `amadeus` / `little` rows are ignored here — they remain on their legacy
 * path and are not part of the supplier-agnostic abstraction yet.
 */

const AbstractedSupplierSchema = z.enum(['travelport', 'ratehawk', 'little_emperors']);

const ConnectionRowSchema = z.object({
  supplier: z.string(),
  supplier_property_key: z.unknown(),
  enabled: z.boolean(),
  priority: z.number().int(),
});

const RoomMappingRowSchema = z.object({
  hotel_room_id: z.string().uuid(),
  supplier: z.string(),
  supplier_room_key: z.unknown(),
});

const TravelportPropertyKeySchema = z.object({
  chainCode: z.string().min(1),
  propertyCode: z.string().min(1),
});
const RateHawkPropertyKeySchema = z.object({ hotelId: z.string().min(1) });
const LittleEmperorsPropertyKeySchema = z.object({ propertyRef: z.string().min(1) });

const TravelportRoomKeySchema = z.object({
  labels: z.array(z.string()).default([]),
  bookingCodes: z.array(z.string()).optional(),
});
const RateHawkRoomKeySchema = z.object({ rg_ext: z.record(z.string(), z.number()) });
const LittleEmperorsRoomKeySchema = z.object({ ref: z.string().min(1) });

export interface HotelSupplierConnection {
  readonly supplier: SupplierPropertyKey['supplier'];
  readonly propertyKey: SupplierPropertyKey;
  readonly enabled: boolean;
  readonly priority: number;
}

export interface RoomSupplierMapping {
  readonly hotelRoomId: string;
  readonly supplier: SupplierRoomKey['supplier'];
  readonly roomKey: SupplierRoomKey;
}

function parsePropertyKey(supplier: string, raw: unknown): SupplierPropertyKey | null {
  if (supplier === 'travelport') {
    const p = TravelportPropertyKeySchema.safeParse(raw);
    return p.success ? { supplier: 'travelport', ...p.data } : null;
  }
  if (supplier === 'ratehawk') {
    const p = RateHawkPropertyKeySchema.safeParse(raw);
    return p.success ? { supplier: 'ratehawk', hotelId: p.data.hotelId } : null;
  }
  if (supplier === 'little_emperors') {
    const p = LittleEmperorsPropertyKeySchema.safeParse(raw);
    return p.success ? { supplier: 'little_emperors', propertyRef: p.data.propertyRef } : null;
  }
  return null;
}

function parseRoomKey(supplier: string, raw: unknown): SupplierRoomKey | null {
  if (supplier === 'travelport') {
    const p = TravelportRoomKeySchema.safeParse(raw);
    if (!p.success) return null;
    return {
      supplier: 'travelport',
      labels: p.data.labels,
      ...(p.data.bookingCodes !== undefined ? { bookingCodes: p.data.bookingCodes } : {}),
    };
  }
  if (supplier === 'ratehawk') {
    const p = RateHawkRoomKeySchema.safeParse(raw);
    return p.success ? { supplier: 'ratehawk', rgExt: p.data.rg_ext } : null;
  }
  if (supplier === 'little_emperors') {
    const p = LittleEmperorsRoomKeySchema.safeParse(raw);
    return p.success ? { supplier: 'little_emperors', ref: p.data.ref } : null;
  }
  return null;
}

/** Enabled supplier connections for a hotel, restricted to abstracted suppliers. */
export async function getHotelSupplierConnections(
  hotelId: string,
): Promise<readonly HotelSupplierConnection[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('hotel_supplier_connections')
    .select('supplier, supplier_property_key, enabled, priority')
    .eq('hotel_id', hotelId)
    .eq('enabled', true);

  if (error !== null || data === null) return [];

  const out: HotelSupplierConnection[] = [];
  for (const candidate of Array.isArray(data) ? data : []) {
    const row = ConnectionRowSchema.safeParse(candidate);
    if (!row.success) continue;
    if (!AbstractedSupplierSchema.safeParse(row.data.supplier).success) continue;
    const propertyKey = parsePropertyKey(row.data.supplier, row.data.supplier_property_key);
    if (propertyKey === null) continue;
    out.push({
      supplier: propertyKey.supplier,
      propertyKey,
      enabled: row.data.enabled,
      priority: row.data.priority,
    });
  }
  return out;
}

/** Deterministic room mappings for a hotel, restricted to abstracted suppliers. */
export async function getRoomSupplierMappings(
  hotelId: string,
): Promise<readonly RoomSupplierMapping[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('room_supplier_mappings')
    .select('hotel_room_id, supplier, supplier_room_key')
    .eq('hotel_id', hotelId);

  if (error !== null || data === null) return [];

  const out: RoomSupplierMapping[] = [];
  for (const candidate of Array.isArray(data) ? data : []) {
    const row = RoomMappingRowSchema.safeParse(candidate);
    if (!row.success) continue;
    if (!AbstractedSupplierSchema.safeParse(row.data.supplier).success) continue;
    const roomKey = parseRoomKey(row.data.supplier, row.data.supplier_room_key);
    if (roomKey === null) continue;
    out.push({ hotelRoomId: row.data.hotel_room_id, supplier: roomKey.supplier, roomKey });
  }
  return out;
}

const HotelGiataContextSchema = z.object({
  giata_id: z.string().nullable(),
  name: z.string(),
});

/** GIATA RTM context for rate-shopping (property id + display name). */
export async function getHotelGiataRtmContext(
  hotelId: string,
): Promise<{ readonly giataId: string; readonly propertyName: string } | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('hotels')
    .select('giata_id, name')
    .eq('id', hotelId)
    .maybeSingle();

  if (error !== null || data === null) return null;
  const row = HotelGiataContextSchema.safeParse(data);
  if (!row.success) return null;
  const giataId = row.data.giata_id?.trim();
  if (giataId === undefined || giataId.length === 0) return null;
  const propertyName = row.data.name.trim();
  if (propertyName.length === 0) return null;
  return { giataId, propertyName };
}
