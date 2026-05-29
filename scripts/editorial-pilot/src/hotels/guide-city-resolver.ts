/**
 * Resolves whether a hotel city has a published editorial guide (CDC §2 bloc 12).
 * Mirrors `apps/web/src/server/guides/destination-mappings.ts` + `citySlug()`.
 */

/** Keep in sync with `apps/web/src/server/guides/destination-mappings.ts`. */
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

export function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCityToGuideMap(
  publishedGuideSlugs: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [guideSlug, cityKeys] of Object.entries(GUIDE_HOTEL_CITY_KEYS)) {
    if (!publishedGuideSlugs.has(guideSlug)) continue;
    for (const key of cityKeys) {
      map.set(key.toLowerCase(), guideSlug);
    }
  }
  return map;
}

export function resolvePublishedGuideSlug(
  city: string | null,
  publishedGuideSlugs: ReadonlySet<string>,
): string | null {
  if (city === null || city.trim().length === 0) return null;
  const hubSlug = citySlug(city);
  if (publishedGuideSlugs.has(hubSlug)) return hubSlug;

  const cityToGuide = buildCityToGuideMap(publishedGuideSlugs);
  const direct = cityToGuide.get(city.toLowerCase());
  if (direct !== undefined) return direct;

  const hubFromCity = cityToGuide.get(hubSlug);
  if (hubFromCity !== undefined) return hubFromCity;

  return null;
}
