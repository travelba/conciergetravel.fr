/**
 * axes.ts — canonical taxonomy for the rankings matrice.
 *
 * One source of truth for:
 *   - LLM classification of yonder Tops (`classify-yonder-axes.ts`)
 *   - The combinator that produces our seed rankings
 *     (`combinator.ts`)
 *   - The Supabase JSONB column `editorial_rankings.axes`
 *     (migration 0029)
 *   - The front-end facet UI on `/classements`
 *
 * Adding a value: extend the `as const` tuple, add an `eligibility`
 * predicate next to it (in `combinator.ts`), and run the matrice
 * regeneration. Every step downstream is type-safe via the inferred
 * Zod enum, so an unknown value will fail loudly.
 */

import { z } from 'zod';

// ─── Hotel type ──────────────────────────────────────────────────────────

export const HOTEL_TYPES = [
  'palace',
  '5-etoiles',
  '4-etoiles',
  'boutique-hotel',
  'chateau',
  'chalet',
  'villa',
  'maison-hotes',
  'resort',
  'ecolodge',
  'insolite',
  'all',
] as const;
export type HotelType = (typeof HOTEL_TYPES)[number];

export const HotelTypeSchema = z.enum(HOTEL_TYPES);

// ─── Geographic scope ────────────────────────────────────────────────────

export const LIEU_SCOPES = [
  'france',
  'region',
  'departement',
  'cluster',
  'ville',
  'arrondissement',
  'station',
  'monde',
  'pays',
] as const;
export type LieuScope = (typeof LIEU_SCOPES)[number];

export const LieuScopeSchema = z.enum(LIEU_SCOPES);

/**
 * Canonical lieu identifiers. The slug is what we use in the URL
 * matrice (`/classement/meilleurs-palaces-{lieu}`); the label is the
 * human-readable display string. Adding a lieu requires:
 *   1. Adding the entry below.
 *   2. Wiring its eligibility set in `combinator.ts` (which cities of
 *      the BDD belong to it).
 */
export interface LieuDef {
  readonly slug: string;
  readonly label: string;
  readonly scope: LieuScope;
  /** Cities (lowercase) of the hotel catalog mapping to this lieu. */
  readonly hotelCityKeys: readonly string[];
  /**
   * Optional postal_code prefix(es) used for arrondissement / quartier
   * scoping. When present, a hotel matches this lieu only when its
   * `postal_code` starts with one of the listed prefixes AND its `city`
   * matches `hotelCityKeys`. Used to make Paris-N rankings cite only
   * hotels actually located in arrondissement N (cf. ADR-rankings-axes,
   * May 19, 2026 — A2 Yonder slug alignment).
   */
  readonly postalCodePrefixes?: readonly string[];
  /**
   * Optional ISO 3166-1 alpha-2 country code(s) used to scope a lieu
   * to an entire country (e.g. Mexico, UAE). When present, the lieu
   * matches any hotel whose `country_code` is in the list, regardless
   * of `hotelCityKeys`. This is how `meilleurs-hotels-mexique` or
   * `meilleurs-hotels-emirats-arabes-unis` get every published hotel
   * from MX / AE without enumerating each city. Introduced 2026-05-31
   * to back-fill the 11 international scaffold rankings dropped by
   * the v2 combinator.
   */
  readonly countryCodes?: readonly string[];
}

