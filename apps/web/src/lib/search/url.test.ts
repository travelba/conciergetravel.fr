import { describe, expect, it } from 'vitest';

import {
  buildSearchUrl,
  formatIsoDate,
  parseIsoDate,
  parseSearchParams,
  slugifyDestination,
} from './url';

describe('slugifyDestination', () => {
  it('lowercases and strips accents', () => {
    expect(slugifyDestination('Région parisienne')).toBe('region-parisienne');
    expect(slugifyDestination('Paris')).toBe('paris');
  });

  it('collapses non-alphanumerics and trims dashes', () => {
    expect(slugifyDestination('  Saint-Tropez / Var  ')).toBe('saint-tropez-var');
  });
});

describe('formatIsoDate / parseIsoDate', () => {
  it('formats a local date as YYYY-MM-DD without UTC shift', () => {
    expect(formatIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips through parse', () => {
    const parsed = parseIsoDate('2026-06-09');
    expect(parsed).not.toBeNull();
    expect(parsed && formatIsoDate(parsed)).toBe('2026-06-09');
  });

  it('rejects malformed and overflow dates', () => {
    expect(parseIsoDate('2026-6-9')).toBeNull();
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });
});

describe('buildSearchUrl', () => {
  it('builds the canonical Lartisien-style URL', () => {
    const url = buildSearchUrl({
      slug: 'paris',
      searchType: 'city',
      occupancy: { adults: 2, children: 0 },
      from: new Date(2026, 5, 9),
      to: new Date(2026, 5, 12),
      rooms: 1,
    });
    expect(url).toBe(
      '/results/hotels/paris?occ=a02c00&from=2026-06-09&to=2026-06-12&rooms=1&searchType=city&page=1',
    );
  });

  it('keeps the documented param order and defaults page to 1', () => {
    const url = buildSearchUrl({
      slug: 'region-parisienne',
      searchType: 'region',
      occupancy: { adults: 3, children: 2 },
      from: new Date(2026, 0, 1),
      to: new Date(2026, 0, 4),
      rooms: 2,
    });
    const query = url.split('?')[1] ?? '';
    expect(query).toBe('occ=a03c02&from=2026-01-01&to=2026-01-04&rooms=2&searchType=region&page=1');
  });

  it('honours an explicit page', () => {
    const url = buildSearchUrl({
      slug: 'ritz-paris',
      searchType: 'hotel',
      occupancy: { adults: 2, children: 0 },
      from: new Date(2026, 5, 9),
      to: new Date(2026, 5, 10),
      rooms: 1,
      page: 3,
    });
    expect(url).toContain('searchType=hotel');
    expect(url).toContain('page=3');
  });
});

describe('parseSearchParams', () => {
  it('decodes a full query back into structured values', () => {
    const params = new URLSearchParams(
      'occ=a03c02&from=2026-06-09&to=2026-06-12&rooms=2&searchType=region&page=1',
    );
    const parsed = parseSearchParams(params);
    expect(parsed.occupancy).toEqual({ adults: 3, children: 2 });
    expect(parsed.rooms).toBe(2);
    expect(parsed.searchType).toBe('region');
    expect(parsed.page).toBe(1);
    expect(parsed.from && formatIsoDate(parsed.from)).toBe('2026-06-09');
    expect(parsed.to && formatIsoDate(parsed.to)).toBe('2026-06-12');
  });

  it('returns nulls for missing or invalid params', () => {
    const parsed = parseSearchParams(new URLSearchParams('rooms=0&searchType=bogus&occ=nope'));
    expect(parsed.occupancy).toBeNull();
    expect(parsed.rooms).toBeNull();
    expect(parsed.searchType).toBeNull();
    expect(parsed.from).toBeNull();
    expect(parsed.to).toBeNull();
    expect(parsed.page).toBeNull();
  });

  it('round-trips with buildSearchUrl', () => {
    const url = buildSearchUrl({
      slug: 'paris',
      searchType: 'city',
      occupancy: { adults: 2, children: 1 },
      from: new Date(2026, 5, 9),
      to: new Date(2026, 5, 12),
      rooms: 1,
    });
    const query = url.split('?')[1] ?? '';
    const parsed = parseSearchParams(new URLSearchParams(query));
    expect(parsed.occupancy).toEqual({ adults: 2, children: 1 });
    expect(parsed.searchType).toBe('city');
    expect(parsed.rooms).toBe(1);
    expect(parsed.page).toBe(1);
  });
});
