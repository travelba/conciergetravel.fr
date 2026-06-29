import { describe, expect, it } from 'vitest';

import { DEFAULT_OG_IMAGE } from './og-defaults';
import {
  buildDefaultOgImageUrl,
  buildHotelSeoTitle,
  normalizeHotelImageAltFr,
  pickHotelJsonLdFaqEntries,
  resolveHotelOgImages,
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

describe('resolveHotelOgImages — fallback chain', () => {
  const cloudName = 'demo-cloud';
  const origin = 'https://myconciergehotel.com';

  it('uses the hero photo when present (tier 1)', () => {
    const [img] = resolveHotelOgImages({
      cloudName,
      heroPublicId: 'cct/hotels/le-bristol/hero',
      fallbackGalleryPublicId: 'cct/hotels/le-bristol/gallery-1',
      alt: 'Le Bristol Paris',
      origin,
    });
    expect(img?.url).toContain('cct/hotels/le-bristol/hero');
    expect(img?.url).toContain('w_1200');
    expect(img?.url).toContain('h_630');
    expect(img?.width).toBe(1200);
    expect(img?.height).toBe(630);
    expect(img?.type).toBe('image/jpeg');
  });

  it('falls back to the first gallery photo when no hero (tier 2)', () => {
    const [img] = resolveHotelOgImages({
      cloudName,
      heroPublicId: null,
      fallbackGalleryPublicId: 'cct/hotels/x/gallery-1',
      alt: 'Hotel X',
      origin,
    });
    expect(img?.url).toContain('cct/hotels/x/gallery-1');
  });

  it('falls back to the brand card when zero photos (tier 3 — no broken preview)', () => {
    const images = resolveHotelOgImages({
      cloudName,
      heroPublicId: null,
      fallbackGalleryPublicId: null,
      alt: 'Casa Labia',
      origin,
    });
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe(`${origin}${DEFAULT_OG_IMAGE.url}`);
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
    expect(images[0]?.alt).toBe('Casa Labia');
    expect(images[0]?.type).toBe('image/jpeg');
  });

  it('never emits an empty og:image array', () => {
    const images = resolveHotelOgImages({
      cloudName,
      heroPublicId: null,
      fallbackGalleryPublicId: null,
      alt: 'Any hotel',
      origin,
    });
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]?.url.length).toBeGreaterThan(0);
  });
});

describe('buildDefaultOgImageUrl', () => {
  it('returns the absolute brand-card URL', () => {
    expect(buildDefaultOgImageUrl('https://myconciergehotel.com')).toBe(
      'https://myconciergehotel.com/og/default.jpg',
    );
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
