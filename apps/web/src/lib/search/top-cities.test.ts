import { describe, expect, it } from 'vitest';

import { getTopSearchCities, TOP_SEARCH_CITY_COUNT } from './top-cities';

describe('getTopSearchCities', () => {
  it('returns five city destinations', () => {
    expect(getTopSearchCities('fr')).toHaveLength(TOP_SEARCH_CITY_COUNT);
    expect(getTopSearchCities('fr').every((d) => d.type === 'city')).toBe(true);
  });

  it('localises labels', () => {
    const fr = getTopSearchCities('fr');
    const en = getTopSearchCities('en');
    expect(fr[0]?.label).toBe('Paris');
    expect(en[0]?.label).toBe('Paris');
    expect(fr[4]?.label).toBe('Dubaï');
    expect(en[4]?.label).toBe('Dubai');
  });

  it('uses stable slugs as ids', () => {
    expect(getTopSearchCities('fr').map((d) => d.id)).toEqual([
      'paris',
      'cannes',
      'new-york',
      'marrakech',
      'dubai',
    ]);
  });
});
