import { describe, expect, it } from 'vitest';

import { buildEventListJsonLd, eventJsonLd } from './event';

const BASE_INPUT = {
  name: 'Exposition « Matisse en majesté »',
  category: 'expo' as const,
  startDate: '2026-06-12',
  endDate: '2026-09-15',
  venueName: 'Musée du Luxembourg',
  venueAddress: '19 Rue de Vaugirard, Paris',
  latitude: 48.8485,
  longitude: 2.3344,
};

describe('eventJsonLd', () => {
  it('maps category to Schema.org subtype', () => {
    expect(eventJsonLd({ ...BASE_INPUT, category: 'concert' })['@type']).toBe('MusicEvent');
    expect(eventJsonLd({ ...BASE_INPUT, category: 'expo' })['@type']).toBe('ExhibitionEvent');
    expect(eventJsonLd({ ...BASE_INPUT, category: 'festival' })['@type']).toBe('Festival');
    expect(eventJsonLd({ ...BASE_INPUT, category: 'sport' })['@type']).toBe('SportsEvent');
    expect(eventJsonLd({ ...BASE_INPUT, category: 'theater' })['@type']).toBe('TheaterEvent');
    expect(eventJsonLd({ ...BASE_INPUT, category: 'other' })['@type']).toBe('Event');
  });

  it('emits required Google rich-result fields', () => {
    const node = eventJsonLd(BASE_INPUT) as Record<string, unknown>;
    expect(node.name).toBe(BASE_INPUT.name);
    expect(node.startDate).toBe('2026-06-12');
    expect(node.endDate).toBe('2026-09-15');
    expect(node.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(node.eventStatus).toBe('https://schema.org/EventScheduled');
    const loc = node.location as Record<string, unknown>;
    expect(loc['@type']).toBe('Place');
    expect(loc.name).toBe('Musée du Luxembourg');
    const geo = loc.geo as Record<string, unknown>;
    expect(geo['@type']).toBe('GeoCoordinates');
    expect(geo.latitude).toBe(48.8485);
  });

  it('omits endDate when missing (single-day event)', () => {
    const node = eventJsonLd({ ...BASE_INPUT, endDate: undefined }) as Record<string, unknown>;
    expect(node.endDate).toBeUndefined();
  });

  it('truncates description at 280 chars', () => {
    const long = 'a'.repeat(500);
    const node = eventJsonLd({ ...BASE_INPUT, description: long }) as Record<string, unknown>;
    expect(typeof node.description).toBe('string');
    expect((node.description as string).length).toBeLessThanOrEqual(280);
    expect((node.description as string).endsWith('…')).toBe(true);
  });

  it('omits offers entirely when pricing is not provided', () => {
    const node = eventJsonLd(BASE_INPUT) as Record<string, unknown>;
    expect(node.offers).toBeUndefined();
  });

  it('emits a free Offer with price=0 and priceValidUntil', () => {
    const node = eventJsonLd({
      ...BASE_INPUT,
      pricing: { type: 'free', amountEur: null },
    }) as Record<string, unknown>;
    const offer = node.offers as Record<string, unknown>;
    expect(offer['@type']).toBe('Offer');
    expect(offer.price).toBe('0');
    expect(offer.priceCurrency).toBe('EUR');
    expect(offer.priceValidUntil).toBe('2026-09-15');
  });

  it('emits a paid Offer with amountEur as string', () => {
    const node = eventJsonLd({
      ...BASE_INPUT,
      pricing: { type: 'paid', amountEur: 18 },
    }) as Record<string, unknown>;
    const offer = node.offers as Record<string, unknown>;
    expect(offer.price).toBe('18');
  });

  it('uses startDate as priceValidUntil for single-day paid events', () => {
    const node = eventJsonLd({
      ...BASE_INPUT,
      endDate: undefined,
      pricing: { type: 'paid', amountEur: 25 },
    }) as Record<string, unknown>;
    const offer = node.offers as Record<string, unknown>;
    expect(offer.priceValidUntil).toBe('2026-06-12');
  });

  it('omits PostalAddress when venueAddress is null', () => {
    const node = eventJsonLd({ ...BASE_INPUT, venueAddress: null }) as Record<string, unknown>;
    const loc = node.location as Record<string, unknown>;
    expect(loc.address).toBeUndefined();
  });

  it('falls back to event name when venueName is null', () => {
    const node = eventJsonLd({
      ...BASE_INPUT,
      venueName: null,
      venueAddress: null,
    }) as Record<string, unknown>;
    const loc = node.location as Record<string, unknown>;
    expect(loc.name).toBe(BASE_INPUT.name);
  });

  it('emits sameAs when DT URI is provided', () => {
    const node = eventJsonLd({
      ...BASE_INPUT,
      sameAs: 'https://data.datatourisme.fr/123/abc',
    }) as Record<string, unknown>;
    expect(node.sameAs).toBe('https://data.datatourisme.fr/123/abc');
  });
});

describe('buildEventListJsonLd', () => {
  it('returns one Event node per input event', () => {
    const list = buildEventListJsonLd([
      { ...BASE_INPUT, name: 'A' },
      { ...BASE_INPUT, name: 'B', category: 'concert' as const },
    ]);
    expect(list).toHaveLength(2);
    expect((list[0] as Record<string, unknown>).name).toBe('A');
    expect((list[1] as Record<string, unknown>)['@type']).toBe('MusicEvent');
  });
});
