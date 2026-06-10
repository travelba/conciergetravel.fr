import 'server-only';

import { buildGiataRtmLabelIndex, mapGiataRoomTypes } from '@mch/integrations/giata';
import type { GiataRtmLabelIndex } from '@mch/integrations/giata';
import { rgExtKey } from '@mch/integrations/ratehawk';
import type {
  NormalizedRate,
  StayQuery,
  Supplier,
  SupplierRoomKey,
} from '@mch/integrations/supplier';

import {
  getHotelGiataRtmContext,
  getHotelSupplierConnections,
  getRoomSupplierMappings,
  type RoomSupplierMapping,
} from '@/server/booking/supplier-catalog-repo';
import { getSupplierConnectors } from '@/server/booking/supplier-registry';
import { getGiataRtmClientConfig } from '@/server/giata/rtm-config';

/**
 * Rate-shopping orchestrator (Phase 3).
 *
 * Fans out, in parallel, to every enabled + search-capable supplier connected
 * to a hotel; normalises rates to EUR; resolves each rate to its canonical
 * editorial room via the STORED `room_supplier_mappings` (deterministic join,
 * no fuzzy matching); groups by canonical room and reduces to the best price
 * per room (tie-break on connection `priority`, lower wins).
 *
 * Unmapped rates fall back to GIATA Room Type Mapping (RTM) when
 * `GIATA_RTM_ENABLED` and `hotels.giata_id` are set; otherwise they are
 * grouped per supplier label so inventory is never hidden.
 */

export interface AggregatedRate extends NormalizedRate {
  /** Connection priority of the winning supplier (lower = preferred). */
  readonly priority: number;
}

export interface AggregatedRoom {
  /** `hotel_rooms.id` when the rate is mapped to a canonical room, else null. */
  readonly canonicalRoomId: string | null;
  /** Display label fallback (supplier room label; editorial name resolved by caller). */
  readonly label: string;
  /** Cheapest rate across all suppliers for this room. */
  readonly best: AggregatedRate;
  /** All rates for this room, cheapest first. */
  readonly all: readonly AggregatedRate[];
}

export interface RateShoppingResult {
  readonly rooms: readonly AggregatedRoom[];
  /** Suppliers that returned at least one rate. */
  readonly suppliersQueried: readonly Supplier[];
  /** True when a concierge/email-only supplier is connected (e.g. Little Emperors). */
  readonly hasConciergeOnlySupplier: boolean;
}

function roomKeyMatches(a: SupplierRoomKey, b: SupplierRoomKey): boolean {
  if (a.supplier !== b.supplier) return false;
  if (a.supplier === 'ratehawk' && b.supplier === 'ratehawk') {
    return rgExtKey(a.rgExt) === rgExtKey(b.rgExt);
  }
  if (a.supplier === 'travelport' && b.supplier === 'travelport') {
    const aCodes = new Set(a.bookingCodes ?? []);
    const bCodes = new Set(b.bookingCodes ?? []);
    for (const c of aCodes) if (bCodes.has(c)) return true;
    const aLabels = new Set(a.labels.map((l) => l.trim().toLowerCase()));
    for (const l of b.labels) if (aLabels.has(l.trim().toLowerCase())) return true;
    return false;
  }
  if (a.supplier === 'little_emperors' && b.supplier === 'little_emperors') {
    return a.ref === b.ref;
  }
  return false;
}

function resolveCanonicalRoomId(
  rate: NormalizedRate,
  mappings: readonly RoomSupplierMapping[],
): string | null {
  for (const m of mappings) {
    if (m.supplier !== rate.supplier) continue;
    if (roomKeyMatches(rate.roomKey, m.roomKey)) return m.hotelRoomId;
  }
  return null;
}

async function resolveGiataRtmLabelIndex(
  hotelId: string,
  rates: readonly NormalizedRate[],
): Promise<ReadonlyMap<string, GiataRtmLabelIndex> | null> {
  const rtmConfig = getGiataRtmClientConfig();
  if (rtmConfig === null) return null;

  const context = await getHotelGiataRtmContext(hotelId);
  if (context === null) return null;

  const uniqueLabels = [...new Set(rates.map((r) => r.roomLabel))];
  const mapped = await mapGiataRoomTypes(rtmConfig, {
    giataId: context.giataId,
    propertyName: context.propertyName,
    roomTypes: uniqueLabels,
  });
  if (!mapped.ok) return null;
  return buildGiataRtmLabelIndex(mapped.value);
}

