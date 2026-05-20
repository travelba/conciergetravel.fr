import { describe, expect, it } from 'vitest';

import {
  EDITORIAL_CATEGORIES,
  filterCategory,
  findCategory,
  type EditorialCategory,
} from './editorial-categories';
import type { PublishedHotelIndexCard } from './get-hotel-by-slug';

/**
 * Test hotel factory — produces a fully-typed `PublishedHotelIndexCard`
 * with sensible defaults that each test can override.
 */
function makeHotel(overrides: Partial<PublishedHotelIndexCard> = {}): PublishedHotelIndexCard {
  return {
    slugFr: 'test-hotel',
    slugEn: 'test-hotel',
    nameFr: 'Test Hotel',
    nameEn: 'Test Hotel',
    city: 'paris',
    region: 'île-de-france',
    stars: 5,
    isPalace: false,
    priority: 'P1',
    heroPublicId: null,
    descriptionFr: null,
    descriptionEn: null,
    ...overrides,
  };
}

describe('EDITORIAL_CATEGORIES', () => {
  it('has unique slugs', () => {
    const slugs = EDITORIAL_CATEGORIES.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('has non-empty labels in both locales for every category', () => {
    for (const c of EDITORIAL_CATEGORIES) {
      expect(c.labelFr).not.toBe('');
      expect(c.labelEn).not.toBe('');
      expect(c.h1Fr).not.toBe('');
      expect(c.h1En).not.toBe('');
      expect(c.metaTitleFr).not.toBe('');
      expect(c.metaTitleEn).not.toBe('');
      expect(c.metaDescFr).not.toBe('');
      expect(c.metaDescEn).not.toBe('');
    }
  });

  it('has total `match` predicates (no exception on arbitrary cards)', () => {
    // Bag of edge-case hotels — any `match` must accept all of these
    // without throwing. Total predicates protect the category page
    // from server-side crashes.
    const cases: PublishedHotelIndexCard[] = [
      makeHotel({ city: '', region: '' }),
      makeHotel({ city: 'paris', region: 'île-de-france', isPalace: true, stars: 5 }),
      makeHotel({ city: 'courchevel', region: 'auvergne-rhône-alpes', stars: 5 }),
      makeHotel({ city: 'bordeaux', region: 'nouvelle-aquitaine', isPalace: false, stars: 4 }),
      makeHotel({ nameFr: 'Château de Bagnols', city: 'bagnols' }),
      makeHotel({ nameFr: 'Villa Marie', city: 'saint-tropez' }),
      makeHotel({ nameFr: 'Le Chalet du Mont d’Arbois', city: 'megève' }),
      makeHotel({ nameFr: 'Boutique-Hôtel des Voyageurs' }),
      makeHotel({ nameFr: 'Domaine de Murtoli', city: 'sartène' }),
    ];

    for (const c of EDITORIAL_CATEGORIES) {
      for (const card of cases) {
        expect(() => c.match(card)).not.toThrow();
      }
    }
  });
});

describe('findCategory', () => {
  it('returns the category when slug matches', () => {
    expect(findCategory('palaces-france')).not.toBeNull();
    expect(findCategory('hotels-5-etoiles')).not.toBeNull();
    expect(findCategory('chalets-luxe')).not.toBeNull();
  });

  it('returns null for unknown slug', () => {
    expect(findCategory('unknown-cat')).toBeNull();
    expect(findCategory('')).toBeNull();
  });
});

describe('filterCategory predicates', () => {
  const sample: PublishedHotelIndexCard[] = [
    makeHotel({
      slugFr: 'plaza-athenee',
      nameFr: 'Hôtel Plaza Athénée',
      city: 'paris',
      region: 'île-de-france',
      stars: 5,
      isPalace: true,
    }),
    makeHotel({
      slugFr: 'cheval-blanc-courchevel',
      nameFr: 'Cheval Blanc Courchevel',
      city: 'courchevel',
      region: 'auvergne-rhône-alpes',
      stars: 5,
      isPalace: true,
    }),
    makeHotel({
      slugFr: 'eden-roc',
      nameFr: 'Hôtel du Cap-Eden-Roc',
      city: 'antibes',
      region: "provence-alpes-côte d'azur",
      stars: 5,
      isPalace: true,
    }),
    makeHotel({
      slugFr: 'sources-caudalie',
      nameFr: 'Les Sources de Caudalie',
      city: 'martillac',
      region: 'nouvelle-aquitaine',
      stars: 5,
      isPalace: false,
    }),
    makeHotel({
      slugFr: 'chateau-bagnols',
      nameFr: 'Château de Bagnols',
      city: 'bagnols',
      region: 'auvergne-rhône-alpes',
      stars: 5,
      isPalace: false,
    }),
    makeHotel({
      slugFr: 'villa-marie',
      nameFr: 'Villa Marie',
      city: 'saint-tropez',
      region: "provence-alpes-côte d'azur",
      stars: 5,
      isPalace: false,
    }),
    makeHotel({
      slugFr: 'chalet-mont-arbois',
      nameFr: 'Le Chalet du Mont d’Arbois',
      city: 'megève',
      region: 'auvergne-rhône-alpes',
      stars: 5,
      isPalace: false,
    }),
    makeHotel({
      slugFr: 'hotel-4etoiles',
      nameFr: 'Petit Hôtel charmant',
      city: 'rennes',
      region: 'bretagne',
      stars: 4,
      isPalace: false,
    }),
  ];

  function pick(slug: string): EditorialCategory {
    const cat = findCategory(slug);
    if (cat === null) throw new Error(`category ${slug} not found`);
    return cat;
  }

  it('palaces-france covers only Atout France palaces', () => {
    const result = filterCategory(sample, pick('palaces-france'));
    expect(result.map((h) => h.slugFr).sort()).toEqual(
      ['cheval-blanc-courchevel', 'eden-roc', 'plaza-athenee'].sort(),
    );
  });

  it('palaces-paris covers Parisian palaces only', () => {
    const result = filterCategory(sample, pick('palaces-paris'));
    expect(result.map((h) => h.slugFr)).toEqual(['plaza-athenee']);
  });

  it('hotels-5-etoiles covers 5★ non-Palace addresses', () => {
    const result = filterCategory(sample, pick('hotels-5-etoiles'));
    // Excludes the 3 palaces, includes Caudalie, Bagnols, Villa Marie, Mont d’Arbois.
    expect(result.length).toBe(4);
    expect(result.every((h) => h.stars === 5 && !h.isPalace)).toBe(true);
  });

  it('hotels-4-etoiles covers 4★', () => {
    const result = filterCategory(sample, pick('hotels-4-etoiles'));
    expect(result.map((h) => h.slugFr)).toEqual(['hotel-4etoiles']);
  });

  it('chateaux-hotels matches /château/i in the name', () => {
    const result = filterCategory(sample, pick('chateaux-hotels'));
    expect(result.map((h) => h.slugFr)).toEqual(['chateau-bagnols']);
  });

  it('villas matches /villa/i in the name', () => {
    const result = filterCategory(sample, pick('villas'));
    expect(result.map((h) => h.slugFr)).toEqual(['villa-marie']);
  });

  it('chalets-luxe matches /chalet/i in the name', () => {
    const result = filterCategory(sample, pick('chalets-luxe'));
    expect(result.map((h) => h.slugFr)).toEqual(['chalet-mont-arbois']);
  });
});
