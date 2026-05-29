import { describe, expect, it } from 'vitest';

import {
  type HotelAffiliationLike,
  mapAffiliationsToAwardStrings,
  mapAffiliationsToBrand,
} from './affiliations';

const palace: HotelAffiliationLike = {
  kind: 'label',
  source: 'palace_atout_france',
  display_name: 'Palace (distinction Atout France)',
  verified: true,
  since_year: 2011,
  facet_slug: 'palace-atout-france',
};

const forbes: HotelAffiliationLike = {
  kind: 'label',
  source: 'forbes_5_star',
  display_name: 'Forbes Travel Guide Five-Star',
  verified: true,
  facet_slug: 'forbes-5-star',
};

const dorchester: HotelAffiliationLike = {
  kind: 'brand',
  source: 'dorchester',
  display_name: 'Dorchester Collection',
  verified: true,
  facet_slug: 'dorchester',
  source_url: 'https://www.dorchestercollection.com/',
};

const world50: HotelAffiliationLike = {
  kind: 'ranking',
  source: 'world_50_best',
  display_name: "World's 50 Best Hotels",
  verified: true,
  since_year: 2024,
};

const tabletGuide: HotelAffiliationLike = {
  kind: 'guide',
  source: 'tablet_hotels',
  display_name: 'Tablet Hotels',
  verified: true,
};

describe('mapAffiliationsToAwardStrings', () => {
  it('returns label + ranking + guide display names when verified', () => {
    const out = mapAffiliationsToAwardStrings([forbes, world50, tabletGuide, dorchester]);
    expect(out).toContain('Forbes Travel Guide Five-Star');
    expect(out).toContain("World's 50 Best Hotels");
    expect(out).toContain('Tablet Hotels');
    // brand is excluded — it belongs to `Hotel.brand`, not `Hotel.award`.
    expect(out).not.toContain('Dorchester Collection');
  });

  it('excludes affiliations with verified=false (Hard Rule 14)', () => {
    const unverified: HotelAffiliationLike = {
      ...forbes,
      verified: false,
    };
    const relais: HotelAffiliationLike = {
      kind: 'label',
      source: 'relais_chateaux',
      display_name: 'Relais & Châteaux',
      verified: true,
    };
    const out = mapAffiliationsToAwardStrings([relais, unverified]);
    expect(out).toEqual(['Relais & Châteaux']);
  });

  it('sorts by since_year desc with year-less entries last, then alpha', () => {
    const relais: HotelAffiliationLike = {
      kind: 'label',
      source: 'relais_chateaux',
      display_name: 'Relais & Châteaux',
      verified: true,
      since_year: 2011,
    };
    const out = mapAffiliationsToAwardStrings([forbes, relais, world50]);
    // world50 (2024) → relais (2011) → forbes (year-less) tied with itself
    expect(out[0]).toBe("World's 50 Best Hotels");
    expect(out[1]).toBe('Relais & Châteaux');
    expect(out[2]).toBe('Forbes Travel Guide Five-Star');
  });

  it('dedupes case-insensitively', () => {
    const dup: HotelAffiliationLike = {
      ...forbes,
      source: 'forbes_5_star_v2',
      display_name: 'forbes travel guide five-star', // same name, lower-cased
    };
    const out = mapAffiliationsToAwardStrings([forbes, dup]);
    expect(out).toHaveLength(1);
    // The actual casing kept on collision is non-deterministic (depends on
    // locale-aware sort), but the value must match the canonical name
    // case-insensitively. Real-world `display_name` values are always
    // proper-cased by the pipelines.
    expect(out[0]?.toLowerCase()).toBe('forbes travel guide five-star');
  });

  it('drops blank display_name entries', () => {
    const blank: HotelAffiliationLike = {
      ...forbes,
      display_name: '   ',
    };
    const out = mapAffiliationsToAwardStrings([blank, world50]);
    expect(out).toEqual(["World's 50 Best Hotels"]);
  });

  it('returns empty array on empty input', () => {
    expect(mapAffiliationsToAwardStrings([])).toEqual([]);
  });

  it('returns empty array when only brands are present', () => {
    expect(mapAffiliationsToAwardStrings([dorchester])).toEqual([]);
  });

  it('excludes `palace_atout_france` source (emitted via builder isPalace flag)', () => {
    const out = mapAffiliationsToAwardStrings([palace, forbes]);
    // The Atout France palace label is dropped — the builder emits it
    // canonically through `isPalace: true` → "Distinction Palace — Atout
    // France", so re-emitting the affiliation string would only create
    // a near-duplicate entry in `Hotel.award[]`.
    expect(out).toEqual(['Forbes Travel Guide Five-Star']);
  });
});

describe('mapAffiliationsToBrand', () => {
  it('returns the brand entry with name + sameAs + identifier when verified', () => {
    const out = mapAffiliationsToBrand([palace, dorchester, forbes]);
    expect(out).toEqual({
      name: 'Dorchester Collection',
      sameAs: 'https://www.dorchestercollection.com/',
      identifier: 'dorchester',
    });
  });

  it('omits sameAs when source_url is missing or non-https', () => {
    const noUrl: HotelAffiliationLike = { ...dorchester };
    delete (noUrl as { source_url?: string }).source_url;
    const out = mapAffiliationsToBrand([noUrl]);
    expect(out?.sameAs).toBeUndefined();
    expect(out?.name).toBe('Dorchester Collection');
  });

  it('rejects http (non-https) source_url for sameAs', () => {
    const http: HotelAffiliationLike = {
      ...dorchester,
      source_url: 'http://insecure.example.com/',
    };
    const out = mapAffiliationsToBrand([http]);
    expect(out?.sameAs).toBeUndefined();
  });

  it('returns null when no brand is present (only labels/rankings)', () => {
    expect(mapAffiliationsToBrand([palace, forbes, world50])).toBeNull();
  });

  it('returns null when brand exists but verified=false', () => {
    const unverified: HotelAffiliationLike = { ...dorchester, verified: false };
    expect(mapAffiliationsToBrand([unverified])).toBeNull();
  });

  it('picks the most recent brand on data accident (multiple brands)', () => {
    const oldBrand: HotelAffiliationLike = {
      ...dorchester,
      display_name: 'Aman Resorts',
      since_year: 2010,
      facet_slug: 'aman',
    };
    const recentBrand: HotelAffiliationLike = {
      ...dorchester,
      display_name: 'Mandarin Oriental',
      since_year: 2022,
      facet_slug: 'mandarin-oriental',
    };
    const out = mapAffiliationsToBrand([oldBrand, recentBrand]);
    expect(out?.name).toBe('Mandarin Oriental');
  });

  it('omits identifier when facet_slug is missing', () => {
    const noSlug: HotelAffiliationLike = { ...dorchester };
    delete (noSlug as { facet_slug?: string }).facet_slug;
    const out = mapAffiliationsToBrand([noSlug]);
    expect(out?.identifier).toBeUndefined();
  });
});
