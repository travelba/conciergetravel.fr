import 'server-only';

import type { StayQuery, Supplier } from '@mch/integrations/supplier';

import { env } from '@/lib/env';
import { shopRates } from '@/server/booking/rate-shopping';

/**
 * Thin fiche/tunnel adapter over the rate-shopping orchestrator (Phase 3/4).
 *
 * Produces a deterministic `roomId -> best EUR price` map (and the winning
 * supplier) that the hotel fiche prefers over the legacy fuzzy Travelport
 * overlay. Returns empty maps when:
 *   - the kill-switch `MULTI_SUPPLIER_RATESHOPPING_ENABLED` is off (default), or
 *   - the hotel has no supplier connections seeded (orchestrator returns none).
 *
 * In both cases the fiche behaviour is unchanged — this is strictly additive.
 */
export interface AggregatedRoomPrices {
  readonly fromByRoomId: ReadonlyMap<string, number>;
  readonly winningSupplierByRoomId: ReadonlyMap<string, Supplier>;
  readonly hasConciergeOnlySupplier: boolean;
}

const EMPTY: AggregatedRoomPrices = {
  fromByRoomId: new Map(),
  winningSupplierByRoomId: new Map(),
  hasConciergeOnlySupplier: false,
};

export async function getAggregatedRoomPrices(input: {
  readonly hotelId: string;
  readonly stay: StayQuery;
}): Promise<AggregatedRoomPrices> {
  if (env.MULTI_SUPPLIER_RATESHOPPING_ENABLED !== true) return EMPTY;

  const result = await shopRates({ hotelId: input.hotelId, stay: input.stay });

  const fromByRoomId = new Map<string, number>();
  const winningSupplierByRoomId = new Map<string, Supplier>();
  for (const room of result.rooms) {
    if (room.canonicalRoomId === null) continue;
    fromByRoomId.set(room.canonicalRoomId, room.best.priceMinor);
    winningSupplierByRoomId.set(room.canonicalRoomId, room.best.supplier);
  }

  return {
    fromByRoomId,
    winningSupplierByRoomId,
    hasConciergeOnlySupplier: result.hasConciergeOnlySupplier,
  };
}
