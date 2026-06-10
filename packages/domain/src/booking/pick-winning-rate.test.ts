import { describe, expect, it } from 'vitest';

import { pickCheapestRate, pickGlobalBestRate } from './pick-winning-rate';

describe('pickCheapestRate', () => {
  it('picks the lowest priceMinor', () => {
    const rates = [
      { priceMinor: 50_000, priority: 100 },
      { priceMinor: 42_000, priority: 100 },
      { priceMinor: 48_000, priority: 10 },
    ];
    expect(pickCheapestRate(rates)?.priceMinor).toBe(42_000);
  });

  it('breaks price ties with lower priority (LE wins)', () => {
    const rates = [
      { priceMinor: 50_000, priority: 100 },
      { priceMinor: 50_000, priority: 10 },
    ];
    expect(pickCheapestRate(rates)?.priority).toBe(10);
  });
});

describe('pickGlobalBestRate', () => {
  it('returns the cheapest room best rate', () => {
    const global = pickGlobalBestRate([
      { best: { priceMinor: 90_000, priority: 100 } },
      { best: { priceMinor: 75_000, priority: 100 } },
    ]);
    expect(global?.priceMinor).toBe(75_000);
  });
});
