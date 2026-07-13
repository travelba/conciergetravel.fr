import { describe, expect, it } from 'vitest';

import { buildPriceSlotView, formatPriceMinor } from './price-slot.logic';

describe('buildPriceSlotView', () => {
  it('builds a concierge view with the default member teaser (happy path)', () => {
    const result = buildPriceSlotView({ mode: 'concierge' });

    expect(result.ok).toBe(true);
    if (result.ok && result.value.mode === 'concierge') {
      expect(result.value).toEqual({
        mode: 'concierge',
        headline: 'Prix via le Concierge',
        memberTeaser: "Les membres économisent jusqu'à 25 %",
      });
    }
  });

  it('accepts a custom member teaser in concierge mode', () => {
    const result = buildPriceSlotView({
      mode: 'concierge',
      memberTeaser: 'Économisez en devenant membre',
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.value.mode === 'concierge') {
      expect(result.value.memberTeaser).toBe('Économisez en devenant membre');
    }
  });

  it('builds a live view with formatted prices when data is valid', () => {
    const result = buildPriceSlotView({
      mode: 'live',
      publicPriceMinor: 45000,
      currency: 'EUR',
      memberPriceMinor: 40500,
      isMemberAuthenticated: true,
      comparatorEnabled: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.value.mode === 'live') {
      expect(result.value.publicPriceMinor).toBe(45000);
      expect(result.value.memberLocked).toBe(false);
      expect(result.value.comparatorEnabled).toBe(true);
      expect(result.value.publicPriceFormatted).toContain('450');
      expect(result.value.memberPriceFormatted).toContain('405');
    }
  });

  it('rejects live mode when public price is zero or negative (failure path)', () => {
    const zero = buildPriceSlotView({
      mode: 'live',
      publicPriceMinor: 0,
      currency: 'EUR',
      isMemberAuthenticated: false,
    });

    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.error.code).toBe('INVALID_PUBLIC_PRICE');
    }

    const negative = buildPriceSlotView({
      mode: 'live',
      publicPriceMinor: -100,
      currency: 'EUR',
      isMemberAuthenticated: false,
    });

    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.error.message).toMatch(/positive public price/i);
    }
  });

  it('locks member price for unauthenticated users in live mode', () => {
    const result = buildPriceSlotView({
      mode: 'live',
      publicPriceMinor: 32000,
      currency: 'EUR',
      memberPriceMinor: 28800,
      isMemberAuthenticated: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.value.mode === 'live') {
      expect(result.value.memberLocked).toBe(true);
      expect(result.value.memberPriceMinor).toBe(28800);
    }
  });
});

describe('formatPriceMinor', () => {
  it('formats EUR amounts without decimal cents', () => {
    expect(formatPriceMinor(123400, 'EUR')).toMatch(/1[\s\u202f]?234[\s\u202f]?€/);
  });
});
