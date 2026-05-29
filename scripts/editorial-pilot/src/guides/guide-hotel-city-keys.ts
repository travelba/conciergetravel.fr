/**
 * Maps `editorial_guides.slug` → `hotels.city` keys for bloc 12 (LocalGuideTeaser).
 * Keep in sync with `apps/web/src/server/guides/destination-mappings.ts`.
 */

export const GUIDE_HOTEL_CITY_KEYS: Readonly<Record<string, readonly string[]>> = {
  paris: ['paris'],
  'cote-d-azur': [
    'cannes',
    'nice',
    'antibes',
    "cap d'antibes",
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
  alpes: [
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
  ],
  courchevel: ['courchevel'],
  megeve: ['megève', 'megeve'],
  cannes: ['cannes'],
  'saint-tropez': ['saint-tropez', 'ramatuelle'],
  'cap-ferrat': ['saint-jean-cap-ferrat', 'cap-ferrat'],
  'cap-d-antibes': ["cap d'antibes", 'cap-d-antibes', 'antibes'],
  biarritz: ['biarritz'],
  bordeaux: ['bordeaux', 'martillac', 'saint-emilion', 'saint-émilion', 'pauillac'],
  'reims-champagne': ['reims', 'épernay', 'epernay'],
  provence: [
    'le puy-sainte-réparade',
    'le puy sainte réparade',
    'gordes',
    'lourmarin',
    'ménerbes',
    'menerbes',
  ],
  corse: ['porto-vecchio', 'calvi', 'ajaccio', 'bonifacio'],
};

/** Reverse lookup: lowercase city label → guide slug (when guide is published). */
export function buildCityToGuideSlugMap(
  publishedGuideSlugs: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const [guideSlug, cities] of Object.entries(GUIDE_HOTEL_CITY_KEYS)) {
    if (!publishedGuideSlugs.has(guideSlug)) continue;
    for (const city of cities) {
      out.set(city.toLowerCase(), guideSlug);
    }
  }
  for (const slug of publishedGuideSlugs) {
    out.set(slug, slug);
  }
  return out;
}

export function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveGuideSlugForHotel(
  city: string | null,
  publishedGuideSlugs: ReadonlySet<string>,
  cityToGuide: ReadonlyMap<string, string>,
): string | null {
  if (city === null || city.trim().length === 0) return null;
  const hub = citySlug(city);
  if (publishedGuideSlugs.has(hub)) return hub;
  const mapped = cityToGuide.get(city.toLowerCase());
  if (mapped !== undefined && publishedGuideSlugs.has(mapped)) return mapped;
  return null;
}
