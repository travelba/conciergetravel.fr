import { describe, expect, it } from 'vitest';

import {
  buildDirectoryFacets,
  emptyDirectorySelection,
  isEmptySelection,
  matchesDirectoryFilters,
  type DirectoryFacetSource,
  type DirectorySelection,
} from './filter-logic';

function source(overrides: Partial<DirectoryFacetSource> = {}): DirectoryFacetSource {
  return {
    stars: 5,
    isPalace: false,
    brand: null,
    district: null,
    city: 'Paris',
    ...overrides,
  };
}

describe('buildDirectoryFacets', () => {
  const hotels: DirectoryFacetSource[] = [
    source({
      stars: 5,
      isPalace: true,
      brand: { slug: 'aman', label: 'Aman' },
      district: 'Le Marais',
    }),
    source({
      stars: 5,
      isPalace: false,
      brand: { slug: 'aman', label: 'Aman' },
      district: 'Le Marais',
    }),
    source({ stars: 4, isPalace: false, brand: null, district: 'Montmartre' }),
    source({
      stars: 4,
      isPalace: false,
      brand: { slug: 'four-seasons', label: 'Four Seasons' },
      district: null,
    }),
  ];

  it('lists distinct stars in descending order', () => {
    expect(buildDirectoryFacets(hotels, 'district').stars).toEqual([5, 4]);
  });

  it('counts palaces', () => {
    expect(buildDirectoryFacets(hotels, 'district').palaceCount).toBe(1);
  });

  it('aggregates brands by frequency then label', () => {
    const { brands } = buildDirectoryFacets(hotels, 'district');
    expect(brands).toEqual([
      { value: 'aman', label: 'Aman', count: 2 },
      { value: 'four-seasons', label: 'Four Seasons', count: 1 },
    ]);
  });

  it('builds the place facet from district and skips empty values', () => {
    const { places } = buildDirectoryFacets(hotels, 'district');
    expect(places).toEqual([
      { value: 'Le Marais', label: 'Le Marais', count: 2 },
      { value: 'Montmartre', label: 'Montmartre', count: 1 },
    ]);
  });

  it('builds the place facet from city when placeKey=city', () => {
    const mixed = [source({ city: 'Paris' }), source({ city: 'Paris' }), source({ city: 'Nice' })];
    expect(buildDirectoryFacets(mixed, 'city').places).toEqual([
      { value: 'Paris', label: 'Paris', count: 2 },
      { value: 'Nice', label: 'Nice', count: 1 },
    ]);
  });
});

describe('matchesDirectoryFilters', () => {
  const subject = { stars: 5, isPalace: true, brandSlug: 'aman', place: 'Le Marais' };

  it('passes everything on an empty selection', () => {
    expect(matchesDirectoryFilters(subject, emptyDirectorySelection())).toBe(true);
  });

  it('filters by star rating (OR within the group)', () => {
    expect(matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), stars: [5] })).toBe(
      true,
    );
    expect(matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), stars: [4] })).toBe(
      false,
    );
    expect(matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), stars: [4, 5] })).toBe(
      true,
    );
  });

  it('filters by palace', () => {
    expect(matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), palace: true })).toBe(
      true,
    );
    expect(
      matchesDirectoryFilters(
        { ...subject, isPalace: false },
        { ...emptyDirectorySelection(), palace: true },
      ),
    ).toBe(false);
  });

  it('filters by brand and rejects hotels without a brand', () => {
    expect(
      matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), brands: ['aman'] }),
    ).toBe(true);
    expect(
      matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), brands: ['rosewood'] }),
    ).toBe(false);
    expect(
      matchesDirectoryFilters(
        { ...subject, brandSlug: null },
        { ...emptyDirectorySelection(), brands: ['aman'] },
      ),
    ).toBe(false);
  });

  it('filters by place', () => {
    expect(
      matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), places: ['Le Marais'] }),
    ).toBe(true);
    expect(
      matchesDirectoryFilters(subject, { ...emptyDirectorySelection(), places: ['Montmartre'] }),
    ).toBe(false);
  });

  it('combines groups with AND', () => {
    const sel: DirectorySelection = {
      stars: [5],
      palace: true,
      brands: ['aman'],
      places: ['Le Marais'],
    };
    expect(matchesDirectoryFilters(subject, sel)).toBe(true);
    expect(matchesDirectoryFilters({ ...subject, stars: 4 }, sel)).toBe(false);
  });
});

describe('isEmptySelection', () => {
  it('is true for a fresh selection and false once a group is set', () => {
    expect(isEmptySelection(emptyDirectorySelection())).toBe(true);
    expect(isEmptySelection({ ...emptyDirectorySelection(), stars: [5] })).toBe(false);
  });
});
