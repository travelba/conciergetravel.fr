/**
 * Demo / fallback data for v2 prototypes when Supabase is unavailable.
 * Replace with read-models from `v2.*` schema in production wiring.
 */

export type DemoHotelEditorialSection = {
  readonly anchor: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
};

export type DemoHotelFaqItem = {
  readonly question: string;
  readonly answer: string;
};

export type DemoHotel = {
  slug: string;
  name: string;
  stars: number;
  city: string;
  country: string;
  countrySlug: string;
  citySlug: string;
  district: string;
  distanceLabel: string;
  ratingScoreOutOfTen: number;
  reviewCount: number;
  editorialBadge?: string;
  highlights: string[];
  heroImage: string;
  photos: Array<{ id: string; alt: string; src: string }>;
  description: string;
  conciergeAdvice: string;
  editorialSections: readonly DemoHotelEditorialSection[];
  faq: readonly DemoHotelFaqItem[];
  publicPriceMinor: number;
  memberPriceMinor: number;
  rooms: Array<{
    id: string;
    name: string;
    maxOccupants: number;
    sizeSqm: number;
    bedDescription: string;
    conditionsLabel: string;
    publicPriceMinor: number;
  }>;
};

export type DemoDestination = {
  slug: string;
  label: string;
  countrySlug: string;
  hotelCount: number;
  image: string;
};

export type DemoRanking = {
  slug: string;
  title: string;
  intro: string;
  entries: Array<{
    rank: number;
    hotelSlug: string;
    hotelName: string;
    city: string;
    teaser: string;
  }>;
};

const CLOUDINARY = 'https://res.cloudinary.com/travelba/image/upload/f_auto,q_auto,c_fill';

export const DEMO_MEURICE: DemoHotel = {
  slug: 'le-meurice',
  name: 'Le Meurice',
  stars: 5,
  city: 'Paris',
  country: 'France',
  countrySlug: 'france',
  citySlug: 'paris',
  district: '1er arrondissement',
  distanceLabel: '350 m du Louvre',
  ratingScoreOutOfTen: 9.4,
  reviewCount: 1284,
  editorialBadge: 'Palace · Atout France',
  highlights: ['Vue Tuileries', 'Restaurant 3★', 'Spa Valmont'],
  heroImage: `${CLOUDINARY},w_1600,h_900/le-meurice-hero`,
  photos: [
    {
      id: '1',
      alt: 'Façade Le Meurice place Vendôme Paris',
      src: `${CLOUDINARY},w_1200,h_800/le-meurice-hero`,
    },
    {
      id: '2',
      alt: 'Suite Le Meurice vue jardin des Tuileries',
      src: `${CLOUDINARY},w_800,h_600/le-meurice-suite`,
    },
    {
      id: '3',
      alt: 'Restaurant Le Meurice Alain Ducasse',
      src: `${CLOUDINARY},w_800,h_600/le-meurice-restaurant`,
    },
    {
      id: '4',
      alt: 'Spa Valmont Le Meurice',
      src: `${CLOUDINARY},w_800,h_600/le-meurice-spa`,
    },
    {
      id: '5',
      alt: 'Salon Le Meurice',
      src: `${CLOUDINARY},w_800,h_600/le-meurice-lounge`,
    },
    {
      id: '6',
      alt: 'Chambre Le Meurice',
      src: `${CLOUDINARY},w_800,h_600/le-meurice-room`,
    },
  ],
  description:
    "Le Meurice domine la rive droite depuis 1835. Palace classé Atout France, l'adresse mêle décors Second Empire et service discret. Les suites côté jardin des Tuileries restent les plus demandées pour un week-end parisien.",
  conciergeAdvice:
    'Réservez la suite 501 côté Tuileries : le calme absolu malgré le cœur de Paris. Le petit-déjeuner au salon Pompadour vaut le réveil matinal — demandez la table près de la cheminée.',
  editorialSections: [
    {
      anchor: 'histoire',
      title: 'Une adresse depuis 1835',
      paragraphs: [
        'Le Meurice ouvre ses portes en 1835 sur la rue de Rivoli. Le palace conserve décors Second Empire et service discret qui ont fait sa réputation internationale.',
      ],
    },
    {
      anchor: 'emplacement',
      title: 'Au cœur de la rive droite',
      paragraphs: [
        "À quelques pas du Louvre et des Tuileries, l'hôtel domine la place de la Concorde. Les suites côté jardin offrent la vue la plus demandée.",
      ],
    },
  ],
  faq: [
    {
      question: 'Où se situe Le Meurice ?',
      answer: '228 rue de Rivoli, 75001 Paris — face au jardin des Tuileries.',
    },
    {
      question: 'Quel est le conseil du Concierge ?',
      answer: 'Réservez la suite 501 côté Tuileries : le calme absolu malgré le cœur de Paris.',
    },
  ],
  publicPriceMinor: 89000,
  memberPriceMinor: 71200,
  rooms: [
    {
      id: 'superior',
      name: 'Chambre Supérieure',
      maxOccupants: 2,
      sizeSqm: 35,
      bedDescription: 'Lit king ou twin',
      conditionsLabel: 'Annulation flexible',
      publicPriceMinor: 89000,
    },
    {
      id: 'deluxe',
      name: 'Chambre Deluxe',
      maxOccupants: 2,
      sizeSqm: 42,
      bedDescription: 'Lit king',
      conditionsLabel: 'Petit-déjeuner inclus',
      publicPriceMinor: 105000,
    },
    {
      id: 'suite-tuileries',
      name: 'Suite Tuileries',
      maxOccupants: 3,
      sizeSqm: 80,
      bedDescription: 'Lit king + salon',
      conditionsLabel: 'Sur demande Concierge',
      publicPriceMinor: 185000,
    },
  ],
};

