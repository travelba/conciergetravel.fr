import { describe, expect, it } from 'vitest';

import { cityMatchesKey, eligibilityFor } from './combinator.js';
import type { HotelCatalogRow } from './load-hotels-catalog.js';
import type { RankingAxes } from './axes.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

let idCounter = 0;
function mk(partial: Partial<HotelCatalogRow> & { slug: string; city: string }): HotelCatalogRow {
  idCounter += 1;
  const id = `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
  return {
    id,
    slug: partial.slug,
    slug_en: null,
    name: partial.name ?? partial.slug,
    name_en: null,
    stars: partial.stars ?? 5,
    is_palace: partial.is_palace ?? false,
    city: partial.city,
    region: partial.region ?? null,
    country_code: partial.country_code ?? null,
    luxury_tier: partial.luxury_tier ?? null,
    affiliations: partial.affiliations ?? null,
    description_fr: partial.description_fr ?? null,
    address: null,
    postal_code: partial.postal_code ?? null,
    latitude: null,
    longitude: null,
  };
}

function axes(slug: string, scope: RankingAxes['lieu']['scope']): RankingAxes {
  return {
    types: ['all'],
    lieu: { scope, slug, label: slug },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  };
}

// ─── cityMatchesKey — whole-word / whole-phrase semantics ────────────────────

describe('cityMatchesKey — anti-false-positive whole-word city match', () => {
  it('rejects substring-but-not-whole-word matches (the C1 false positives)', () => {
    expect(cityMatchesKey('Venice', 'nice')).toBe(false); // "nice" ⊂ "venice"
    expect(cityMatchesKey("St Mary's Parish", 'paris')).toBe(false); // "paris" ⊂ "parish"
    expect(cityMatchesKey('Charleston', 'arles')).toBe(false); // "arles" ⊂ "charleston"
    expect(cityMatchesKey('Punta Maroma', 'roma')).toBe(false); // "roma" ⊂ "maroma"
  });

  it('accepts exact and whole-token matches', () => {
    expect(cityMatchesKey('Nice', 'nice')).toBe(true);
    expect(cityMatchesKey('Punta Maroma', 'maroma')).toBe(true);
    expect(cityMatchesKey('Rethymnon', 'rethymnon')).toBe(true);
  });

  it('accepts multi-token keys appearing as a contiguous phrase in the city', () => {
    expect(cityMatchesKey('Les Baux-de-Provence', 'baux-de-provence')).toBe(true);
    expect(cityMatchesKey('Lecci de Porto-Vecchio', 'porto-vecchio')).toBe(true);
    expect(cityMatchesKey('New York City', 'new york')).toBe(true);
  });

  it('is diacritic- and case-insensitive', () => {
    expect(cityMatchesKey('Megève', 'megeve')).toBe(true);
    expect(cityMatchesKey('Évian-les-Bains', 'evian')).toBe(true);
  });
});

// ─── eligibilityFor — city false positives removed ───────────────────────────

describe('eligibilityFor — lieu eligibility no longer leaks across countries', () => {
  const catalog: readonly HotelCatalogRow[] = [
    mk({ slug: 'belmond-hotel-cipriani', city: 'Venice', country_code: 'IT' }),
    mk({ slug: 'the-st-regis-venice', city: 'Venice', country_code: 'IT' }),
    mk({ slug: 'planters-inn', city: 'Charleston', country_code: 'US' }),
    mk({ slug: 'curtain-bluff-resort', city: "St Mary's Parish", country_code: 'AG' }),
    mk({ slug: 'etereo', city: 'Punta Maroma', country_code: 'MX' }),
    // Legitimate members that must keep matching.
    mk({ slug: 'real-nice-hotel', city: 'Nice', country_code: 'FR' }),
    mk({ slug: 'baumaniere', city: 'Les Baux-de-Provence', country_code: 'FR' }),
  ];

  it('excludes Venice hotels from the Côte d\u2019Azur cluster (was "nice" ⊂ "venice")', () => {
    const pred = eligibilityFor(axes('cote-d-azur', 'cluster'));
    const eligible = catalog.filter(pred).map((h) => h.slug);
    expect(eligible).toContain('real-nice-hotel');
    expect(eligible).not.toContain('belmond-hotel-cipriani');
    expect(eligible).not.toContain('the-st-regis-venice');
  });

  it('excludes Charleston (US) from Provence (was "arles" ⊂ "charleston")', () => {
    const pred = eligibilityFor(axes('provence', 'cluster'));
    const eligible = catalog.filter(pred).map((h) => h.slug);
    expect(eligible).toContain('baumaniere'); // Les Baux-de-Provence still matches
    expect(eligible).not.toContain('planters-inn');
  });

  it('excludes Punta Maroma (MX) from Rome (was "roma" ⊂ "maroma")', () => {
    const pred = eligibilityFor(axes('rome', 'ville'));
    const eligible = catalog.filter(pred).map((h) => h.slug);
    expect(eligible).not.toContain('etereo');
  });

  it('excludes the Antigua resort from every Paris ranking (was "paris" ⊂ "parish")', () => {
    for (const slug of ['paris', 'paris-1', 'marais']) {
      const scope = slug === 'paris' ? 'ville' : 'arrondissement';
      const pred = eligibilityFor(axes(slug, scope));
      const eligible = catalog.filter(pred).map((h) => h.slug);
      expect(eligible).not.toContain('curtain-bluff-resort');
    }
  });
});

// ─── eligibilityFor — luxury_tier / affiliation filters ──────────────────────

describe('eligibilityFor — luxury_tier and affiliation eligibility', () => {
  const catalog: readonly HotelCatalogRow[] = [
    mk({ slug: 'rc-1', city: 'Paris', country_code: 'FR', luxury_tier: 'relais_chateaux' }),
    mk({ slug: 'rc-2', city: 'Lyon', country_code: 'FR', luxury_tier: 'relais_chateaux' }),
    mk({ slug: 'fs-1', city: 'Paris', country_code: 'FR', luxury_tier: 'four_seasons' }),
    mk({ slug: 'plain', city: 'Paris', country_code: 'FR', luxury_tier: null }),
    mk({
      slug: 'aff-rc',
      city: 'Megève',
      country_code: 'FR',
      luxury_tier: null,
      affiliations: [{ kind: 'label', source: 'relais_chateaux', facet_slug: 'relais-chateaux' }],
    }),
  ];

  it('filters by luxury_tier instead of a name heuristic', () => {
    const pred = eligibilityFor(axes('france', 'france'), { luxuryTiers: ['relais_chateaux'] });
    const eligible = catalog.filter(pred).map((h) => h.slug);
    expect(eligible).toEqual(['rc-1', 'rc-2']);
    expect(eligible).not.toContain('fs-1');
    expect(eligible).not.toContain('plain');
  });

  it('matches an affiliation facet on either slug convention (snake ↔ kebab)', () => {
    const bySnake = eligibilityFor(axes('france', 'france'), {
      affiliationFacets: ['relais_chateaux'],
    });
    const byKebab = eligibilityFor(axes('france', 'france'), {
      affiliationFacets: ['relais-chateaux'],
    });
    expect(catalog.filter(bySnake).map((h) => h.slug)).toContain('aff-rc');
    expect(catalog.filter(byKebab).map((h) => h.slug)).toContain('aff-rc');
  });

  it('no filter ⇒ identical to the pre-C1 type/lieu/theme gate', () => {
    const pred = eligibilityFor(axes('france', 'france'));
    expect(catalog.filter(pred)).toHaveLength(catalog.length);
  });
});
