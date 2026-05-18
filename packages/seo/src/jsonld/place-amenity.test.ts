import { describe, expect, it } from 'vitest';

import {
  buildOpeningHoursSpecification,
  normalisePriceRange,
  osmToSchemaClass,
  osmToSchemaUrl,
} from './place-amenity';

describe('osmToSchemaClass', () => {
  it('maps heritage tags to LandmarksOrHistoricalBuildings', () => {
    expect(osmToSchemaClass('monument')).toBe('LandmarksOrHistoricalBuildings');
    expect(osmToSchemaClass('castle')).toBe('LandmarksOrHistoricalBuildings');
    expect(osmToSchemaClass('chateau')).toBe('LandmarksOrHistoricalBuildings');
  });

  it('maps museum-family tags to Museum', () => {
    expect(osmToSchemaClass('museum')).toBe('Museum');
    expect(osmToSchemaClass('art_gallery')).toBe('Museum');
    expect(osmToSchemaClass('gallery')).toBe('Museum');
  });

  it('maps utility shops to their narrow Schema.org subtype', () => {
    expect(osmToSchemaClass('pharmacy')).toBe('Pharmacy');
    expect(osmToSchemaClass('bakery')).toBe('BakeryShop');
    expect(osmToSchemaClass('supermarket')).toBe('GroceryStore');
    expect(osmToSchemaClass('convenience')).toBe('ConvenienceStore');
    expect(osmToSchemaClass('atm')).toBe('AutomatedTeller');
    expect(osmToSchemaClass('bank')).toBe('BankOrCreditUnion');
    expect(osmToSchemaClass('post_office')).toBe('PostOffice');
  });

  it('maps F&B tags to Restaurant / CafeOrCoffeeShop / BarOrPub', () => {
    expect(osmToSchemaClass('restaurant')).toBe('Restaurant');
    expect(osmToSchemaClass('cafe')).toBe('CafeOrCoffeeShop');
    expect(osmToSchemaClass('bar')).toBe('BarOrPub');
    expect(osmToSchemaClass('winery')).toBe('Winery');
  });

  it('maps worship venues to PlaceOfWorship', () => {
    expect(osmToSchemaClass('church')).toBe('PlaceOfWorship');
    expect(osmToSchemaClass('cathedral')).toBe('PlaceOfWorship');
    expect(osmToSchemaClass('synagogue')).toBe('PlaceOfWorship');
    expect(osmToSchemaClass('mosque')).toBe('PlaceOfWorship');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(osmToSchemaClass('  PHARMACY  ')).toBe('Pharmacy');
    expect(osmToSchemaClass('Museum')).toBe('Museum');
  });

  it('falls back to TouristAttraction for unknown / null / empty input', () => {
    expect(osmToSchemaClass('something_random')).toBe('TouristAttraction');
    expect(osmToSchemaClass(null)).toBe('TouristAttraction');
    expect(osmToSchemaClass(undefined)).toBe('TouristAttraction');
    expect(osmToSchemaClass('')).toBe('TouristAttraction');
  });
});

describe('osmToSchemaUrl', () => {
  it('returns the full Schema.org URL form', () => {
    expect(osmToSchemaUrl('pharmacy')).toBe('https://schema.org/Pharmacy');
    expect(osmToSchemaUrl('museum')).toBe('https://schema.org/Museum');
    expect(osmToSchemaUrl('foo')).toBe('https://schema.org/TouristAttraction');
  });
});

describe('buildOpeningHoursSpecification', () => {
  it('expands 24/7 to all weekdays open 00:00-23:59', () => {
    const spec = buildOpeningHoursSpecification('24/7');
    expect(spec).toHaveLength(1);
    expect(spec[0]?.opens).toBe('00:00');
    expect(spec[0]?.closes).toBe('23:59');
    expect(spec[0]?.dayOfWeek).toHaveLength(7);
    expect(spec[0]?.dayOfWeek[0]).toBe('https://schema.org/Monday');
    expect(spec[0]?.dayOfWeek[6]).toBe('https://schema.org/Sunday');
  });

  it('parses a simple weekday range', () => {
    const spec = buildOpeningHoursSpecification('Mo-Fr 09:00-19:00');
    expect(spec).toHaveLength(1);
    expect(spec[0]?.opens).toBe('09:00');
    expect(spec[0]?.closes).toBe('19:00');
    expect(spec[0]?.dayOfWeek).toEqual([
      'https://schema.org/Monday',
      'https://schema.org/Tuesday',
      'https://schema.org/Wednesday',
      'https://schema.org/Thursday',
      'https://schema.org/Friday',
    ]);
  });

  it('handles an explicit Su closed rule', () => {
    const spec = buildOpeningHoursSpecification('Mo-Sa 08:00-20:00; Su closed');
    expect(spec).toHaveLength(1);
    expect(spec[0]?.dayOfWeek).toHaveLength(6);
    expect(spec[0]?.dayOfWeek).not.toContain('https://schema.org/Sunday');
  });

  it('splits a lunch break into two specs sharing the same dayOfWeek set', () => {
    const spec = buildOpeningHoursSpecification('Mo-Fr 09:00-12:00, 14:00-19:00');
    expect(spec).toHaveLength(2);
    // Both specs cover the same 5 weekdays.
    expect(spec[0]?.dayOfWeek).toHaveLength(5);
    expect(spec[1]?.dayOfWeek).toHaveLength(5);
    const morning = spec.find((s) => s.opens === '09:00');
    const afternoon = spec.find((s) => s.opens === '14:00');
    expect(morning?.closes).toBe('12:00');
    expect(afternoon?.closes).toBe('19:00');
  });

  it('normalises single-digit hours into HH:MM', () => {
    const spec = buildOpeningHoursSpecification('Mo-Su 8:00-22:00');
    expect(spec[0]?.opens).toBe('08:00');
    expect(spec[0]?.closes).toBe('22:00');
  });

  it('groups days with identical intervals into a single spec', () => {
    const spec = buildOpeningHoursSpecification('Mo 09:00-19:00; Tu 09:00-19:00; We 09:00-19:00');
    expect(spec).toHaveLength(1);
    expect(spec[0]?.dayOfWeek).toHaveLength(3);
  });

  it('returns [] on empty / null / whitespace / garbage', () => {
    expect(buildOpeningHoursSpecification(null)).toEqual([]);
    expect(buildOpeningHoursSpecification(undefined)).toEqual([]);
    expect(buildOpeningHoursSpecification('')).toEqual([]);
    expect(buildOpeningHoursSpecification('   ')).toEqual([]);
    expect(buildOpeningHoursSpecification('PH off; sunset+30')).toEqual([]);
  });

  it('drops invalid intervals (opens >= closes)', () => {
    expect(buildOpeningHoursSpecification('Mo-Fr 19:00-09:00')).toEqual([]);
    expect(buildOpeningHoursSpecification('Mo-Fr 09:00-09:00')).toEqual([]);
  });
});

describe('normalisePriceRange', () => {
  it('trims and returns short strings', () => {
    expect(normalisePriceRange('  €€  ')).toBe('€€');
    expect(normalisePriceRange('€10-€20')).toBe('€10-€20');
    expect(normalisePriceRange('À partir de 12 €')).toBe('À partir de 12 €');
  });

  it('returns null for empty / null / overflow', () => {
    expect(normalisePriceRange(null)).toBeNull();
    expect(normalisePriceRange(undefined)).toBeNull();
    expect(normalisePriceRange('')).toBeNull();
    expect(normalisePriceRange('   ')).toBeNull();
    expect(normalisePriceRange('x'.repeat(40))).toBeNull();
  });
});
