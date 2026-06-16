import { describe, expect, it } from 'vitest';

import { estimateWalkMinutes, haversineMeters, rankByProximity, toGeoPoint } from './proximity';

describe('haversineMeters', () => {
  it('measures a known Paris distance (Louvre → Notre-Dame ~1.1 km)', () => {
    const louvre = { latitude: 48.8606, longitude: 2.3376 };
    const notreDame = { latitude: 48.853, longitude: 2.3499 };
    const d = haversineMeters(louvre, notreDame);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1400);
  });

  it('is zero for identical points', () => {
    const p = { latitude: 48.8, longitude: 2.3 };
    expect(haversineMeters(p, p)).toBe(0);
  });
});

describe('estimateWalkMinutes', () => {
  it('returns at least 1 minute for nearby points', () => {
    expect(estimateWalkMinutes(40)).toBe(1);
  });
  it('returns null beyond the walkable threshold', () => {
    expect(estimateWalkMinutes(3000)).toBeNull();
  });
});

describe('rankByProximity', () => {
  const anchor = { latitude: 48.8606, longitude: 2.3376 };
  const candidates = [
    { id: 'far', lat: 48.88, lng: 2.36 },
    { id: 'near', lat: 48.861, lng: 2.338 },
    { id: 'mid', lat: 48.853, lng: 2.3499 },
    { id: 'no-coords', lat: null, lng: null },
  ];

  it('sorts by distance ascending and skips coordinate-less candidates', () => {
    const ranked = rankByProximity(anchor, candidates, (c) => toGeoPoint(c.lat, c.lng), {
      maxMeters: 5000,
      limit: 8,
    });
    expect(ranked.map((r) => r.item.id)).toEqual(['near', 'mid', 'far']);
    expect(ranked[0]?.distanceMeters).toBeLessThan(ranked[1]?.distanceMeters ?? Infinity);
  });

  it('applies the maxMeters cutoff and the limit', () => {
    const ranked = rankByProximity(anchor, candidates, (c) => toGeoPoint(c.lat, c.lng), {
      maxMeters: 300,
      limit: 1,
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.item.id).toBe('near');
  });
});
