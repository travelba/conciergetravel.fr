import { describe, expect, it } from 'vitest';

import {
  buildBrandNameOrFilter,
  detectBrand,
  pickProximityCards,
  type RelatedHotelRow,
} from './get-related-hotels';

/**
 * Minimal case-insensitive emulation of PostgREST `name.ilike.<pattern>`
 * where `*` is the wildcard — lets us assert the DB-side brand filter is a
 * true superset of the `detectBrand` regex without hitting Supabase.
 */
function ilikeMatches(orFilter: string, name: string): boolean {
  const patterns = orFilter.split(',').map((clause) => clause.replace(/^name\.ilike\./u, ''));
  return patterns.some((pattern) => {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/gu, (ch) =>
      ch === '*' ? '.*' : `\\${ch}`,
    );
    return new RegExp(`^${escaped}$`, 'iu').test(name);
  });
}

function row(slug: string, city: string, region: string, name = slug): RelatedHotelRow {
  return {
    slug,
    slug_en: null,
    name,
    name_en: null,
    city,
    region,
    stars: 5,
    is_palace: true,
    hero_image: null,
    description_fr: null,
    description_en: null,
  };
}

describe('pickProximityCards', () => {
  it('prefers same-city and nearby over brand-wide or distant region siblings', () => {
    const bundle = {
      sameCity: [row('les-bories-and-spa', 'Gordes', '')],
      nearby: [
        row('le-mas-des-herbes-blanches', 'Joucas', ''),
        row('capelongue', 'Bonnieux', 'Luberon'),
      ],
      sameDepartment: [],
      sameBrand: [row('les-airelles-courchevel', 'Courchevel', 'Auvergne-Rhône-Alpes')],
      brand: { slug: 'airelles', label: 'Airelles' },
      sameRegion: [
        row('les-airelles-saint-tropez', 'Saint-Tropez', "Provence-Alpes-Côte d'Azur"),
        row('le-negresco-nice', 'Nice', "Provence-Alpes-Côte d'Azur"),
      ],
    };

    const cards = pickProximityCards(bundle, "Provence-Alpes-Côte d'Azur");

    expect(cards.map((c) => c.slug)).toEqual([
      'les-bories-and-spa',
      'le-mas-des-herbes-blanches',
      'capelongue',
    ]);
  });

  it('deduplicates when a hotel appears in multiple geographic buckets', () => {
    const shared = row('capelongue', 'Bonnieux', 'Luberon');
    const bundle = {
      sameCity: [],
      nearby: [shared],
      sameDepartment: [shared],
      sameBrand: [],
      brand: null,
      sameRegion: [shared],
    };

    expect(pickProximityCards(bundle, 'Luberon').map((c) => c.slug)).toEqual(['capelongue']);
  });
});

describe('buildBrandNameOrFilter (brand facet filtered in DB before any cap)', () => {
  // Representative published names for each brand the audit flagged. The DB
  // ILIKE superset MUST match all of these so siblings sorting past any global
  // page boundary are no longer silently dropped.
  const SAMPLES: ReadonlyArray<{ readonly slug: string; readonly names: readonly string[] }> = [
    { slug: 'aman', names: ['Aman Tokyo', 'Amanpuri', 'Amanjena', 'Amanzoe'] },
    { slug: 'six-senses', names: ['Six Senses Bali', 'Six Senses Douro Valley'] },
    {
      slug: 'ritz-carlton',
      names: ['The Ritz-Carlton, Tokyo', 'Ritz Carlton Abama'],
    },
    { slug: 'waldorf-astoria', names: ['Waldorf Astoria Maldives', 'Waldorf-Astoria Las Vegas'] },
    { slug: 'st-regis', names: ['The St. Regis Bali', 'St Regis New York'] },
  ];

  for (const { slug, names } of SAMPLES) {
    it(`returns an or-filter whose ILIKE superset covers every ${slug} sibling`, () => {
      const orFilter = buildBrandNameOrFilter(slug);
      expect(orFilter).not.toBeNull();
      for (const name of names) {
        // DB-side superset matches…
        expect(ilikeMatches(orFilter as string, name)).toBe(true);
        // …and detectBrand re-confirms the same slug (false positives dropped).
        expect(detectBrand(name)?.slug).toBe(slug);
      }
    });
  }

  it('drops an ILIKE false positive that detectBrand rejects', () => {
    const orFilter = buildBrandNameOrFilter('st-regis');
    // "East Regis Manor" trips `*st*regis*` but NOT the `\bst\.?\s*regis\b` regex.
    expect(ilikeMatches(orFilter as string, 'East Regis Manor')).toBe(true);
    expect(detectBrand('East Regis Manor')).toBeNull();
  });

  it('returns null for affiliation-only families (no name pattern)', () => {
    // `grace-hotels` / `dorchester` resolve via the affiliations facet and are
    // never reached by the name-based cluster (detectBrand skips them).
    expect(buildBrandNameOrFilter('grace-hotels')).toBeNull();
    expect(buildBrandNameOrFilter('dorchester')).toBeNull();
    expect(buildBrandNameOrFilter('unknown-brand')).toBeNull();
  });
});
