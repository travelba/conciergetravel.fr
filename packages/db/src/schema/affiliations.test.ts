import { describe, expect, it } from 'vitest';

import {
  HotelAffiliationKindSchema,
  HotelAffiliationSchema,
  HotelAffiliationsArraySchema,
  parseAffiliationsLenient,
  selectAffiliationsByKind,
} from './affiliations';

describe('HotelAffiliationKindSchema', () => {
  it('accepts the four canonical kinds', () => {
    for (const kind of ['brand', 'label', 'ranking', 'guide'] as const) {
      expect(HotelAffiliationKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects unknown kinds', () => {
    expect(HotelAffiliationKindSchema.safeParse('chain').success).toBe(false);
    expect(HotelAffiliationKindSchema.safeParse('tier').success).toBe(false);
    expect(HotelAffiliationKindSchema.safeParse('').success).toBe(false);
  });
});

describe('HotelAffiliationSchema', () => {
  it('accepts a minimal brand entry', () => {
    const parsed = HotelAffiliationSchema.safeParse({
      kind: 'brand',
      source: 'grecotel',
      display_name: 'Grecotel Hotels & Resorts',
      verified: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('brand');
      expect(parsed.data.verified).toBe(true);
    }
  });

  it('accepts a fully populated label entry with metadata', () => {
    const parsed = HotelAffiliationSchema.safeParse({
      kind: 'label',
      source: 'relais_chateaux',
      display_name: 'Relais & Châteaux',
      verified: true,
      since_year: 2018,
      source_url: 'https://www.relaischateaux.com/fr/hotel/le-bristol-paris',
      facet_slug: 'relais-chateaux',
      scraped_at: '2026-05-25T15:13:53.946Z',
      metadata: {
        has_spa: true,
        has_pool: true,
        michelin_stars: 3,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('defaults verified to false when omitted', () => {
    const parsed = HotelAffiliationSchema.parse({
      kind: 'ranking',
      source: 'world_50_best',
      display_name: "World's 50 Best Hotels",
    });
    expect(parsed.verified).toBe(false);
  });

  it('rejects source with hyphens (must be snake_case)', () => {
    const parsed = HotelAffiliationSchema.safeParse({
      kind: 'brand',
      source: 'four-seasons',
      display_name: 'Four Seasons',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects facet_slug with underscores (must be kebab-case)', () => {
    const parsed = HotelAffiliationSchema.safeParse({
      kind: 'brand',
      source: 'four_seasons',
      display_name: 'Four Seasons',
      facet_slug: 'four_seasons',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects since_year outside [1850, 2100]', () => {
    expect(
      HotelAffiliationSchema.safeParse({
        kind: 'label',
        source: 'relais_chateaux',
        display_name: 'Relais & Châteaux',
        since_year: 1700,
      }).success,
    ).toBe(false);

    expect(
      HotelAffiliationSchema.safeParse({
        kind: 'label',
        source: 'relais_chateaux',
        display_name: 'Relais & Châteaux',
        since_year: 2200,
      }).success,
    ).toBe(false);
  });

  it('rejects a non-https source_url', () => {
    const parsed = HotelAffiliationSchema.safeParse({
      kind: 'brand',
      source: 'aman',
      display_name: 'Aman',
      source_url: 'not-a-url',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects legacy luxury_chain_xlsx shape (no `kind` field)', () => {
    const legacy = {
      source: 'luxury_chain_xlsx',
      scraped_at: '2026-05-27T15:29:31.931Z',
      source_row: 26,
      chain_facet_slug: 'oetker-collection',
      chain_display_name: 'Oetker Collection',
    };
    const parsed = HotelAffiliationSchema.safeParse(legacy);
    expect(parsed.success).toBe(false);
  });

  it('rejects legacy relais_chateaux shape (no `kind` field)', () => {
    const legacy = {
      source: 'relais_chateaux',
      source_url: 'https://www.relaischateaux.com/fr/hotel/x',
      scraped_at: '2026-05-25T15:13:53.946Z',
      metadata: { has_spa: true },
    };
    const parsed = HotelAffiliationSchema.safeParse(legacy);
    expect(parsed.success).toBe(false);
  });
});

describe('HotelAffiliationsArraySchema', () => {
  it('accepts an empty array', () => {
    expect(HotelAffiliationsArraySchema.safeParse([]).success).toBe(true);
  });

  it('rejects when one of N entries is malformed', () => {
    const parsed = HotelAffiliationsArraySchema.safeParse([
      { kind: 'brand', source: 'oetker_collection', display_name: 'Oetker' },
      { kind: 'invalid', source: 'foo', display_name: 'bar' },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe('parseAffiliationsLenient', () => {
  it('skips malformed entries and keeps valid ones', () => {
    const out = parseAffiliationsLenient([
      { kind: 'brand', source: 'oetker_collection', display_name: 'Oetker' },
      { source: 'not_a_kind' },
      { kind: 'label', source: 'relais_chateaux', display_name: 'R&C' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.source).toBe('oetker_collection');
    expect(out[1]?.source).toBe('relais_chateaux');
  });

  it('returns [] when input is not an array', () => {
    expect(parseAffiliationsLenient(null)).toEqual([]);
    expect(parseAffiliationsLenient({ kind: 'brand' })).toEqual([]);
    expect(parseAffiliationsLenient('string')).toEqual([]);
  });
});

describe('selectAffiliationsByKind', () => {
  const entries = [
    HotelAffiliationSchema.parse({
      kind: 'label',
      source: 'relais_chateaux',
      display_name: 'Relais & Châteaux',
      since_year: 2018,
    }),
    HotelAffiliationSchema.parse({
      kind: 'brand',
      source: 'oetker_collection',
      display_name: 'Oetker Collection',
    }),
    HotelAffiliationSchema.parse({
      kind: 'label',
      source: 'palace_atout_france',
      display_name: 'Palace Atout France',
      since_year: 2011,
    }),
    HotelAffiliationSchema.parse({
      kind: 'label',
      source: 'forbes_5_star',
      display_name: 'Forbes Five-Star',
      since_year: 2024,
    }),
  ];

  it('returns only entries of the requested kind', () => {
    const labels = selectAffiliationsByKind(entries, 'label');
    expect(labels).toHaveLength(3);
    expect(labels.every((e) => e.kind === 'label')).toBe(true);
  });

  it('sorts by since_year DESC (most recent first), then display_name ASC', () => {
    const labels = selectAffiliationsByKind(entries, 'label');
    expect(labels[0]?.source).toBe('forbes_5_star'); // 2024
    expect(labels[1]?.source).toBe('relais_chateaux'); // 2018
    expect(labels[2]?.source).toBe('palace_atout_france'); // 2011
  });

  it('returns an empty array when no entries match', () => {
    expect(selectAffiliationsByKind(entries, 'guide')).toEqual([]);
    expect(selectAffiliationsByKind(entries, 'ranking')).toEqual([]);
  });
});