function groupKeyForRate(
  rate: NormalizedRate,
  canonicalRoomId: string | null,
  giataIndex: ReadonlyMap<string, GiataRtmLabelIndex> | null,
): string {
  if (canonicalRoomId !== null) return `room:${canonicalRoomId}`;
  const giata = giataIndex?.get(rate.roomLabel);
  if (giata !== undefined) return `giata:${giata.groupId}`;
  return `unmapped:${rate.supplier}:${rate.roomLabel.trim().toLowerCase()}`;
}

function displayLabelForRate(
  rate: NormalizedRate,
  canonicalRoomId: string | null,
  giataIndex: ReadonlyMap<string, GiataRtmLabelIndex> | null,
): string {
  if (canonicalRoomId !== null) return rate.roomLabel;
  const giata = giataIndex?.get(rate.roomLabel);
  return giata?.groupName ?? rate.roomLabel;
}

/**
 * Run rate-shopping for a hotel + stay. Returns aggregated rooms with the best
 * cross-supplier price. Never throws — a failing supplier is simply omitted.
 */
export async function shopRates(input: {
  readonly hotelId: string;
  readonly stay: StayQuery;
}): Promise<RateShoppingResult> {
  const [connections, mappings] = await Promise.all([
    getHotelSupplierConnections(input.hotelId),
    getRoomSupplierMappings(input.hotelId),
  ]);

  const connectors = getSupplierConnectors();
  const priorityBySupplier = new Map<Supplier, number>();
  for (const c of connections) priorityBySupplier.set(c.supplier, c.priority);

  const searchable = connections.filter((c) => {
    const connector = connectors.get(c.supplier);
    return connector !== undefined && connector.capabilities.search;
  });

  const hasConciergeOnlySupplier = connections.some((c) => {
    const connector = connectors.get(c.supplier);
    return connector !== undefined && !connector.capabilities.search;
  });

  const settled = await Promise.allSettled(
    searchable.map(async (c) => {
      const connector = connectors.get(c.supplier);
      if (connector === undefined) return [] as readonly NormalizedRate[];
      const res = await connector.searchAvailability({
        propertyKey: c.propertyKey,
        stay: input.stay,
      });
      return res.ok ? res.value : ([] as readonly NormalizedRate[]);
    }),
  );

  const allRates: NormalizedRate[] = [];
  const suppliersQueried = new Set<Supplier>();
  settled.forEach((outcome, idx) => {
    if (outcome.status !== 'fulfilled') return;
    const supplier = searchable[idx]?.supplier;
    if (outcome.value.length > 0 && supplier !== undefined) suppliersQueried.add(supplier);
    allRates.push(...outcome.value);
  });

  const giataIndex = await resolveGiataRtmLabelIndex(input.hotelId, allRates);

  // Group by editorial mapping, else GIATA RTM group, else per-supplier label.
  const groups = new Map<
    string,
    { label: string; canonicalRoomId: string | null; rates: AggregatedRate[] }
  >();
  for (const rate of allRates) {
    const canonicalRoomId = resolveCanonicalRoomId(rate, mappings);
    const key = groupKeyForRate(rate, canonicalRoomId, giataIndex);
    const label = displayLabelForRate(rate, canonicalRoomId, giataIndex);
    const aggregated: AggregatedRate = {
      ...rate,
      priority: priorityBySupplier.get(rate.supplier) ?? 100,
    };
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { label, canonicalRoomId, rates: [aggregated] });
    } else {
      existing.rates.push(aggregated);
    }
  }

  const rooms: AggregatedRoom[] = [];
  for (const group of groups.values()) {
    const sorted = [...group.rates].sort((a, b) => {
      if (a.priceMinor !== b.priceMinor) return a.priceMinor - b.priceMinor;
      return a.priority - b.priority;
    });
    const best = sorted[0];
    if (best === undefined) continue;
    rooms.push({
      canonicalRoomId: group.canonicalRoomId,
      label: group.label,
      best,
      all: sorted,
    });
  }

  // Cheapest room first; mapped rooms before unmapped on price ties.
  rooms.sort((a, b) => {
    if (a.best.priceMinor !== b.best.priceMinor) return a.best.priceMinor - b.best.priceMinor;
    const aMapped = a.canonicalRoomId !== null ? 0 : 1;
    const bMapped = b.canonicalRoomId !== null ? 0 : 1;
    return aMapped - bMapped;
  });

  return {
    rooms,
    suppliersQueried: [...suppliersQueried],
    hasConciergeOnlySupplier,
  };
}
