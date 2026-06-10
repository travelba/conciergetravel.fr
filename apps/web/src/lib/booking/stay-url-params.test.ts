import { describe, expect, it } from 'vitest';

import { parseChildAgesParam, parseStayUrlParams, serializeChildAges } from './stay-url-params';

describe('parseChildAgesParam', () => {
  it('parses comma-separated ages', () => {
    expect(parseChildAgesParam('5,8,12')).toEqual([5, 8, 12]);
  });

  it('clamps ages to 0–17', () => {
    expect(parseChildAgesParam('-1,18,7')).toEqual([0, 17, 7]);
  });

  it('returns empty for missing input', () => {
    expect(parseChildAgesParam(null)).toEqual([]);
    expect(parseChildAgesParam('')).toEqual([]);
  });
});

describe('serializeChildAges', () => {
  it('round-trips through parse', () => {
    const ages = [3, 11, 0] as const;
    expect(parseChildAgesParam(serializeChildAges(ages))).toEqual([...ages]);
  });
});

describe('parseStayUrlParams', () => {
  it('prefers childAges over children count', () => {
    const params = new URLSearchParams('children=2&childAges=4,9');
    expect(parseStayUrlParams(params).occupancy.childAges).toEqual([4, 9]);
  });

  it('derives ages from children when childAges is absent', () => {
    const params = new URLSearchParams('children=2');
    expect(parseStayUrlParams(params).occupancy.childAges).toEqual([8, 8]);
  });

  it('parses rooms and adults', () => {
    const params = new URLSearchParams('rooms=3&adults=4&checkIn=2026-09-01');
    const parsed = parseStayUrlParams(params);
    expect(parsed.occupancy.rooms).toBe(3);
    expect(parsed.occupancy.adults).toBe(4);
    expect(parsed.checkIn).toBe('2026-09-01');
  });
});
