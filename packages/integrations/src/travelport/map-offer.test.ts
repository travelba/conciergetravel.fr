import { describe, expect, it } from 'vitest';

import { travelportOfferToDomain } from './map-offer';
import type { PropertyItem } from './types';

const baseInput = {
  hotelId: 'htl-bristol',
  checkIn: '2026-07-01',
  checkOut: '2026-07-02',
  adults: 2,
  children: 0,
  expiresAt: '2026-07-01T10:00:00.000Z',
};

function item(rate: PropertyItem['lowestPublicAvailableRate']): PropertyItem {
  return {
    name: 'Le Bristol Paris',
    chainCode: 'OK',
    propertyCode: '12345',
    lowestPublicAvailableRate: rate,
  };
}

describe('travelportOfferToDomain', () => {
  it('mappe totalPrice.amount + currencyCode en MoneyAmount EUR (minor units)', () => {
    const res = travelportOfferToDomain({
      ...baseInput,
      item: item({
        rateKey: { value: 'RK-1' },
        totalPrice: { amount: 1500.5 },
        currencyCode: 'EUR',
        terms: {
          refundable: true,
          cancelPenalties: [{ cancelShortDescription: 'Annulation gratuite jusqu’au 25/06.' }],
        },
      }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.id).toBe('RK-1');
    expect(res.value.provider).toBe('travelport');
    expect(res.value.totalPrice).toEqual({ amountMinor: 150050, currency: 'EUR' });
    expect(res.value.cancellationPolicyText).toContain('Annulation gratuite');
  });

  it('retombe sur l’ancienne forme total.{amount,currency}', () => {
    const res = travelportOfferToDomain({
      ...baseInput,
      item: item({ rateKey: { value: 'RK-2' }, total: { amount: 200, currency: 'EUR' } }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.totalPrice.amountMinor).toBe(20000);
  });

  it('renseigne « Non remboursable. » quand refundable=false sans pénalité', () => {
    const res = travelportOfferToDomain({
      ...baseInput,
      item: item({
        rateKey: { value: 'RK-3' },
        totalPrice: { amount: 100 },
        currencyCode: 'EUR',
        terms: { refundable: false },
      }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.cancellationPolicyText).toBe('Non remboursable.');
  });

  it('erreur offer_not_available si rateKey absent', () => {
    const res = travelportOfferToDomain({
      ...baseInput,
      item: item({ totalPrice: { amount: 100 }, currencyCode: 'EUR' }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('offer_not_available');
  });

  it('erreur mapping_failure pour une devise non EUR', () => {
    const res = travelportOfferToDomain({
      ...baseInput,
      item: item({ rateKey: { value: 'RK-4' }, totalPrice: { amount: 100 }, currencyCode: 'GBP' }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('mapping_failure');
  });
});