export const DEMO_HOTELS: DemoHotel[] = [
  DEMO_MEURICE,
  {
    ...DEMO_MEURICE,
    slug: 'le-bristol-paris',
    name: 'Le Bristol Paris',
    district: '8e arrondissement',
    distanceLabel: '200 m des Champs-Élysées',
    ratingScoreOutOfTen: 9.6,
    reviewCount: 2103,
    editorialBadge: 'Palace · Atout France',
    highlights: ['Toit-terrasse', 'Spa La Prairie', 'Jardin français'],
    heroImage: `${CLOUDINARY},w_1600,h_900/le-bristol-paris-hero`,
    photos: DEMO_MEURICE.photos.map((p, i) => ({
      ...p,
      id: `bristol-${i}`,
      alt: `Le Bristol Paris — photo ${i + 1}`,
    })),
    publicPriceMinor: 95000,
    memberPriceMinor: 76000,
  },
  {
    ...DEMO_MEURICE,
    slug: 'shangri-la-paris',
    name: 'Shangri-La Paris',
    district: '16e arrondissement',
    distanceLabel: 'Vue Tour Eiffel',
    ratingScoreOutOfTen: 9.2,
    reviewCount: 987,
    highlights: ['Piscine intérieure', 'Terrasse', 'Ancien palais'],
    heroImage: `${CLOUDINARY},w_1600,h_900/shangri-la-paris-hero`,
    photos: DEMO_MEURICE.photos.map((p, i) => ({
      ...p,
      id: `shangri-${i}`,
      alt: `Shangri-La Paris — photo ${i + 1}`,
    })),
    publicPriceMinor: 78000,
    memberPriceMinor: 62400,
  },
];

export const DEMO_DESTINATIONS: DemoDestination[] = [
  {
    slug: 'paris',
    label: 'Paris',
    countrySlug: 'france',
    hotelCount: 48,
    image: `${CLOUDINARY},w_800,h_600/paris-destination`,
  },
  {
    slug: 'london',
    label: 'Londres',
    countrySlug: 'royaume-uni',
    hotelCount: 32,
    image: `${CLOUDINARY},w_800,h_600/london-destination`,
  },
  {
    slug: 'marrakech',
    label: 'Marrakech',
    countrySlug: 'maroc',
    hotelCount: 18,
    image: `${CLOUDINARY},w_800,h_600/marrakech-destination`,
  },
  {
    slug: 'tokyo',
    label: 'Tokyo',
    countrySlug: 'japon',
    hotelCount: 24,
    image: `${CLOUDINARY},w_800,h_600/tokyo-destination`,
  },
];

// Slug canonique patron « luxe-ville » (ADR-0034 §3).
export const DEMO_RANKING: DemoRanking = {
  slug: 'meilleur-hotel-luxe-paris',
  title: 'Meilleur hôtel de luxe à Paris',
  intro:
    'Notre sélection des adresses Palace classées Atout France, testées par la conciergerie MyConciergeHotel.',
  entries: [
    {
      rank: 1,
      hotelSlug: 'le-meurice',
      hotelName: 'Le Meurice',
      city: 'Paris',
      teaser: 'La référence rive droite, entre Tuileries et Opéra.',
    },
    {
      rank: 2,
      hotelSlug: 'le-bristol-paris',
      hotelName: 'Le Bristol Paris',
      city: 'Paris',
      teaser: 'Jardin à la française au cœur du Faubourg Saint-Honoré.',
    },
    {
      rank: 3,
      hotelSlug: 'shangri-la-paris',
      hotelName: 'Shangri-La Paris',
      city: 'Paris',
      teaser: "Vue directe sur la Tour Eiffel depuis l'ancien palais d'Iéna.",
    },
  ],
};

