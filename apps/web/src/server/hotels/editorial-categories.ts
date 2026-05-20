import 'server-only';

import type { PublishedHotelIndexCard } from '@/server/hotels/get-hotel-by-slug';

/**
 * Editorial categories surfaced as `/categorie/[slug]` landing pages
 * (skill: seo-technical §Maillage + content-modeling).
 *
 * Each category is a pure predicate over `PublishedHotelIndexCard`,
 * so the entire categorization runs in-memory from the single
 * `listPublishedHotelsForIndex()` query — no extra Supabase round-trip
 * per category page.
 *
 * Slugs are stable URL keys (kebab-case, ASCII). Labels are localized
 * at render-time by the page-level `T` table.
 */
export interface EditorialCategory {
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly metaTitleFr: string;
  readonly metaTitleEn: string;
  readonly metaDescFr: string;
  readonly metaDescEn: string;
  readonly h1Fr: string;
  readonly h1En: string;
  readonly subtitleFr: (n: number) => string;
  readonly subtitleEn: (n: number) => string;
  readonly match: (h: PublishedHotelIndexCard) => boolean;
}

const PARIS_DEPTS = new Set(['paris', 'paris (75)', '75', 'île-de-france', 'ile-de-france']);

const MOUNTAIN_REGIONS = new Set([
  'auvergne-rhône-alpes',
  'auvergne-rhone-alpes',
  'savoie',
  'haute-savoie',
  'isère',
  'isere',
]);
const MOUNTAIN_CITIES = new Set([
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
  'lalpe-dhuez',
  'avoriaz',
  'morzine',
  'les gets',
]);

const COAST_REGIONS = new Set([
  "provence-alpes-côte d'azur",
  "provence-alpes-cote d'azur",
  'provence-alpes-cote-dazur',
  'corse',
]);
const COAST_CITIES = new Set([
  'cannes',
  'nice',
  'saint-jean-cap-ferrat',
  'cap-ferrat',
  'antibes',
  'menton',
  'monte-carlo',
  'monaco',
  'saint-tropez',
  'ramatuelle',
  'eze',
  'èze',
  'biarritz',
  'le touquet',
  'le-touquet-paris-plage',
  'la rochelle',
  'arcachon',
  'la-baule',
  'la baule',
  'deauville',
  'porto-vecchio',
  'calvi',
  'ajaccio',
]);

const VINEYARD_CITIES = new Set([
  'bordeaux',
  'martillac',
  'saint-emilion',
  'saint-émilion',
  'pauillac',
  'beaune',
  'reims',
  'épernay',
  'epernay',
]);

