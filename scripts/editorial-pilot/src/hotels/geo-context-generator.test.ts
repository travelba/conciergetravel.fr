import { describe, expect, it } from 'vitest';

import { deriveTransportsFromPois, gateHighlights } from './geo-context-generator.js';

describe('deriveTransportsFromPois', () => {
  it('returns [] when there are no POIs or no transit data', () => {
    expect(deriveTransportsFromPois(null)).toEqual([]);
    expect(deriveTransportsFromPois([])).toEqual([]);
    expect(deriveTransportsFromPois([{ name: 'Louvre', distance_meters: 300 }])).toEqual([]);
  });

  it('maps POI transit modes onto the TransportSchema enum', () => {
    const pois = [
      {
        name: 'Louvre',
        distance_meters: 300,
        nearest_transit: { mode: 'subway', name: 'Tuileries', distance_meters: 120, line_ref: '1' },
      },
      {
        name: 'Gare',
        distance_meters: 800,
        nearest_transit: { mode: 'rail', name: 'Gare du Nord', distance_meters: 500 },
      },
      {
        name: 'Tram stop POI',
        distance_meters: 400,
        nearest_transit: { mode: 'light_rail', name: 'T3 Porte', distance_meters: 250 },
      },
    ];
    const out = deriveTransportsFromPois(pois);
    expect(out.map((t) => `${t.mode}:${t.station}`)).toEqual([
      'metro:Tuileries',
      'tram:T3 Porte',
      'train:Gare du Nord',
    ]);
    expect(out[0]?.line).toBe('1');
    expect(out[0]?.distance_meters).toBe(120);
  });

  it('dedupes by station name keeping the closest occurrence', () => {
    const pois = [
      {
        name: 'A',
        distance_meters: 100,
        nearest_transit: { mode: 'subway', name: 'Concorde', distance_meters: 300 },
      },
      {
        name: 'B',
        distance_meters: 200,
        nearest_transit: { mode: 'subway', name: 'Concorde', distance_meters: 90 },
      },
    ];
    const out = deriveTransportsFromPois(pois);
    expect(out).toHaveLength(1);
    expect(out[0]?.distance_meters).toBe(90);
  });

  it('drops unknown transit modes (never fabricates)', () => {
    const pois = [
      {
        name: 'X',
        distance_meters: 100,
        nearest_transit: { mode: 'ferry', name: 'Pier 7', distance_meters: 100 },
      },
    ];
    expect(deriveTransportsFromPois(pois)).toEqual([]);
  });

  it('caps the result at 4 entries, sorted by distance', () => {
    const pois = Array.from({ length: 8 }, (_, i) => ({
      name: `poi-${i}`,
      distance_meters: 100,
      nearest_transit: { mode: 'bus', name: `Stop ${i}`, distance_meters: (8 - i) * 50 },
    }));
    const out = deriveTransportsFromPois(pois);
    expect(out).toHaveLength(4);
    const distances = out.map((t) => t.distance_meters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });
});

describe('gateHighlights', () => {
  const ok = {
    highlights: [
      { label_fr: 'Vue sur la tour Eiffel', label_en: 'Eiffel Tower view' },
      { label_fr: 'Table étoilée au Michelin', label_en: 'Michelin-starred dining' },
      { label_fr: 'Spa de 1500 m carrés', label_en: 'Large wellness spa' },
    ],
  };

  it('passes a clean set', () => {
    expect(gateHighlights(ok)).toBeNull();
  });

  it('rejects banned superlatives', () => {
    const reason = gateHighlights({
      highlights: [
        { label_fr: 'Un cadre magnifique en ville', label_en: 'A beautiful city setting' },
        { label_fr: 'Table étoilée au Michelin', label_en: 'Michelin-starred dining' },
        { label_fr: 'Spa de 1500 m carrés', label_en: 'Large wellness spa' },
      ],
    });
    expect(reason).toContain('banned superlative');
  });

  it('rejects FR == EN labels', () => {
    const reason = gateHighlights({
      highlights: [
        { label_fr: 'Rooftop bar Paris', label_en: 'Rooftop bar Paris' },
        { label_fr: 'Table étoilée au Michelin', label_en: 'Michelin-starred dining' },
        { label_fr: 'Spa de 1500 m carrés', label_en: 'Large wellness spa' },
      ],
    });
    expect(reason).toContain('FR == EN');
  });

  it('rejects duplicate FR labels', () => {
    const reason = gateHighlights({
      highlights: [
        { label_fr: 'Table étoilée au Michelin', label_en: 'Michelin dining' },
        { label_fr: 'Table étoilée au Michelin', label_en: 'Michelin-starred restaurant' },
        { label_fr: 'Spa de 1500 m carrés', label_en: 'Large wellness spa' },
      ],
    });
    expect(reason).toContain('duplicate highlight');
  });
});