export const DEMO_COUNTRIES = [
  { slug: 'france', label: 'France', hotelCount: 412 },
  { slug: 'italie', label: 'Italie', hotelCount: 186 },
  { slug: 'royaume-uni', label: 'Royaume-Uni', hotelCount: 94 },
  { slug: 'japon', label: 'Japon', hotelCount: 78 },
];

export const DEMO_CITIES: Record<
  string,
  Array<{ slug: string; label: string; hotelCount: number }>
> = {
  france: [
    { slug: 'paris', label: 'Paris', hotelCount: 48 },
    { slug: 'nice', label: 'Nice', hotelCount: 22 },
    { slug: 'courchevel', label: 'Courchevel', hotelCount: 14 },
  ],
  italie: [
    { slug: 'rome', label: 'Rome', hotelCount: 28 },
    { slug: 'venise', label: 'Venise', hotelCount: 19 },
    { slug: 'florence', label: 'Florence', hotelCount: 16 },
  ],
};

/** Régions annuaire — cible « Hôtel {Région} » (ADR-0034 §2). */
export const DEMO_REGIONS: Record<
  string,
  Array<{ slug: string; label: string; hotelCount: number }>
> = {
  france: [
    { slug: 'provence', label: 'Provence', hotelCount: 36 },
    { slug: 'cote-d-azur', label: "Côte d'Azur", hotelCount: 41 },
    { slug: 'alpes', label: 'Alpes', hotelCount: 27 },
  ],
  italie: [
    { slug: 'toscane', label: 'Toscane', hotelCount: 24 },
    { slug: 'cote-amalfitaine', label: 'Côte Amalfitaine', hotelCount: 17 },
  ],
};

export type DemoZone = {
  readonly slug: string;
  readonly label: string;
  readonly hotelCount: number;
  readonly kind: 'ville' | 'region';
};

/**
 * Le segment 2 de l'annuaire accepte ville OU région (ADR-0034 §2) :
 * /hotels/france/paris et /hotels/france/provence partagent le gabarit.
 */
export function resolveDemoZone(countrySlug: string, zoneSlug: string): DemoZone | undefined {
  const city = DEMO_CITIES[countrySlug]?.find((c) => c.slug === zoneSlug);
  if (city !== undefined) return { ...city, kind: 'ville' };
  const region = DEMO_REGIONS[countrySlug]?.find((r) => r.slug === zoneSlug);
  if (region !== undefined) return { ...region, kind: 'region' };
  return undefined;
}

export function getDemoHotel(slug: string): DemoHotel | undefined {
  return DEMO_HOTELS.find((h) => h.slug === slug);
}

export function getDemoHotelsByCity(countrySlug: string, citySlug: string): DemoHotel[] {
  return DEMO_HOTELS.filter((h) => h.countrySlug === countrySlug && h.citySlug === citySlug);
}

export function getDemoFilterGroups() {
  return [
    {
      id: 'budget' as const,
      title: 'Budget (par nuit)',
      defaultOpen: true,
      options: [
        { id: 'budget-under-500', label: 'Moins de 500 €', count: 12 },
        { id: 'budget-500-1000', label: '500 – 1 000 €', count: 28 },
        { id: 'budget-over-1000', label: 'Plus de 1 000 €', count: 15 },
      ],
    },
    {
      id: 'popular' as const,
      title: 'Filtres populaires',
      defaultOpen: true,
      options: [
        { id: 'palace', label: 'Palace Atout France', count: 8 },
        { id: 'relais', label: 'Relais & Châteaux', count: 14 },
        { id: 'spa', label: 'Spa', count: 22 },
      ],
    },
    {
      id: 'stars' as const,
      title: 'Étoiles',
      options: [
        { id: 'stars-5', label: '5 étoiles', count: 42 },
        { id: 'stars-4', label: '4 étoiles', count: 13 },
      ],
    },
    {
      id: 'rating' as const,
      title: 'Note des voyageurs',
      options: [
        { id: 'rating-9', label: '9+ / 10', count: 18 },
        { id: 'rating-8', label: '8+ / 10', count: 35 },
      ],
    },
  ];
}
