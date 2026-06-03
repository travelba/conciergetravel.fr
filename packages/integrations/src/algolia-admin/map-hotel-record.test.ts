import { describe, expect, it } from 'vitest';

import { buildHotelAlgoliaRecord } from './map-hotel-record';
import type { HotelSourceRow } from './types';

const baseRow: HotelSourceRow = {
  id: '8b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b',
  slug: 'hotel-test',
  slug_en: 'hotel-test-en',
  name: 'Hôtel Test',
  name_en: 'Hotel Test',
  city: 'Paris',
  district: null,
  region: 'Île-de-France',
  country_code: 'FR',
  country_label_fr: 'France',
  country_label_en: 'France',
  is_palace: true,
  stars: 5,
  amenities: [{ label: 'Spa' }, 'Piscine'],
  highlights: ['Art déco', 'Rooftop'],
  description_fr: 'Un établissement magnifique ' + 'x'.repeat(300),
  description_en: null,
  is_little_catalog: false,
  priority: 'P0',
  google_rating: '4.8',
  google_reviews_count: 120,
  is_published: true,
};

describe('buildHotelAlgoliaRecord', () => {
  it('builds FR excerpt and maps amenities + themes', () => {
    const r = buildHotelAlgoliaRecord('fr', baseRow);
    expect(r.name).toBe('Hôtel Test');
    expect(r.description_excerpt.endsWith('…')).toBe(true);
    expect(r.description_excerpt.length).toBeLessThanOrEqual(201);
    expect(r.amenities_top).toEqual(['Spa', 'Piscine']);
    expect(r.themes).toEqual(['Art déco', 'Rooftop']);
    expect(r.priority_score).toBe(100);
    expect(r.google_rating).toBe(4.8);
    expect(r.url_path).toBe('/hotel/hotel-test');
  });

  it('prefers EN slug and fallback name', () => {
    const partial: HotelSourceRow = {
      ...baseRow,
      name_en: '',
      slug_en: 'only-en-slug',
    };
    const r = buildHotelAlgoliaRecord('en', partial);
    expect(r.name).toBe('Hôtel Test');
    expect(r.slug).toBe('only-en-slug');
    // url_path is unlocalized — locale prefix is applied at render time.
    expect(r.url_path).toBe('/hotel/only-en-slug');
  });

  it('drops empty optional district field', () => {
    const r = buildHotelAlgoliaRecord('fr', baseRow);
    expect('district' in r ? r.district : undefined).toBeUndefined();
  });

  it('includes district when set', () => {
    const withDistrict: HotelSourceRow = { ...baseRow, district: '8ᵉ arr.' };
    const r = buildHotelAlgoliaRecord('fr', withDistrict);
    expect(r.district).toBe('8ᵉ arr.');
  });

  it('maps country_code + localized country name (searchable by country)', () => {
    const intl: HotelSourceRow = {
      ...baseRow,
      city: 'Tokyo',
      region: '',
      country_code: 'JP',
      country_label_fr: 'Japon',
      country_label_en: 'Japan',
    };
    const fr = buildHotelAlgoliaRecord('fr', intl);
    expect(fr.country_code).toBe('JP');
    expect(fr.country).toBe('Japon');
    const en = buildHotelAlgoliaRecord('en', intl);
    expect(en.country).toBe('Japan');
  });

  it('omits country name when both labels are null but keeps the code', () => {
    const noLabels: HotelSourceRow = {
      ...baseRow,
      country_code: 'JP',
      country_label_fr: null,
      country_label_en: null,
    };
    const r = buildHotelAlgoliaRecord('fr', noLabels);
    expect(r.country_code).toBe('JP');
    expect('country' in r ? r.country : undefined).toBeUndefined();
  });
});
