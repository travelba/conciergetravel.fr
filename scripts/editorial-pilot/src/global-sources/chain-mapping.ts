/**
 * Chain label → canonical `luxury_tier` slug for the catalogue gap
 * closure pipeline.
 *
 * The two source Excels label chains in slightly different ways
 * ("Four Seasons Hotels & Resorts" vs "Four Seasons" vs "Four Seasons
 * Hotels and Resorts" depending on the sheet). This module normalises
 * those to the 38 `luxury_tier` enum values accepted by migration
 * 0059.
 *
 * The wave / priority assignment also lives here so `scaffold-by-chain.ts`
 * can stamp the right `priority` value (P1 for Wave A ultra-luxe, P2
 * for Wave B mainstream-premium, P3 for Wave C boutique-independent,
 * P2 for Wave D boutique ultra-luxe).
 *
 * Skill: editorial-pilot, content-modeling, membership-program.
 */

export type LuxuryTier =
  | 'palace_atout_france'
  | 'forbes_5_star'
  | 'michelin_3_keys'
  | 'lhw_member'
  | 'relais_chateaux'
  | 'small_luxury_hotels'
  | 'aman'
  | 'belmond'
  | 'rosewood'
  | 'four_seasons'
  | 'ritz_carlton_reserve'
  | 'mandarin_oriental'
  | 'park_hyatt'
  | 'st_regis'
  | 'fairmont'
  | 'world_50_best'
  | 'tl_worlds_best'
  | 'cn_gold_list'
  | 'self_5_star'
  | 'bulgari'
  | 'six_senses'
  | 'ritz_carlton'
  | 'waldorf_astoria'
  | 'peninsula'
  | 'raffles'
  | 'jumeirah'
  | 'kempinski'
  | 'anantara'
  | 'dorchester'
  | 'cheval_blanc'
  | 'como'
  | 'viceroy'
  | 'capella'
  | 'oetker_collection'
  | 'soneva'
  | 'nayara'
  | 'grace_hotels'
  | 'nihi'
  | 'grecotel';

export type Wave = 'A' | 'B' | 'C' | 'D';
export type Priority = 'P1' | 'P2' | 'P3';

export interface ChainMeta {
  readonly tier: LuxuryTier;
  readonly wave: Wave;
  readonly priority: Priority;
  readonly displayName: string;
  /** Canonical search-facet slug (`/recherche?chain=<slug>`). */
  readonly facetSlug: string;
}

