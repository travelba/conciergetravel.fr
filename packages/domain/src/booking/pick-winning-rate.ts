/**
 * Pure rate-shopping reduction — cheapest EUR minor wins; supplier priority
 * breaks ties (lower `priority` = preferred, e.g. Little Emperors = 10).
 */

export interface ComparableRate {
  readonly priceMinor: number;
  readonly priority: number;
}

export function compareRatesByPriceThenPriority(a: ComparableRate, b: ComparableRate): number {
  if (a.priceMinor !== b.priceMinor) return a.priceMinor - b.priceMinor;
  return a.priority - b.priority;
}

/** Pick the single cheapest rate from a flat list. */
export function pickCheapestRate<T extends ComparableRate>(rates: readonly T[]): T | null {
  if (rates.length === 0) return null;
  const first = rates[0];
  if (first === undefined) return null;
  let best: T = first;
  for (let i = 1; i < rates.length; i += 1) {
    const candidate = rates[i];
    if (candidate === undefined) continue;
    if (compareRatesByPriceThenPriority(candidate, best) < 0) {
      best = candidate;
    }
  }
  return best;
}

export interface RoomWithBestRate<T extends ComparableRate> {
  readonly best: T;
}

/**
 * Global "from" price for the fiche rail — minimum across all aggregated rooms.
 */
export function pickGlobalBestRate<T extends ComparableRate>(
  rooms: readonly RoomWithBestRate<T>[],
): T | null {
  const bests = rooms.map((r) => r.best);
  return pickCheapestRate(bests);
}
