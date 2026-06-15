/**
 * POI typology → icon family (visit castle, eat fork, shop bakery…).
 * Shared by the location cards and the Mapbox marker layer.
 */

export const POI_BUCKETS = ['visit', 'do', 'eat', 'shop'] as const;
export type PoiBucket = (typeof POI_BUCKETS)[number];

export type VisitKind =
  | 'castle'
  | 'religious'
  | 'museum'
  | 'monument'
  | 'garden'
  | 'viewpoint'
  | 'nature'
  | 'water'
  | 'landmark';

export type DoKind =
  | 'dining'
  | 'tasting'
  | 'hiking'
  | 'cycling'
  | 'ballooning'
  | 'market'
  | 'swimming'
  | 'sport'
  | 'activity';

export type ShopKind =
  | 'bakery'
  | 'pharmacy'
  | 'grocery'
  | 'wine'
  | 'oil'
  | 'cheese'
  | 'greengrocer'
  | 'butcher'
  | 'florist'
  | 'fashion'
  | 'books'
  | 'market'
  | 'bank'
  | 'beauty'
  | 'other';

export type PoiIconKind =
  | { readonly family: 'visit'; readonly kind: VisitKind }
  | { readonly family: 'do'; readonly kind: DoKind }
  | { readonly family: 'eat' }
  | { readonly family: 'shop'; readonly kind: ShopKind };

const VISIT_KIND_KEYWORDS: readonly (readonly [VisitKind, readonly string[]])[] = [
  ['castle', ['castle', 'château', 'chateau', 'fort', 'citadelle', 'palais', 'palace']],
  [
    'religious',
    [
      'monaster',
      'monastère',
      'abbey',
      'abbaye',
      'church',
      'église',
      'eglise',
      'cathedral',
      'cathédrale',
      'chapel',
      'chapelle',
      'basilique',
      'religious',
      'couvent',
      'prieuré',
      'prieure',
      'cloître',
      'cloitre',
    ],
  ],
  [
    'museum',
    [
      'museum',
      'musée',
      'musee',
      'gallery',
      'galerie',
      'exhibition',
      'exposition',
      'écomusée',
      'ecomusee',
    ],
  ],
  ['garden', ['garden', 'jardin', 'park', 'parc', 'botaniqu', 'arboretum']],
  [
    'viewpoint',
    ['viewpoint', 'belvédère', 'belvedere', 'panorama', 'point de vue', 'observatoire'],
  ],
  [
    'water',
    [
      'beach',
      'plage',
      'lake',
      'lac',
      'rivière',
      'riviere',
      'fontaine',
      'source',
      'cascade',
      'gorge',
    ],
  ],
  [
    'nature',
    [
      'nature',
      'mountain',
      'montagne',
      'forest',
      'forêt',
      'foret',
      'massif',
      'réserve',
      'reserve',
      'site naturel',
    ],
  ],
  [
    'monument',
    [
      'monument',
      'heritage',
      'patrimoine',
      'memorial',
      'mémorial',
      'ruins',
      'ruine',
      'vestige',
      'troglo',
      'site',
      'arc',
      'pont',
      'bridge',
      'remparts',
      'tour',
    ],
  ],
];

const DO_KIND_KEYWORDS: readonly (readonly [DoKind, readonly string[]])[] = [
  ['ballooning', ['montgolf', 'mongolf', 'balloon', 'air balloon']],
  ['cycling', ['vélo', 'velo', 'bike', 'cycl', 'vtt', 'e-bike', 'bicycl']],
  [
    'tasting',
    [
      'winery',
      'wine',
      'vin',
      'dégustation',
      'degustation',
      'domaine',
      'vignoble',
      'œnolog',
      'oenolog',
      'cellar',
      'cave',
    ],
  ],
  [
    'hiking',
    ['hike', 'rando', 'trail', 'sentier', 'trek', 'col ', 'summit', 'gr ', 'marche', 'balade'],
  ],
  ['market', ['market', 'marché', 'marche', 'halle', 'brocante']],
  [
    'swimming',
    [
      'kayak',
      'canoë',
      'canoe',
      'paddle',
      'rafting',
      'baignade',
      'swim',
      'nautique',
      'plonge',
      'voile',
      'sailing',
      'water',
    ],
  ],
  [
    'sport',
    ['golf', 'tennis', 'equestr', 'équestr', 'cheval', 'ski', 'escalade', 'climb', 'sport', 'yoga'],
  ],
  [
    'dining',
    [
      'restaurant',
      'bistro',
      'bistrot',
      'table',
      'brasserie',
      'dining',
      'gastronom',
      'trattoria',
      'guinguette',
    ],
  ],
];