export const LIEUX: readonly LieuDef[] = [
  // National.
  {
    slug: 'france',
    label: 'France',
    scope: 'france',
    hotelCityKeys: [],
  },

  // Clusters (multi-city editorial groupings).
  {
    slug: 'paris',
    label: 'Paris',
    scope: 'ville',
    hotelCityKeys: ['paris'],
  },
  {
    slug: 'cote-d-azur',
    label: "Côte d'Azur",
    scope: 'cluster',
    hotelCityKeys: [
      'cannes',
      'nice',
      'antibes',
      "cap d'antibes",
      'cap-d-antibes',
      'saint-jean-cap-ferrat',
      'cap-ferrat',
      'menton',
      'eze',
      'saint-tropez',
      'ramatuelle',
      'monaco',
      'monte-carlo',
      'beaulieu-sur-mer',
      'roquebrune-cap-martin',
    ],
  },
  {
    slug: 'french-riviera',
    label: 'French Riviera',
    scope: 'cluster',
    hotelCityKeys: [
      'cannes',
      'nice',
      'antibes',
      "cap d'antibes",
      'cap-d-antibes',
      'saint-jean-cap-ferrat',
      'cap-ferrat',
      'menton',
    ],
  },
  {
    slug: 'provence',
    label: 'Provence',
    scope: 'cluster',
    hotelCityKeys: [
      'le puy-sainte-réparade',
      'gordes',
      'lourmarin',
      'ménerbes',
      'menerbes',
      'aix-en-provence',
      'avignon',
      'arles',
      'baux-de-provence',
      'les baux-de-provence',
      'saint-rémy-de-provence',
    ],
  },
  {
    slug: 'alpilles',
    label: 'Alpilles',
    scope: 'cluster',
    hotelCityKeys: [
      'baux-de-provence',
      'les baux-de-provence',
      'saint-rémy-de-provence',
      'maussane',
      'eygalières',
    ],
  },
  {
    slug: 'luberon',
    label: 'Luberon',
    scope: 'cluster',
    hotelCityKeys: ['gordes', 'lourmarin', 'ménerbes', 'menerbes', 'bonnieux'],
  },
  {
    slug: 'alpes',
    label: 'Alpes',
    scope: 'cluster',
    hotelCityKeys: [
      'courchevel',
      'megève',
      'megeve',
      "val d'isère",
      "val d'isere",
      'chamonix',
      'chamonix-mont-blanc',
      'tignes',
      'val thorens',
      "l'alpe d'huez",
      'avoriaz',
      'morzine',
      'meribel',
    ],
  },
  {
    slug: 'corse',
    label: 'Corse',
    scope: 'region',
    hotelCityKeys: ['porto-vecchio', 'calvi', 'ajaccio', 'bonifacio', 'sartene'],
  },
  {
    slug: 'bordeaux',
    label: 'Bordeaux',
    scope: 'cluster',
    hotelCityKeys: ['bordeaux', 'martillac', 'saint-emilion', 'saint-émilion', 'pauillac'],
  },
  {
    slug: 'champagne',
    label: 'Champagne',
    scope: 'cluster',
    hotelCityKeys: ['reims', 'épernay', 'epernay', 'champillon'],
  },
  {
    slug: 'bretagne',
    label: 'Bretagne',
    scope: 'region',
    hotelCityKeys: ['rennes', 'nantes', 'saint-malo', 'dinard', 'quimper'],
  },
  {
    slug: 'normandie',
    label: 'Normandie',
    scope: 'region',
    hotelCityKeys: ['deauville', 'cabourg', 'honfleur', 'rouen', 'caen'],
  },
  {
    slug: 'pays-basque',
    label: 'Pays basque',
    scope: 'cluster',
    hotelCityKeys: ['biarritz', 'saint-jean-de-luz', 'bayonne', 'hendaye'],
  },
  {
    slug: 'loire',
    label: 'Châteaux de la Loire',
    scope: 'cluster',
    hotelCityKeys: ['tours', 'amboise', 'chinon', 'blois', 'orleans'],
  },
  {
    slug: 'alsace',
    label: 'Alsace',
    scope: 'region',
    hotelCityKeys: ['strasbourg', 'colmar', 'eguisheim', 'kaysersberg', 'ribeauvillé'],
  },

  // Cities (single-locality, often arrondissement-level).
  {
    slug: 'cannes',
    label: 'Cannes',
    scope: 'ville',
    hotelCityKeys: ['cannes'],
  },
  {
    slug: 'nice',
    label: 'Nice',
    scope: 'ville',
    hotelCityKeys: ['nice'],
  },
  {
    slug: 'saint-tropez',
    label: 'Saint-Tropez',
    scope: 'ville',
    hotelCityKeys: ['saint-tropez', 'ramatuelle', 'gassin'],
  },
  {
    slug: 'cap-ferrat',
    label: 'Cap-Ferrat',
    scope: 'ville',
    hotelCityKeys: ['saint-jean-cap-ferrat', 'cap-ferrat'],
  },
  {
    slug: 'cap-d-antibes',
    label: "Cap d'Antibes",
    scope: 'ville',
    hotelCityKeys: ["cap d'antibes", 'cap-d-antibes', 'antibes'],
  },
  {
    slug: 'biarritz',
    label: 'Biarritz',
    scope: 'ville',
    hotelCityKeys: ['biarritz'],
  },
  {
    slug: 'megeve',
    label: 'Megève',
    scope: 'station',
    hotelCityKeys: ['megève', 'megeve'],
  },
  {
    slug: 'courchevel',
    label: 'Courchevel',
    scope: 'station',
    hotelCityKeys: ['courchevel'],
  },
  {
    slug: 'val-d-isere',
    label: "Val d'Isère",
    scope: 'station',
    hotelCityKeys: ["val d'isère", "val d'isere"],
  },
  {
    slug: 'chamonix',
    label: 'Chamonix',
    scope: 'station',
    hotelCityKeys: ['chamonix', 'chamonix-mont-blanc'],
  },
  {
    slug: 'meribel',
    label: 'Méribel',
    scope: 'station',
    hotelCityKeys: ['meribel', 'méribel'],
  },
  {
    slug: 'tignes',
    label: 'Tignes',
    scope: 'station',
    hotelCityKeys: ['tignes'],
  },
  {
    slug: 'reims',
    label: 'Reims',
    scope: 'ville',
    hotelCityKeys: ['reims'],
  },
  {
    slug: 'monaco',
    label: 'Monaco',
    scope: 'ville',
    hotelCityKeys: ['monaco', 'monte-carlo'],
  },
  {
    slug: 'deauville',
    label: 'Deauville',
    scope: 'ville',
    hotelCityKeys: ['deauville'],
  },

  // ─── A2 (May 19, 2026) — additional regions, clusters, cities and
  //     Paris arrondissements / named neighbourhoods. Introduced to
  //     align our matrice slugs with the 58+ Yonder rankings imported
  //     overnight, while keeping eligibility filtering precise (via
  //     postal_code) for Paris quartier-level pages.

  // Missing regions + clusters.
  {
    slug: 'bourgogne',
    label: 'Bourgogne',
    scope: 'region',
    hotelCityKeys: [
      'beaune',
      'dijon',
      'pommard',
      'vougeot',
      'nuits-saint-georges',
      'meursault',
      'chablis',
      'gevrey-chambertin',
      'puligny-montrachet',
      'levernois',
    ],
  },
  {
    slug: 'centre-val-de-loire',
    label: 'Centre-Val de Loire',
    scope: 'region',
    hotelCityKeys: [
      'tours',
      'amboise',
      'blois',
      'chambord',
      'orleans',
      'orléans',
      'cheverny',
      'chinon',
      'azay-le-rideau',
      'chenonceaux',
    ],
  },
  {
    slug: 'sud-ouest',
    label: 'Sud-Ouest',
    scope: 'cluster',
    hotelCityKeys: [
      'biarritz',
      'bordeaux',
      'saint-jean-de-luz',
      'bayonne',
      'hossegor',
      'soorts-hossegor',
      'martillac',
      'saint-emilion',
      'saint-émilion',
      'pauillac',
      'cognac',
      'arcachon',
      'cap ferret',
      'cap-ferret',
    ],
  },
  {
    slug: 'cote-atlantique',
    label: 'Côte Atlantique',
    scope: 'cluster',
    hotelCityKeys: [
      'la baule',
      'la baule-escoublac',
      'la rochelle',
      'arcachon',
      'cap ferret',
      'cap-ferret',
      'sables-d-olonne',
      'les sables-d-olonne',
      'biarritz',
      'hossegor',
      'soorts-hossegor',
    ],
  },
  {
    slug: 'ile-de-france',
    label: 'Île-de-France',
    scope: 'region',
    hotelCityKeys: [
      'versailles',
      'fontainebleau',
      'chantilly',
      'barbizon',
      'bonnelles',
      'rambouillet',
      'gif-sur-yvette',
      'saint-germain-en-laye',
      'auvers-sur-oise',
      'magny-en-vexin',
      'la roche-guyon',
    ],
  },
  {
    slug: 'sologne',
    label: 'Sologne',
    scope: 'cluster',
    hotelCityKeys: [
      'cheverny',
      'romorantin',
      'romorantin-lanthenay',
      'sully-sur-loire',
      'la ferté-saint-aubin',
      'chambord',
    ],
  },
  {
    slug: 'vexin',
    label: 'Vexin',
    scope: 'cluster',
    hotelCityKeys: ['magny-en-vexin', 'la roche-guyon', 'giverny', 'vetheuil', 'vétheuil'],
  },
  {
    slug: 'lac-leman',
    label: 'Lac Léman',
    scope: 'cluster',
    // Le Léman s'étend sur les deux rives ; l'inventaire luxe publié est
    // côté suisse (Genève, Lausanne, Montreux, Vevey). On conserve les
    // villes françaises du Chablais pour le jour où leurs hôtels publient.
    hotelCityKeys: [
      'évian',
      'evian',
      'évian-les-bains',
      'evian-les-bains',
      'thonon-les-bains',
      'yvoire',
      'geneva',
      'genève',
      'geneve',
      'genève-satigny',
      'lausanne',
      'montreux',
      'vevey',
      // NB: surtout pas 'nyon' — le matcher `.includes` du combinator
      // le ferait matcher "Canyon Point" (Amangiri) et "Colca Canyon"
      // (Belmond). Aucun hôtel publié à Nyon de toute façon.
    ],
  },

  // Missing cities (regional capitals + Yonder Tops anchors).
  {
    slug: 'colmar',
    label: 'Colmar',
    scope: 'ville',
    hotelCityKeys: ['colmar'],
  },
  {
    slug: 'dijon',
    label: 'Dijon',
    scope: 'ville',
    hotelCityKeys: ['dijon'],
  },
  {
    slug: 'lyon',
    label: 'Lyon',
    scope: 'ville',
    hotelCityKeys: ['lyon'],
  },
  {
    slug: 'tours',
    label: 'Tours',
    scope: 'ville',
    hotelCityKeys: ['tours'],
  },
  {
    slug: 'chantilly',
    label: 'Chantilly',
    scope: 'ville',
    hotelCityKeys: ['chantilly'],
  },
  {
    slug: 'bordeaux-ville',
    label: 'Bordeaux ville',
    scope: 'ville',
    hotelCityKeys: ['bordeaux'],
  },

  // Paris arrondissements (proper filtering via postal_code prefix).
  // Only emit those referenced by Yonder slugs; the others can be
  // added as the catalog gains coverage.
  {
    slug: 'paris-1',
    label: 'Paris 1er',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75001'],
  },
  {
    slug: 'paris-2',
    label: 'Paris 2e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75002'],
  },
  {
    slug: 'paris-3',
    label: 'Paris 3e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75003'],
  },
  {
    slug: 'paris-4',
    label: 'Paris 4e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75004'],
  },
  {
    slug: 'paris-5',
    label: 'Paris 5e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75005'],
  },
  {
    slug: 'paris-6',
    label: 'Paris 6e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75006'],
  },
  {
    slug: 'paris-7',
    label: 'Paris 7e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75007'],
  },
  {
    slug: 'paris-8',
    label: 'Paris 8e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75008'],
  },
  {
    slug: 'paris-9',
    label: 'Paris 9e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75009'],
  },
  {
    slug: 'paris-11',
    label: 'Paris 11e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75011'],
  },
  {
    slug: 'paris-12',
    label: 'Paris 12e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75012'],
  },
  {
    slug: 'paris-13',
    label: 'Paris 13e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75013'],
  },
  {
    slug: 'paris-15',
    label: 'Paris 15e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75015'],
  },
  {
    slug: 'paris-16',
    label: 'Paris 16e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75016', '75116'],
  },
  {
    slug: 'paris-17',
    label: 'Paris 17e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75017'],
  },
  {
    slug: 'paris-18',
    label: 'Paris 18e',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75018'],
  },

  // Paris named quartiers — each maps to one or two arrondissements
  // via postal_code prefix. Slug stays as the Yonder vernacular term
  // (Marais, Montmartre…) for SEO; eligibility is the underlying arrdt.
  {
    slug: 'marais',
    label: 'Le Marais (Paris)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75003', '75004'],
  },
  {
    slug: 'montmartre',
    label: 'Montmartre (Paris 18e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75018'],
  },
  {
    slug: 'champs-elysees',
    label: 'Champs-Élysées (Paris 8e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75008'],
  },
  {
    slug: 'quartier-latin',
    label: 'Quartier Latin (Paris 5e–6e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75005', '75006'],
  },
  {
    slug: 'bastille',
    label: 'Bastille (Paris 11e–12e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75011', '75012', '75004'],
  },
  {
    slug: 'bercy',
    label: 'Bercy (Paris 12e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75012'],
  },
  {
    slug: 'gare-de-lyon',
    label: 'Gare de Lyon (Paris 12e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75012'],
  },
  {
    slug: 'tour-eiffel',
    label: 'Tour Eiffel (Paris 7e)',
    scope: 'arrondissement',
    hotelCityKeys: ['paris'],
    postalCodePrefixes: ['75007', '75015', '75016'],
  },

  // ─── 2026-05-31 — International scope (countries + iconic cities)
  // Required to back-fill the 11 international scaffold rankings created
  // by `scaffold-guides-rankings-intl.ts` whose slugs were not in the
  // v2 matrix. Country scope uses `countryCodes`; city scope uses the
  // standard `hotelCityKeys` flow.
  {
    slug: 'mexique',
    label: 'Mexique',
    scope: 'pays',
    hotelCityKeys: [],
    countryCodes: ['MX'],
  },
  {
    slug: 'emirats-arabes-unis',
    label: 'Émirats arabes unis',
    scope: 'pays',
    hotelCityKeys: [],
    countryCodes: ['AE'],
  },
  {
    slug: 'rome',
    label: 'Rome',
    scope: 'ville',
    hotelCityKeys: ['rome', 'roma'],
  },
  {
    slug: 'venise',
    label: 'Venise',
    scope: 'ville',
    hotelCityKeys: ['venise', 'venice', 'venezia'],
  },
  {
    slug: 'prague',
    label: 'Prague',
    scope: 'ville',
    hotelCityKeys: ['prague'],
  },
];

