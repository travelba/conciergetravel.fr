/**
 * Pure offer aggregation — merge, dedupe, pick best (Phase 9 / Q43).
 *
 * Operates on normalised `SupplierOffer` rows only; no I/O, no vendor imports.
 */
import { compareRatesByPriceThenPriority, pickCheapestRate } from './pick-winning-rate';
import type { SupplierOffer } from './supplier-offer';

export interface ComparableSupplierOffer {
  readonly offer: SupplierOffer;
  readonly priceMinor: number;
  readonly priority: number;
}

export interface AggregatedRoomOffers {
  readonly roomKey: string;
  readonly label: string;
  readonly best: SupplierOffer;
  readonly all: readonly SupplierOffer[];
}

export interface AggregatedOffersResult {
  /** Input offers after deduplication (cheapest priority wins per dedupe key). */
  readonly deduped: readonly SupplierOffer[];
  /** Global cheapest offer across all rooms / suppliers. */
  readonly best: SupplierOffer | null;
  /** Per-room reduction (grouped by `roomType.key`). */
  readonly byRoom: readonly AggregatedRoomOffers[];
}

const toComparable = (offer: SupplierOffer): ComparableSupplierOffer => ({
  offer,
  priceMinor: offer.totalPriceTtc.amountMinor,
  priority: offer.priority,
});

/** Composite key for duplicate vendor rows (same room plan at same TTC). */
export function supplierOfferDedupeKey(offer: SupplierOffer): string {
  return [
    offer.supplierId,
    offer.roomType.key,
    offer.ratePlanLabel.trim().toLowerCase(),
    String(offer.totalPriceTtc.amountMinor),
    offer.totalPriceTtc.currency,
  ].join('|');
}

/**
 * Collapse duplicate rows. When two offers share a dedupe key, keep the one
 * with the lower `priority` (preferred supplier at equal price).
 */
export function dedupeSupplierOffers(offers: readonly SupplierOffer[]): SupplierOffer[] {
  const winners = new Map<string, SupplierOffer>();
  for (const offer of offers) {
    const key = supplierOfferDedupeKey(offer);
    const existing = winners.get(key);
    if (existing === undefined) {
      winners.set(key, offer);
      continue;
    }
    const cmp = compareRatesByPriceThenPriority(toComparable(offer), toComparable(existing));
    if (cmp < 0) {
      winners.set(key, offer);
    }
  }
  return [...winners.values()];
}

/** Pick the single best offer (lowest TTC, then lowest priority). */
export function pickBestSupplierOffer(offers: readonly SupplierOffer[]): SupplierOffer | null {
  const comparables = offers.map(toComparable);
  const best = pickCheapestRate(comparables);
  return best?.offer ?? null;
}

/** Group offers by canonical room key, cheapest-first within each group. */
export function groupOffersByRoom(offers: readonly SupplierOffer[]): AggregatedRoomOffers[] {
  const buckets = new Map<string, SupplierOffer[]>();
  for (const offer of offers) {
    const list = buckets.get(offer.roomType.key);
    if (list === undefined) {
      buckets.set(offer.roomType.key, [offer]);
    } else {
      list.push(offer);
    }
  }

  const rooms: AggregatedRoomOffers[] = [];
  for (const roomOffers of buckets.values()) {
    const sorted = [...roomOffers].sort((a, b) =>
      compareRatesByPriceThenPriority(toComparable(a), toComparable(b)),
    );
    const best = sorted[0];
    if (best === undefined) continue;
    rooms.push({
      roomKey: best.roomType.key,
      label: best.roomType.label,
      best,
      all: sorted,
    });
  }

  rooms.sort((a, b) => compareRatesByPriceThenPriority(toComparable(a.best), toComparable(b.best)));
  return rooms;
}

/** Full pipeline: dedupe → group by room → global best. */
export function aggregateSupplierOffers(offers: readonly SupplierOffer[]): AggregatedOffersResult {
  const deduped = dedupeSupplierOffers(offers);
  const byRoom = groupOffersByRoom(deduped);
  const best = pickBestSupplierOffer(deduped);
  return { deduped, best, byRoom };
}