const SHOP_KIND_KEYWORDS: readonly (readonly [ShopKind, readonly string[]])[] = [
  ['bakery', ['boulang', 'patiss', 'pâtiss', 'bakery', 'pastry', 'viennois']],
  ['pharmacy', ['pharmac', 'chemist', 'parapharma']],
  ['oil', ['moulin', 'huile', 'olive oil', 'oil mill']],
  ['cheese', ['fromag', 'cheese', 'crémerie', 'cremerie', 'dairy']],
  ['wine', ['caviste', 'vin', 'wine', 'cave', 'spirits', 'œnolog', 'oenolog']],
  ['greengrocer', ['primeur', 'fruits', 'légume', 'legume', 'greengrocer', 'verger']],
  ['butcher', ['bouch', 'charcut', 'butcher', 'viande']],
  ['florist', ['fleur', 'florist', 'flower']],
  ['books', ['librair', 'book', 'presse', 'newsagent', 'journ', 'tabac']],
  ['market', ['marché', 'marche', 'market', 'halle']],
  ['bank', ['banque', 'bank', 'atm', 'distributeur', 'bureau de change', 'post_office', 'poste']],
  ['beauty', ['coiff', 'beaut', 'beauty', 'hairdress', 'spa', 'esthét', 'esthet', 'parfum']],
  [
    'fashion',
    [
      'mode',
      'vêtement',
      'vetement',
      'clothes',
      'fashion',
      'boutique',
      'concept store',
      'maroquin',
      'chauss',
      'bijou',
      'jewel',
    ],
  ],
  [
    'grocery',
    [
      'épicer',
      'epicer',
      'grocery',
      'deli',
      'supermarket',
      'supermarché',
      'convenience',
      'alimentation',
      'gourmet',
      'delicatessen',
      'food',
      'store',
      'shop',
    ],
  ],
];

function matchKind<K extends string>(
  haystack: string,
  table: readonly (readonly [K, readonly string[]])[],
  fallback: K,
): K {
  for (const [kind, keywords] of table) {
    if (keywords.some((kw) => haystack.includes(kw))) return kind;
  }
  return fallback;
}

export function resolveVisitKind(
  rawType: string,
  category: string | null,
  name: string,
): VisitKind {
  const haystack = `${rawType} ${category ?? ''} ${name}`.toLowerCase();
  return matchKind(haystack, VISIT_KIND_KEYWORDS, 'landmark');
}

export function resolveDoKind(rawType: string, category: string | null, name: string): DoKind {
  const haystack = `${rawType} ${category ?? ''} ${name}`.toLowerCase();
  return matchKind(haystack, DO_KIND_KEYWORDS, 'activity');
}

export function resolveShopKind(rawType: string, category: string | null, name: string): ShopKind {
  const haystack = `${rawType} ${category ?? ''} ${name}`.toLowerCase();
  return matchKind(haystack, SHOP_KIND_KEYWORDS, 'other');
}

export function resolvePoiIconKind(
  bucket: PoiBucket,
  rawType: string,
  category: string | null,
  name: string,
): PoiIconKind {
  if (bucket === 'visit') {
    return { family: 'visit', kind: resolveVisitKind(rawType, category, name) };
  }
  if (bucket === 'do') {
    return { family: 'do', kind: resolveDoKind(rawType, category, name) };
  }
  if (bucket === 'eat') {
    return { family: 'eat' };
  }
  return { family: 'shop', kind: resolveShopKind(rawType, category, name) };
}