export const LIEU_SLUGS = LIEUX.map((l) => l.slug) as readonly string[];

// ─── Themes (12 canonical) ───────────────────────────────────────────────

export const THEMES = [
  'romantique',
  'famille',
  'spa-bienetre',
  'gastronomie',
  'design',
  'patrimoine',
  'vignobles',
  'mer',
  'montagne',
  'campagne',
  'urbain',
  'sport-golf',
  'sport-tennis',
  'sport-padel',
  'sport-surf',
  'sport-ski',
  'rooftop',
  'piscine',
  'kids-friendly',
  'insolite',
] as const;
export type Theme = (typeof THEMES)[number];

export const ThemeSchema = z.enum(THEMES);

// ─── Occasions (broader than themes — what's the trip purpose) ────────────

export const OCCASIONS = [
  'week-end',
  'lune-de-miel',
  'anniversaire',
  'seminaire',
  'mariage',
  'escapade',
  'staycation',
  'fetes',
  'minceur',
] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const OccasionSchema = z.enum(OCCASIONS);

// ─── Saison (when does this ranking apply best) ──────────────────────────

export const SAISONS = ['ete', 'hiver', 'printemps', 'automne', 'toute-annee'] as const;
export type Saison = (typeof SAISONS)[number];

export const SaisonSchema = z.enum(SAISONS);

