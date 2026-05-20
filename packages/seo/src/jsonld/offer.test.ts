import { describe, expect, it } from 'vitest';

import { offerJsonLd } from './offer';

describe('offerJsonLd', () => {
  it('emits a minimal valid Offer with EUR currency and InStock by default', () => {
    const node = offerJsonLd({ priceFromEUR: 1450, url: 'https://example.com/hotel' });
    expect(node['@type']).toBe('Offer');
    expect(node.priceCurrency).toBe('EUR');
    expect(node.price).toBe(1450);
    expect(node.availability).toBe('https://schema.org/InStock');
    expect(node.url).toBe('https://example.com/hotel');
  });

  it('rounds prices to 2 decimals (avoids the 0.1+0.2 trap)', () => {
    const node = offerJsonLd({ priceFromEUR: 0.1 + 0.2, url: 'https://example.com/h' });
    expect(node.price).toBe(0.3);
  });

  it('forwards priceValidUntil when provided (CDC §2.8 — Offer expiry mandatory)', () => {
    const node = offerJsonLd({
      priceFromEUR: 1450,
      url: 'https://example.com/hotel',
      priceValidUntil: '2026-12-31',
    });
    expect(node.priceValidUntil).toBe('2026-12-31');
  });

  it('omits priceValidUntil when not provided (legacy callers)', () => {
    const node = offerJsonLd({ priceFromEUR: 1450, url: 'https://example.com/hotel' });
    expect('priceValidUntil' in node).toBe(false);
  });

  it('supports the LimitedAvailability availability IRI (C3 — DSA-grounded)', () => {
    const node = offerJsonLd({
      priceFromEUR: 1450,
      url: 'https://example.com/hotel',
      availability: 'LimitedAvailability',
    });
    expect(node.availability).toBe('https://schema.org/LimitedAvailability');
  });

  it('forwards validFrom alongside priceValidUntil', () => {
    const node = offerJsonLd({
      priceFromEUR: 1450,
      url: 'https://example.com/hotel',
      validFrom: '2026-06-01',
      priceValidUntil: '2026-12-31',
    });
    expect(node.validFrom).toBe('2026-06-01');
    expect(node.priceValidUntil).toBe('2026-12-31');
  });
});