function lower(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Editorial categories — order matters for the `/categorie` directory
 * (lands them in this order). Each predicate is total over the index
 * card type so the matcher never throws.
 *
 * ## Layout
 *
 * 1. 5 categories Palace-only (kept from the launch — they remain the
 *    editorial pillar of the brand).
 * 2. 7 new categories by hotel TYPE (ADR-0016) — open the brand to
 *    non-Palace hotels of exception (5★, 4★, boutique, château,
 *    chalet, villa, maison d'hôtes).
 *
 * Type predicates are heuristic-based on the published name (the
 * `PublishedHotelIndexCard` does not yet carry tags). The heuristics
 * are transitional — when Payload exposes per-hotel `type` tags, the
 * predicates collapse to `h.tags.includes('...')`.
 */
export const EDITORIAL_CATEGORIES: readonly EditorialCategory[] = [
  {
    slug: 'palaces-paris',
    labelFr: 'Palaces parisiens',
    labelEn: 'Parisian Palaces',
    h1Fr: 'Les Palaces parisiens',
    h1En: 'The Parisian Palaces',
    metaTitleFr: 'Palaces parisiens — Sélection MyConciergeHotel',
    metaTitleEn: 'Parisian Palaces — MyConciergeHotel selection',
    metaDescFr:
      'Découvrez la sélection MyConciergeHotel des Palaces parisiens distingués par Atout France : Plaza Athénée, Le Bristol, Le Meurice, Ritz, Crillon, Cheval Blanc, George V…',
    metaDescEn:
      'Discover the MyConciergeHotel selection of Parisian Palaces distinguished by Atout France: Plaza Athénée, Le Bristol, Le Meurice, Ritz, Crillon, Cheval Blanc, George V…',
    subtitleFr: (n) =>
      `${n} adresses parisiennes distinguées par la mention Palace d'Atout France — la conciergerie MyConciergeHotel vous accompagne pour réserver l'expérience à 360°.`,
    subtitleEn: (n) =>
      `${n} Parisian addresses awarded the Palace distinction by Atout France — MyConciergeHotel concierges assist you with a 360° booking experience.`,
    match: (h) => h.isPalace && PARIS_DEPTS.has(lower(h.city)),
  },
  {
    slug: 'palaces-montagne',
    labelFr: 'Palaces à la montagne',
    labelEn: 'Mountain Palaces',
    h1Fr: 'Les Palaces de montagne',
    h1En: 'Mountain Palaces',
    metaTitleFr: 'Palaces à la montagne (Alpes) — MyConciergeHotel',
    metaTitleEn: 'Mountain Palaces (French Alps) — MyConciergeHotel',
    metaDescFr:
      "Sélection MyConciergeHotel des Palaces des Alpes : Courchevel, Megève, Val d'Isère, Chamonix — Cheval Blanc Courchevel, Les Airelles, Le Strato, Four Seasons Megève…",
    metaDescEn:
      "MyConciergeHotel selection of French Alps Palaces: Courchevel, Megève, Val d'Isère, Chamonix — Cheval Blanc, Les Airelles, Le Strato, Four Seasons Megève…",
    subtitleFr: (n) =>
      `${n} Palaces des Alpes françaises — séjours ski-in / ski-out, spas après-ski et tables Michelin au cœur des massifs.`,
    subtitleEn: (n) =>
      `${n} Palaces in the French Alps — ski-in / ski-out stays, après-ski spas and Michelin tables in the heart of the massifs.`,
    match: (h) =>
      h.isPalace && (MOUNTAIN_REGIONS.has(lower(h.region)) || MOUNTAIN_CITIES.has(lower(h.city))),
  },
  {
    slug: 'palaces-bord-de-mer',
    labelFr: 'Palaces en bord de mer',
    labelEn: 'Seafront Palaces',
    h1Fr: 'Les Palaces en bord de mer',
    h1En: 'Seafront Palaces',
    metaTitleFr: "Palaces de la Côte d'Azur & bord de mer — MyConciergeHotel",
    metaTitleEn: 'French Riviera & seafront Palaces — MyConciergeHotel',
    metaDescFr:
      "Sélection MyConciergeHotel des Palaces côte de mer : Côte d'Azur, Atlantique, Corse — Eden-Roc, Grand-Hôtel du Cap-Ferrat, La Réserve Ramatuelle, Hôtel du Palais Biarritz…",
    metaDescEn:
      'MyConciergeHotel selection of seafront Palaces: French Riviera, Atlantic coast, Corsica — Eden-Roc, Grand-Hôtel du Cap-Ferrat, La Réserve Ramatuelle, Hôtel du Palais Biarritz…',
    subtitleFr: (n) =>
      `${n} Palaces les pieds dans l'eau — adresses iconiques de la Côte d'Azur, du Bassin d'Arcachon, du Pays basque et de Corse.`,
    subtitleEn: (n) =>
      `${n} seafront Palaces — iconic addresses on the French Riviera, Atlantic coast, Basque country and Corsica.`,
    match: (h) =>
      h.isPalace && (COAST_REGIONS.has(lower(h.region)) || COAST_CITIES.has(lower(h.city))),
  },
  {
    slug: 'palaces-vignobles',
    labelFr: 'Palaces & vignobles',
    labelEn: 'Vineyard Palaces',
    h1Fr: 'Les Palaces des vignobles',
    h1En: 'Vineyard Palaces',
    metaTitleFr: 'Palaces des vignobles français — MyConciergeHotel',
    metaTitleEn: 'Palaces in French vineyards — MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des Palaces des grandes régions viticoles : Bordeaux, Champagne, Bourgogne — Les Sources de Caudalie, Château Léoube, Domaine des Crayères…',
    metaDescEn:
      'MyConciergeHotel selection of Palaces in the great wine regions: Bordeaux, Champagne, Burgundy — Les Sources de Caudalie, Château Léoube, Domaine des Crayères…',
    subtitleFr: (n) =>
      `${n} Palaces ancrés dans les terroirs viticoles français — œnotourisme, gastronomie et art de vivre.`,
    subtitleEn: (n) =>
      `${n} Palaces rooted in the great French wine terroirs — wine tourism, gastronomy and the art of living.`,
    match: (h) => h.isPalace && VINEYARD_CITIES.has(lower(h.city)),
  },
  {
    slug: 'palaces-france',
    labelFr: 'Tous les Palaces de France',
    labelEn: 'All Palaces in France',
    h1Fr: 'Les Palaces distingués par Atout France',
    h1En: 'Palaces distinguished by Atout France',
    metaTitleFr: 'Tous les Palaces de France (mention Atout France) — MyConciergeHotel',
    metaTitleEn: 'All French Palaces (Atout France distinction) — MyConciergeHotel',
    metaDescFr:
      "La sélection complète MyConciergeHotel des Palaces français distingués par la mention officielle Atout France — Paris, Côte d'Azur, Alpes, Provence, Aquitaine.",
    metaDescEn:
      "MyConciergeHotel's complete selection of French Palaces awarded the official Atout France distinction — Paris, French Riviera, Alps, Provence, Aquitaine.",
    subtitleFr: (n) =>
      `${n} adresses régulées par la mention Palace d'Atout France — la plus haute distinction hôtelière française, accordée à seulement ~30 propriétés dans tout le pays.`,
    subtitleEn: (n) =>
      `${n} addresses awarded the Palace distinction by Atout France — the highest French hotel distinction, granted to only ~30 properties nationwide.`,
    match: (h) => h.isPalace,
  },

  // ─── ADR-0016 — Non-Palace categories (by hotel TYPE) ───────────────────
  // Heuristic-based predicates over the published name + city + stars.
  // Will collapse to `h.tags.includes(...)` once Payload exposes tags.

  {
    slug: 'hotels-5-etoiles',
    labelFr: 'Hôtels 5 étoiles',
    labelEn: '5-Star Hotels',
    h1Fr: 'Les hôtels 5 étoiles d’exception',
    h1En: 'Exceptional 5-Star Hotels',
    metaTitleFr: 'Hôtels 5 étoiles en France — Sélection MyConciergeHotel',
    metaTitleEn: '5-Star Hotels in France — MyConciergeHotel selection',
    metaDescFr:
      'Sélection éditoriale des hôtels 5 étoiles en France — adresses 5★ non-Palace mais hautement recommandées par notre conciergerie : Côte d’Azur, Paris, Provence, Alpes, Bordelais.',
    metaDescEn:
      "MyConciergeHotel's selection of 5-star hotels in France — non-Palace 5★ addresses highly recommended by our concierge desk: French Riviera, Paris, Provence, Alps, Bordeaux.",
    subtitleFr: (n) =>
      `${n} hôtels 5 étoiles français sélectionnés au-delà des Palaces — adresses raffinées, services attentifs, tables de qualité.`,
    subtitleEn: (n) =>
      `${n} French 5-star hotels selected beyond the Palaces — refined addresses, attentive service, fine dining.`,
    match: (h) => h.stars === 5 && !h.isPalace,
  },

  {
    slug: 'hotels-4-etoiles',
    labelFr: 'Hôtels 4 étoiles',
    labelEn: '4-Star Hotels',
    h1Fr: 'Les meilleurs hôtels 4 étoiles',
    h1En: 'The Best 4-Star Hotels',
    metaTitleFr: 'Hôtels 4 étoiles premium en France — MyConciergeHotel',
    metaTitleEn: 'Premium 4-Star Hotels in France — MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des hôtels 4 étoiles premium en France — adresses élégantes en ville comme au vert, idéales pour un séjour soigné sans tarif Palace.',
    metaDescEn:
      'MyConciergeHotel selection of premium 4-star hotels in France — elegant addresses in cities and the countryside, ideal for a refined stay without Palace pricing.',
    subtitleFr: (n) =>
      `${n} hôtels 4 étoiles soigneusement choisis par notre conciergerie — rapport prestige/prix optimisé, charme français.`,
    subtitleEn: (n) =>
      `${n} carefully selected 4-star hotels — best value-prestige ratio, French charm.`,
    match: (h) => h.stars === 4,
  },

  {
    slug: 'boutique-hotels',
    labelFr: 'Boutique-hôtels',
    labelEn: 'Boutique Hotels',
    h1Fr: 'Boutique-hôtels d’exception en France',
    h1En: 'Exceptional Boutique Hotels in France',
    metaTitleFr: 'Boutique-hôtels en France — Sélection MyConciergeHotel',
    metaTitleEn: 'Boutique Hotels in France — MyConciergeHotel selection',
    metaDescFr:
      'Sélection MyConciergeHotel des boutique-hôtels français — adresses confidentielles, identité forte, à taille humaine. Paris, Côte d’Azur, Provence, Alpes.',
    metaDescEn:
      'MyConciergeHotel selection of French boutique hotels — confidential addresses, strong identity, human scale. Paris, French Riviera, Provence, Alps.',
    subtitleFr: (n) =>
      `${n} boutique-hôtels français — moins de 50 chambres, une signature, un secret bien gardé du Concierge.`,
    subtitleEn: (n) =>
      `${n} French boutique hotels — fewer than 50 rooms, a strong signature, a well-kept Concierge secret.`,
    match: (h) =>
      !h.isPalace &&
      (/\bboutique\b/iu.test(h.nameFr) || (h.nameEn !== null && /\bboutique\b/iu.test(h.nameEn))),
  },

  {
    slug: 'chateaux-hotels',
    labelFr: 'Châteaux-hôtels',
    labelEn: 'Château Hotels',
    h1Fr: 'Châteaux-hôtels en France',
    h1En: 'Château Hotels in France',
    metaTitleFr: 'Châteaux-hôtels en France — MyConciergeHotel',
    metaTitleEn: 'Château Hotels in France — MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des châteaux-hôtels français — séjours dans les demeures historiques de la Loire, du Bordelais, de Bourgogne et au-delà.',
    metaDescEn:
      'MyConciergeHotel selection of French château hotels — historic estates in the Loire Valley, Bordeaux, Burgundy and beyond.',
    subtitleFr: (n) =>
      `${n} châteaux français devenus hôtels d’exception — dormir dans l’histoire, dîner sous des plafonds peints.`,
    subtitleEn: (n) =>
      `${n} French châteaux turned hotels of exception — sleep within history, dine under painted ceilings.`,
    match: (h) =>
      /ch[âa]teau/iu.test(h.nameFr) || (h.nameEn !== null && /ch[âa]teau/iu.test(h.nameEn)),
  },

  {
    slug: 'chalets-luxe',
    labelFr: 'Chalets de luxe',
    labelEn: 'Luxury Chalets',
    h1Fr: 'Chalets de luxe dans les Alpes',
    h1En: 'Luxury Chalets in the French Alps',
    metaTitleFr: 'Chalets de luxe — Alpes françaises | MyConciergeHotel',
    metaTitleEn: 'Luxury Chalets — French Alps | MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des chalets de luxe dans les Alpes : Courchevel, Megève, Val d’Isère, Chamonix. Ski-in/ski-out, services Palace, expérience montagne.',
    metaDescEn:
      'MyConciergeHotel selection of luxury chalets in the French Alps: Courchevel, Megève, Val d’Isère, Chamonix. Ski-in/ski-out, Palace-level service, mountain experience.',
    subtitleFr: (n) =>
      `${n} chalets d’altitude — ski-in/ski-out, sauna privé, après-ski signé par les meilleurs chefs alpins.`,
    subtitleEn: (n) =>
      `${n} alpine chalets — ski-in/ski-out, private sauna, après-ski signed by the finest alpine chefs.`,
    match: (h) =>
      /\bchalet\b/iu.test(h.nameFr) || (h.nameEn !== null && /\bchalet\b/iu.test(h.nameEn)),
  },

  {
    slug: 'villas',
    labelFr: 'Villas privées',
    labelEn: 'Private Villas',
    h1Fr: 'Villas privées d’exception',
    h1En: 'Exceptional Private Villas',
    metaTitleFr: 'Villas privées en France — MyConciergeHotel',
    metaTitleEn: 'Private Villas in France — MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des villas privées avec services hôteliers : Côte d’Azur, Provence, Corse, Pays basque. Concierge dédié, piscine, intimité.',
    metaDescEn:
      'MyConciergeHotel selection of private villas with hotel-grade services: French Riviera, Provence, Corsica, Basque Country. Dedicated concierge, pool, intimacy.',
    subtitleFr: (n) =>
      `${n} villas privées sélectionnées — intimité d’une maison, services d’un Palace.`,
    subtitleEn: (n) =>
      `${n} selected private villas — the privacy of a home, the services of a Palace.`,
    match: (h) =>
      /\bvilla\b/iu.test(h.nameFr) || (h.nameEn !== null && /\bvilla\b/iu.test(h.nameEn)),
  },

  {
    slug: 'maisons-hotes',
    labelFr: "Maisons d'hôtes",
    labelEn: 'Guesthouses',
    h1Fr: 'Maisons d’hôtes d’exception en France',
    h1En: 'Exceptional Guesthouses in France',
    metaTitleFr: 'Maisons d’hôtes d’exception en France — MyConciergeHotel',
    metaTitleEn: 'Exceptional Guesthouses in France — MyConciergeHotel',
    metaDescFr:
      'Sélection MyConciergeHotel des maisons d’hôtes haut de gamme en France — adresses confidentielles, table d’hôte, accueil personnalisé par les propriétaires.',
    metaDescEn:
      'MyConciergeHotel selection of upscale French guesthouses — confidential addresses, table d’hôte, personalized welcome by the owners.',
    subtitleFr: (n) =>
      `${n} maisons d’hôtes premium — la rencontre des propriétaires, une table commune, une adresse rare.`,
    subtitleEn: (n) =>
      `${n} premium guesthouses — meet the owners, share the table, discover a rare address.`,
    match: (h) =>
      !h.isPalace &&
      (/\bmaison\s+d['’]?h[oô]tes?\b|\bdomaine\b/iu.test(h.nameFr) ||
        (h.nameEn !== null && /\bguesthouse\b|\bdomain\b/iu.test(h.nameEn))),
  },
];

export function findCategory(slug: string): EditorialCategory | null {
  for (const c of EDITORIAL_CATEGORIES) {
    if (c.slug === slug) return c;
  }
  return null;
}

export function filterCategory(
  hotels: readonly PublishedHotelIndexCard[],
  category: EditorialCategory,
): readonly PublishedHotelIndexCard[] {
  return hotels.filter((h) => category.match(h));
}