// ─── Aggregated axes object (the JSONB column shape) ─────────────────────

export const RankingAxesSchema = z.object({
  types: z.array(HotelTypeSchema).default([]),
  lieu: z.object({
    scope: LieuScopeSchema,
    slug: z.string(),
    label: z.string(),
  }),
  themes: z.array(ThemeSchema).default([]),
  occasions: z.array(OccasionSchema).default([]),
  saison: SaisonSchema.default('toute-annee'),
});
export type RankingAxes = z.infer<typeof RankingAxesSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────

export function findLieuBySlug(slug: string): LieuDef | null {
  return LIEUX.find((l) => l.slug === slug) ?? null;
}

/**
 * Resolve a free-form lieu identifier (LLM-emitted, could be any
 * normalized lower-case string) to a known lieu in our taxonomy.
 * Returns the canonical entry OR null if unknown.
 *
 * Try in order:
 *   1. Exact slug match.
 *   2. Label normalized match.
 *   3. Heuristic: contains known city key.
 */
export function resolveLieu(raw: string): LieuDef | null {
  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const exact = LIEUX.find((l) => l.slug === norm);
  if (exact !== undefined) return exact;
  const byLabel = LIEUX.find(
    (l) =>
      l.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-') === norm,
  );
  if (byLabel !== undefined) return byLabel;
  for (const l of LIEUX) {
    for (const ck of l.hotelCityKeys) {
      if (norm === ck || norm.includes(ck) || ck.includes(norm)) return l;
    }
  }
  return null;
}
