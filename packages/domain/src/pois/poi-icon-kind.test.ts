import { describe, expect, it } from 'vitest';

import { resolvePoiIconKind, resolveVisitKind } from './poi-icon-kind';

describe('resolveVisitKind', () => {
  it('maps château keywords to castle', () => {
    expect(resolveVisitKind('attraction', 'Patrimoine', 'Château de Gordes')).toBe('castle');
  });

  it('maps musée keywords to museum', () => {
    expect(resolveVisitKind('museum', null, 'Musée de la Lavande')).toBe('museum');
  });
});

describe('resolvePoiIconKind', () => {
  it('returns eat family for eat bucket', () => {
    expect(resolvePoiIconKind('eat', 'restaurant', 'Gastronomie', 'La Table du Chef')).toEqual({
      family: 'eat',
    });
  });

  it('returns shop bakery for boulangerie', () => {
    expect(resolvePoiIconKind('shop', 'bakery', null, 'Boulangerie du Village')).toEqual({
      family: 'shop',
      kind: 'bakery',
    });
  });
});
