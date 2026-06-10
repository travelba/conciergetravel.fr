import 'server-only';

import { pickGlobalBestRate } from '@mch/domain/booking';
import type { StayQuery } from '@mch/integrations/supplier';

import { shopRates } from '@/server/booking/rate-shopping';

/**
 * Cheapest live supplier rate for the Concierge row (Travelport pilot on
 * `prince-de-galles-paris`, extensible to any hotel with searchable
 * `hotel_supplier_connections`).
 */
export async function fetchConciergePriceMinor(
  hotelId: string,
  stay: StayQuery,
): Promise<number | null> {
  try {
    const shopResult = await shopRates({ hotelId, stay });
    const globalBest = pickGlobalBestRate(shopResult.rooms);
    if (globalBest === null || globalBest.priceMinor <= 0) return null;
    return globalBest.priceMinor;
  } catch {
    return null;
  }
}
