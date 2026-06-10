import { describe, expect, it } from 'vitest';

import {
  buildHotelSeoTitle,
  normalizeHotelImageAltFr,
  pickHotelJsonLdFaqEntries,
  resolveHotelTitleLocation,
} from './hotel-page-seo';

describe('pickHotelJsonLdFaqEntries', () => {
  it('caps FAQ JSON-LD at 20 entries by default', () => {
    const entries = Array.from({ length: 77 }, (_, i) => ({
      question: `Q${i}`,
      answer: `A${i}`,
    }));
    expect(pickHotelJsonLdFaqEntries(entries)).toHaveLength(20);
    expect(pickHotelJsonLdFaqEntries(entries)[0]?.question).toBe('Q0');
  });
});

describe('resolveHotelTitleLocation', () => {
  it('uses region when the name already contains the city', () => {
    expect(
      resolveHotelTitleLocation({
        name: 'Airelles Gordes, La Bastide',
        city: 'Gordes',
        district: '',
        region: 'Luberon',
      }),
    ).toBe('Luberon');
  });

  it('keeps the city when it is not in the name', () => {
    expect(
      resolveHotelTitleLocation({
        name: 'Le Bristol',
        city: 'Paris',
        district: '',
        region: 'Île-de-France',
      }),
    ).toBe('Paris');
  });
});

describe('buildHotelSeoTitle', () => {
  it('avoids repeating Gordes in the FR title', () => {
    const title = buildHotelSeoTitle({
      name: 'Airelles Gordes, La Bastide',
      city: 'Gordes',
      district: '',
      region: 'Luberon',
      isPalace: true,
      stars: 5,
      locale: 'fr',
    });
    expect(title).toBe('Airelles Gordes, La Bastide — Palace Luberon | MyConciergeHotel');
    expect(title.match(/Gordes/giu)?.length).toBe(1);
  });
});

describe('normalizeHotelImageAltFr', () => {
  it('replaces Deluxe Valley with Deluxe Vallée in FR alts', () => {
    expect(
      normalizeHotelImageAltFr(
        'Chambre Deluxe Valley de l’Airelles Gordes, vue sur la vallée du Luberon',
      ),
    ).toContain('Deluxe Vallée');
    expect(normalizeHotelImageAltFr('Chambre Deluxe Valley')).not.toMatch(/Deluxe Valley/i);
  });
});
