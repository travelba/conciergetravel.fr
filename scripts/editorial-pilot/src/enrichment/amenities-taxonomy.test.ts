import { describe, expect, it } from 'vitest';

import {
  AMENITIES_BY_KEY,
  AMENITIES_TAXONOMY,
  BASELINE_AMENITY_KEYS,
  extractExistingAmenityKeys,
  mergeAmenities,
} from './amenities-taxonomy.js';

describe('AMENITIES_TAXONOMY integrity', () => {
  it('has unique keys', () => {
    const keys = AMENITIES_TAXONOMY.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has bilingual labels on every entry', () => {
    for (const a of AMENITIES_TAXONOMY) {
      expect(a.label_fr.length).toBeGreaterThan(0);
      expect(a.label_en.length).toBeGreaterThan(0);
    }
  });

  it('exposes a baseline set that clears the Phase 1 floor (≥ 12)', () => {
    expect(BASELINE_AMENITY_KEYS.length).toBeGreaterThanOrEqual(12);
  });

  it('indexes every entry in AMENITIES_BY_KEY', () => {
    expect(AMENITIES_BY_KEY.size).toBe(AMENITIES_TAXONOMY.length);
  });
});

describe('mergeAmenities', () => {
  it('always includes the baseline set', () => {
    const merged = mergeAmenities([], []);
    const keys = new Set(merged.map((a) => a.key));
    for (const b of BASELINE_AMENITY_KEYS) expect(keys.has(b)).toBe(true);
  });

  it('adds selected keys on top of baseline', () => {
    const merged = mergeAmenities([], ['spa', 'rooftop_bar']);
    const keys = merged.map((a) => a.key);
    expect(keys).toContain('spa');
    expect(keys).toContain('rooftop_bar');
  });

  it('preserves existing editorial keys', () => {
    const merged = mergeAmenities(['ski_in_ski_out'], []);
    expect(merged.map((a) => a.key)).toContain('ski_in_ski_out');
  });

  it('drops unknown keys (anti-fabrication guard)', () => {
    const merged = mergeAmenities(['totally_made_up'], ['also_fake']);
    expect(merged.map((a) => a.key)).not.toContain('totally_made_up');
    expect(merged.map((a) => a.key)).not.toContain('also_fake');
  });

  it('dedupes and returns records in taxonomy order', () => {
    const merged = mergeAmenities(['spa'], ['spa', 'bar']);
    const spaCount = merged.filter((a) => a.key === 'spa').length;
    expect(spaCount).toBe(1);
    const order = AMENITIES_TAXONOMY.map((a) => a.key);
    const mergedKeys = merged.map((a) => a.key);
    const sorted = [...mergedKeys].sort((x, y) => order.indexOf(x) - order.indexOf(y));
    expect(mergedKeys).toEqual(sorted);
  });
});

describe('extractExistingAmenityKeys', () => {
  it('reads keys from object entries', () => {
    expect(
      extractExistingAmenityKeys([
        { key: 'spa', label_fr: 'Spa' },
        { key: 'bar', label_fr: 'Bar' },
      ]),
    ).toEqual(['spa', 'bar']);
  });

  it('reads bare-string entries that match a known key', () => {
    expect(extractExistingAmenityKeys(['spa', 'not_a_key'])).toEqual(['spa']);
  });

  it('returns [] for non-array input', () => {
    expect(extractExistingAmenityKeys(null)).toEqual([]);
    expect(extractExistingAmenityKeys('spa')).toEqual([]);
  });
});
