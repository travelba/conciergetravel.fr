import { describe, expect, it } from 'vitest';

import {
  aggregateSupplierOffers,
  dedupeSupplierOffers,
  groupOffersByRoom,
  pickBestSupplierOffer,
  supplierOfferDedupeKey,
} from './aggregate-offers';
import type { SupplierOffer } from './supplier-offer';

const baseOffer = (
  overrides: Partial<SupplierOffer> & Pick<SupplierOffer, 'id'>,
): SupplierOffer => ({
  id: overrides.id,
  supplierId: overrides.supplierId ?? 'ratehawk',
  rateToken: overrides.rateToken ?? `token-${overrides.id}`,
  roomType: overrides.roomType ?? { key: 'deluxe-king', label: 'Deluxe King', maxOccupancy: 2 },
  ratePlanLabel: overrides.ratePlanLabel ?? 'Standard',
  totalPriceTtc: overrides.totalPriceTtc ?? { amountMinor: 50_000, currency: 'EUR' },
  cancellation: overrides.cancellation ?? {
    rawText: 'Non remboursable.',
    policy: null,
    refundable: false,
  },
  priceValidUntil: overrides.priceValidUntil ?? '2026-07-08T12:00:00.000Z',
  priority: overrides.priority ?? 100,
});

describe('supplierOfferDedupeKey', () => {
  it('is stable for equivalent offers', () => {
    const a = baseOffer({ id: 'a' });
    const b = baseOffer({ id: 'b', rateToken: 'other-token' });
    expect(supplierOfferDedupeKey(a)).toBe(supplierOfferDedupeKey(b));
  });
});

describe('dedupeSupplierOffers', () => {
  it('removes duplicate rows at the same price', () => {
    const offers = [
      baseOffer({ id: 'a', priority: 100 }),
      baseOffer({ id: 'b', priority: 10, rateToken: 'preferred' }),
    ];
    const deduped = dedupeSupplierOffers(offers);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.priority).toBe(10);
  });

  it('keeps distinct room types', () => {
    const offers = [
      baseOffer({ id: 'a' }),
      baseOffer({
        id: 'b',
        roomType: { key: 'suite', label: 'Suite', maxOccupancy: 3 },
      }),
    ];
    expect(dedupeSupplierOffers(offers)).toHaveLength(2);
  });
});

describe('pickBestSupplierOffer', () => {
  it('picks the lowest TTC price', () => {
    const offers = [
      baseOffer({ id: 'a', totalPriceTtc: { amountMinor: 55_000, currency: 'EUR' } }),
      baseOffer({ id: 'b', totalPriceTtc: { amountMinor: 42_000, currency: 'EUR' } }),
    ];
    expect(pickBestSupplierOffer(offers)?.id).toBe('b');
  });

  it('breaks price ties with lower priority', () => {
    const offers = [
      baseOffer({ id: 'a', priority: 100 }),
      baseOffer({ id: 'b', supplierId: 'little_emperors', priority: 10 }),
    ];
    expect(pickBestSupplierOffer(offers)?.supplierId).toBe('little_emperors');
  });

  it('returns null for an empty list', () => {
    expect(pickBestSupplierOffer([])).toBeNull();
  });
});

describe('groupOffersByRoom', () => {
  it('groups by room key and sorts cheapest first within each group', () => {
    const groups = groupOffersByRoom([
      baseOffer({ id: 'a', totalPriceTtc: { amountMinor: 60_000, currency: 'EUR' } }),
      baseOffer({ id: 'b', totalPriceTtc: { amountMinor: 45_000, currency: 'EUR' } }),
      baseOffer({
        id: 'c',
        roomType: { key: 'suite', label: 'Suite', maxOccupancy: 2 },
        totalPriceTtc: { amountMinor: 90_000, currency: 'EUR' },
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.best.id).toBe('b');
    expect(groups[0]?.all.map((o) => o.id)).toEqual(['b', 'a']);
  });
});

describe('aggregateSupplierOffers', () => {
  it('merges dedupe, room groups, and global best', () => {
    const result = aggregateSupplierOffers([
      baseOffer({ id: 'dup-a', priority: 100 }),
      baseOffer({ id: 'dup-b', priority: 10 }),
      baseOffer({
        id: 'suite',
        roomType: { key: 'suite', label: 'Suite', maxOccupancy: 2 },
        totalPriceTtc: { amountMinor: 120_000, currency: 'EUR' },
      }),
    ]);
    expect(result.deduped).toHaveLength(2);
    expect(result.best?.priority).toBe(10);
    expect(result.byRoom).toHaveLength(2);
  });
});