const CHAIN_DEFS: ReadonlyArray<{
  readonly aliases: readonly string[];
  readonly meta: ChainMeta;
}> = [
  // Wave A — ultra-luxe, partially in DB
  {
    aliases: ['aman resorts', 'aman', 'aman group'],
    meta: {
      tier: 'aman',
      wave: 'A',
      priority: 'P1',
      displayName: 'Aman Resorts',
      facetSlug: 'aman',
    },
  },
  {
    aliases: ['four seasons hotels & resorts', 'four seasons hotels and resorts', 'four seasons'],
    meta: {
      tier: 'four_seasons',
      wave: 'A',
      priority: 'P1',
      displayName: 'Four Seasons Hotels & Resorts',
      facetSlug: 'four-seasons',
    },
  },
  {
    aliases: ['mandarin oriental', 'mandarin oriental hotel group', 'mandarin oriental hotels'],
    meta: {
      tier: 'mandarin_oriental',
      wave: 'A',
      priority: 'P1',
      displayName: 'Mandarin Oriental',
      facetSlug: 'mandarin-oriental',
    },
  },
  {
    aliases: ['park hyatt', 'park hyatt hotels'],
    meta: {
      tier: 'park_hyatt',
      wave: 'A',
      priority: 'P1',
      displayName: 'Park Hyatt',
      facetSlug: 'park-hyatt',
    },
  },
  {
    aliases: [
      'bulgari hotels & resorts',
      'bulgari hotels and resorts',
      'bulgari hotels',
      'bulgari',
    ],
    meta: {
      tier: 'bulgari',
      wave: 'A',
      priority: 'P1',
      displayName: 'Bulgari Hotels & Resorts',
      facetSlug: 'bulgari',
    },
  },
  {
    aliases: ['six senses hotels resorts spas', 'six senses hotels & resorts', 'six senses'],
    meta: {
      tier: 'six_senses',
      wave: 'A',
      priority: 'P1',
      displayName: 'Six Senses Hotels Resorts Spas',
      facetSlug: 'six-senses',
    },
  },
  {
    aliases: ['rosewood hotels & resorts', 'rosewood hotels and resorts', 'rosewood'],
    meta: {
      tier: 'rosewood',
      wave: 'A',
      priority: 'P1',
      displayName: 'Rosewood Hotels & Resorts',
      facetSlug: 'rosewood',
    },
  },
  {
    aliases: ['belmond hotels', 'belmond'],
    meta: {
      tier: 'belmond',
      wave: 'A',
      priority: 'P1',
      displayName: 'Belmond',
      facetSlug: 'belmond',
    },
  },

  // Wave B — mainstream-premium chains
  {
    aliases: ['ritz-carlton', 'the ritz-carlton', 'ritz carlton', 'the ritz carlton'],
    meta: {
      tier: 'ritz_carlton',
      wave: 'B',
      priority: 'P2',
      displayName: 'The Ritz-Carlton',
      facetSlug: 'ritz-carlton',
    },
  },
  {
    aliases: ['st. regis hotels & resorts', 'st regis hotels and resorts', 'st. regis', 'st regis'],
    meta: {
      tier: 'st_regis',
      wave: 'B',
      priority: 'P2',
      displayName: 'St. Regis Hotels & Resorts',
      facetSlug: 'st-regis',
    },
  },
  {
    aliases: ['kempinski hotels', 'kempinski'],
    meta: {
      tier: 'kempinski',
      wave: 'B',
      priority: 'P2',
      displayName: 'Kempinski Hotels',
      facetSlug: 'kempinski',
    },
  },
  {
    aliases: ['fairmont hotels & resorts', 'fairmont hotels and resorts', 'fairmont'],
    meta: {
      tier: 'fairmont',
      wave: 'B',
      priority: 'P2',
      displayName: 'Fairmont Hotels & Resorts',
      facetSlug: 'fairmont',
    },
  },
  {
    aliases: ['anantara hotels & resorts', 'anantara hotels and resorts', 'anantara'],
    meta: {
      tier: 'anantara',
      wave: 'B',
      priority: 'P2',
      displayName: 'Anantara Hotels & Resorts',
      facetSlug: 'anantara',
    },
  },
  {
    aliases: ['waldorf astoria', 'waldorf astoria hotels & resorts', 'waldorf-astoria'],
    meta: {
      tier: 'waldorf_astoria',
      wave: 'B',
      priority: 'P2',
      displayName: 'Waldorf Astoria',
      facetSlug: 'waldorf-astoria',
    },
  },
  {
    aliases: ['raffles hotels & resorts', 'raffles hotels and resorts', 'raffles'],
    meta: {
      tier: 'raffles',
      wave: 'B',
      priority: 'P2',
      displayName: 'Raffles Hotels & Resorts',
      facetSlug: 'raffles',
    },
  },
  {
    aliases: ['jumeirah hotels & resorts', 'jumeirah hotels and resorts', 'jumeirah'],
    meta: {
      tier: 'jumeirah',
      wave: 'B',
      priority: 'P2',
      displayName: 'Jumeirah Hotels & Resorts',
      facetSlug: 'jumeirah',
    },
  },
  {
    aliases: ['the peninsula hotels', 'peninsula hotels', 'peninsula'],
    meta: {
      tier: 'peninsula',
      wave: 'B',
      priority: 'P2',
      displayName: 'The Peninsula Hotels',
      facetSlug: 'peninsula',
    },
  },
  {
    aliases: ['dorchester collection', 'dorchester'],
    meta: {
      tier: 'dorchester',
      wave: 'B',
      priority: 'P2',
      displayName: 'Dorchester Collection',
      facetSlug: 'dorchester',
    },
  },

  // Wave D — boutique ultra-luxe
  {
    aliases: ['cheval blanc', 'cheval-blanc'],
    meta: {
      tier: 'cheval_blanc',
      wave: 'D',
      priority: 'P1',
      displayName: 'Cheval Blanc',
      facetSlug: 'cheval-blanc',
    },
  },
  {
    aliases: ['como hotels & resorts', 'como hotels and resorts', 'como'],
    meta: {
      tier: 'como',
      wave: 'D',
      priority: 'P2',
      displayName: 'COMO Hotels & Resorts',
      facetSlug: 'como',
    },
  },
  {
    aliases: ['viceroy hotels & resorts', 'viceroy hotels and resorts', 'viceroy'],
    meta: {
      tier: 'viceroy',
      wave: 'D',
      priority: 'P2',
      displayName: 'Viceroy Hotels & Resorts',
      facetSlug: 'viceroy',
    },
  },
  {
    aliases: ['capella hotels & resorts', 'capella hotels and resorts', 'capella'],
    meta: {
      tier: 'capella',
      wave: 'D',
      priority: 'P2',
      displayName: 'Capella Hotels & Resorts',
      facetSlug: 'capella',
    },
  },
  {
    aliases: ['oetker collection', 'oetker'],
    meta: {
      tier: 'oetker_collection',
      wave: 'D',
      priority: 'P1',
      displayName: 'Oetker Collection',
      facetSlug: 'oetker-collection',
    },
  },
  {
    aliases: ['soneva resorts', 'soneva'],
    meta: { tier: 'soneva', wave: 'D', priority: 'P2', displayName: 'Soneva', facetSlug: 'soneva' },
  },
  {
    aliases: ['nayara hotels', 'nayara'],
    meta: {
      tier: 'nayara',
      wave: 'D',
      priority: 'P2',
      displayName: 'Nayara Hotels',
      facetSlug: 'nayara',
    },
  },
  {
    aliases: ['grace hotels', 'grace'],
    meta: {
      tier: 'grace_hotels',
      wave: 'D',
      priority: 'P2',
      displayName: 'Grace Hotels',
      facetSlug: 'grace-hotels',
    },
  },
  {
    aliases: ['nihi hospitality', 'nihi hotels', 'nihi'],
    meta: {
      tier: 'nihi',
      wave: 'D',
      priority: 'P2',
      displayName: 'NIHI Hotels',
      facetSlug: 'nihi',
    },
  },

  // Wave C — boutique-independent / regional national operator (Greece-only)
  // Grecotel = Daskalantonakis Group, ~30 properties across mainland Greece +
  // islands, mixed tiering from 4★ family resorts to 5★ Luxe Me Exclusive
  // Resorts (Cape Sounio is also SLH; Amirandes is a flagship). Scaffolded as
  // P2 / Wave C because the brand carries weak international recognition vs
  // the chains above — individual flagships earn editorial weight, the family-
  // resort tail does not. Editorial review will gate the publishable subset.
  {
    aliases: ['grecotel', 'grecotel hotels & resorts', 'grecotel hotels and resorts'],
    meta: {
      tier: 'grecotel',
      wave: 'C',
      priority: 'P2',
      displayName: 'Grecotel Hotels & Resorts',
      facetSlug: 'grecotel',
    },
  },
];

const ALIAS_LOOKUP: Map<string, ChainMeta> = (() => {
  const m = new Map<string, ChainMeta>();
  for (const def of CHAIN_DEFS) {
    for (const alias of def.aliases) {
      m.set(normalizeChainName(alias), def.meta);
    }
  }
  return m;
})();

export function normalizeChainName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveChain(label: string | null | undefined): ChainMeta | null {
  if (!label) return null;
  const norm = normalizeChainName(label);
  const exact = ALIAS_LOOKUP.get(norm);
  if (exact) return exact;
  // Loose substring fallback for "Four Seasons Hotel George V Paris" etc.
  for (const def of CHAIN_DEFS) {
    for (const alias of def.aliases) {
      const aliasNorm = normalizeChainName(alias);
      if (norm.includes(aliasNorm) && aliasNorm.length >= 6) return def.meta;
    }
  }
  return null;
}

export function getAllChains(): readonly ChainMeta[] {
  return CHAIN_DEFS.map((d) => d.meta);
}

export function getChainByFacetSlug(slug: string): ChainMeta | null {
  for (const def of CHAIN_DEFS) {
    if (def.meta.facetSlug === slug) return def.meta;
  }
  return null;
}
