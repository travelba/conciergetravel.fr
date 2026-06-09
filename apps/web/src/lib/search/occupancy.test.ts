import { describe, expect, it } from 'vitest';

import { decodeOccupancy, encodeOccupancy, formatOccupancyLabel } from './occupancy';

describe('encodeOccupancy', () => {
  it('pads each count to two digits (2 adults / 0 children → a02c00)', () => {
    expect(encodeOccupancy({ adults: 2, children: 0 })).toBe('a02c00');
  });

  it('encodes mixed parties', () => {
    expect(encodeOccupancy({ adults: 3, children: 2 })).toBe('a03c02');
  });

  it('keeps two digits for double-digit counts', () => {
    expect(encodeOccupancy({ adults: 12, children: 10 })).toBe('a12c10');
  });

  it('clamps negative counts to 00', () => {
    expect(encodeOccupancy({ adults: -1, children: -5 })).toBe('a00c00');
  });

  it('clamps counts above 99 to 99', () => {
    expect(encodeOccupancy({ adults: 150, children: 200 })).toBe('a99c99');
  });

  it('truncates fractional counts', () => {
    expect(encodeOccupancy({ adults: 2.9, children: 1.2 })).toBe('a02c01');
  });
});

describe('decodeOccupancy', () => {
  it('round-trips the canonical encoding', () => {
    expect(decodeOccupancy('a02c00')).toEqual({ adults: 2, children: 0 });
    expect(decodeOccupancy('a03c02')).toEqual({ adults: 3, children: 2 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(decodeOccupancy('  a02c01 ')).toEqual({ adults: 2, children: 1 });
  });

  it('returns null for a malformed string', () => {
    expect(decodeOccupancy('')).toBeNull();
    expect(decodeOccupancy('a2c0')).toBeNull();
    expect(decodeOccupancy('a02c0')).toBeNull();
    expect(decodeOccupancy('x02c00')).toBeNull();
    expect(decodeOccupancy('a02c00extra')).toBeNull();
    expect(decodeOccupancy('aXXcYY')).toBeNull();
  });

  it('is the inverse of encode for in-range values', () => {
    for (let adults = 0; adults <= 99; adults += 13) {
      for (let children = 0; children <= 99; children += 17) {
        const encoded = encodeOccupancy({ adults, children });
        expect(decodeOccupancy(encoded)).toEqual({ adults, children });
      }
    }
  });
});

describe('formatOccupancyLabel', () => {
  it('renders a single adult without plural', () => {
    expect(formatOccupancyLabel({ adults: 1, children: 0 })).toBe('1 adulte');
  });

  it('renders adults plural without children', () => {
    expect(formatOccupancyLabel({ adults: 2, children: 0 })).toBe('2 adultes');
  });

  it('renders one child', () => {
    expect(formatOccupancyLabel({ adults: 2, children: 1 })).toBe('2 adultes, 1 enfant');
  });

  it('renders several children', () => {
    expect(formatOccupancyLabel({ adults: 3, children: 2 })).toBe('3 adultes, 2 enfants');
  });
});
