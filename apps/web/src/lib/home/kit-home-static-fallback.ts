/**
 * Static home sections from `design/html-kit/index.html` — used when
 * Supabase is unavailable (local dev without `.env.local` credentials)
 * so the kit homepage still matches the reference mockup.
 */
import type { ComponentProps } from 'react';

import { Link } from '@/i18n/navigation';

export type KitStaticLink =
  | { readonly kind: 'path'; readonly href: '/' | '/hotels' | '/guide/italie' | '/classements' }
  | { readonly kind: 'hotel'; readonly slug: string }
  | { readonly kind: 'ranking'; readonly slug: string };

type AppLinkHref = ComponentProps<typeof Link>['href'];

export function kitStaticLinkHref(link: KitStaticLink): AppLinkHref {
  if (link.kind === 'path') {
    return link.href;
  }
  if (link.kind === 'hotel') {
    return { pathname: '/hotel/[slug]', params: { slug: link.slug } };
  }
  return { pathname: '/classement/[slug]', params: { slug: link.slug } };
}

export interface KitStaticMosaicTile {
  readonly mosaicClass: string;
  readonly img: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly tagKey: 'experience' | 'featured' | null;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly locFr: string;
  readonly locEn: string;
  readonly link: KitStaticLink;
}

/** Six-tile magazine mosaic — mirrors index.html §magazine. */
export const KIT_STATIC_MOSAIC: readonly KitStaticMosaicTile[] = [
  {
    mosaicClass: 'card card-experience',
    img: '/kit/img/experience.jpg',
    altFr: 'Dîner aux chandelles sur une terrasse face à la mer, expérience La Dolce Vita',
    altEn: 'Candlelit dinner on a terrace overlooking the sea — La Dolce Vita experience',
    tagKey: 'experience',
    titleFr: 'La Dolce Vita',
    titleEn: 'La Dolce Vita',
    locFr: 'Italie',
    locEn: 'Italy',
    link: { kind: 'path', href: '/guide/italie' },
  },
  {
    mosaicClass: 'card card-amalfi',
    img: '/kit/img/amalfi.jpg',
    altFr: 'Piscine à débordement suspendue au-dessus de la mer à Ravello',
    altEn: 'Infinity pool above the sea at Ravello',
    tagKey: 'featured',
    titleFr: 'Belmond Caruso',
    titleEn: 'Belmond Caruso',
    locFr: 'Ravello, Italie',
    locEn: 'Ravello, Italy',
    link: { kind: 'path', href: '/hotels' },
  },
  {
    mosaicClass: 'card card-paris',
    img: '/kit/img/paris.jpg',
    altFr: 'Façade haussmannienne du Meurice à Paris',
    altEn: 'Haussmann façade of Le Meurice, Paris',
    tagKey: null,
    titleFr: 'Le Meurice',
    titleEn: 'Le Meurice',
    locFr: 'Paris, France',
    locEn: 'Paris, France',
    link: { kind: 'hotel', slug: 'le-meurice' },
  },
  {
    mosaicClass: 'card card-maldives',
    img: '/kit/img/maldives.jpg',
    altFr: 'Villa sur pilotis dans un lagon turquoise des Maldives',
    altEn: 'Overwater villa in a turquoise Maldivian lagoon',
    tagKey: null,
    titleFr: 'Cheval Blanc Randheli',
    titleEn: 'Cheval Blanc Randheli',
    locFr: 'Noonu Atoll, Maldives',
    locEn: 'Noonu Atoll, Maldives',
    link: { kind: 'path', href: '/hotels' },
  },
  {
    mosaicClass: 'card card-marrakech',
    img: '/kit/img/marrakech.jpg',
    altFr: "Patio d'un riad de luxe à Marrakech",
    altEn: 'Luxury riad courtyard in Marrakech',
    tagKey: null,
    titleFr: 'Amanjena',
    titleEn: 'Amanjena',
    locFr: 'Marrakech, Maroc',
    locEn: 'Marrakech, Morocco',
    link: { kind: 'path', href: '/hotels' },
  },
  {
    mosaicClass: 'card card-como',
    img: '/kit/img/como.jpg',
    altFr: 'Villa belle époque au bord du lac de Côme',
    altEn: 'Belle Époque villa on Lake Como',
    tagKey: null,
    titleFr: "Villa d'Este",
    titleEn: "Villa d'Este",
    locFr: 'Lac de Côme, Italie',
    locEn: 'Lake Como, Italy',
    link: { kind: 'path', href: '/hotels' },
  },
];

export interface KitStaticOpeningTile {
  readonly img: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly locFr: string;
  readonly locEn: string;
  readonly link: KitStaticLink;
}

/** Four « récemment visités » cards — mirrors index.html §hotels. */
export const KIT_STATIC_OPENINGS: readonly KitStaticOpeningTile[] = [
  {
    img: '/kit/img/paris.jpg',
    altFr: 'Façade du Meurice à Paris',
    altEn: 'Le Meurice façade, Paris',
    titleFr: 'Le Meurice',
    titleEn: 'Le Meurice',
    locFr: 'Paris, France',
    locEn: 'Paris, France',
    link: { kind: 'hotel', slug: 'le-meurice' },
  },
  {
    img: '/kit/img/amalfi.jpg',
    altFr: 'Belmond Caruso à Ravello',
    altEn: 'Belmond Caruso, Ravello',
    titleFr: 'Belmond Caruso',
    titleEn: 'Belmond Caruso',
    locFr: 'Ravello, Italie',
    locEn: 'Ravello, Italy',
    link: { kind: 'path', href: '/hotels' },
  },
  {
    img: '/kit/img/dest_riviera.jpg',
    altFr: "Palace de la Côte d'Azur",
    altEn: 'Palace on the French Riviera',
    titleFr: 'Grand-Hôtel du Cap-Ferrat',
    titleEn: 'Grand-Hôtel du Cap-Ferrat',
    locFr: 'Saint-Jean-Cap-Ferrat, France',
    locEn: 'Saint-Jean-Cap-Ferrat, France',
    link: { kind: 'path', href: '/hotels' },
  },
  {
    img: '/kit/img/htl_facade.jpg',
    altFr: 'Airelles Gordes, La Bastide — Palace dans le Luberon',
    altEn: 'Airelles Gordes, La Bastide — Palace in the Luberon',
    titleFr: 'Airelles Gordes, La Bastide',
    titleEn: 'Airelles Gordes, La Bastide',
    locFr: 'Gordes, France',
    locEn: 'Gordes, France',
    link: { kind: 'path', href: '/hotels' },
  },
];

export interface KitStaticRankingTile {
  readonly countLabelFr: string;
  readonly countLabelEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly descFr: string;
  readonly descEn: string;
  readonly link: KitStaticLink;
}

/** Six editorial rankings — mirrors index.html §offres. */
export const KIT_STATIC_RANKINGS: readonly KitStaticRankingTile[] = [
  {
    countLabelFr: '10 hôtels',
    countLabelEn: '10 hotels',
    titleFr: 'Les 10 Meilleurs Palaces de Paris',
    titleEn: 'The 10 Best Palaces in Paris',
    descFr: 'Notre classement éditorial · Paris',
    descEn: 'Our editorial ranking · Paris',
    link: { kind: 'ranking', slug: 'meilleurs-palaces-paris' },
  },
  {
    countLabelFr: '100 hôtels',
    countLabelEn: '100 hotels',
    titleFr: "World's 50 Best Hotels 2025",
    titleEn: "World's 50 Best Hotels 2025",
    descFr: 'Le classement de référence mondial',
    descEn: 'The global benchmark ranking',
    link: { kind: 'path', href: '/classements' },
  },
  {
    countLabelFr: '70 hôtels',
    countLabelEn: '70 hotels',
    titleFr: 'Condé Nast Gold List 2025–2026',
    titleEn: 'Condé Nast Gold List 2025–2026',
    descFr: 'La sélection des rédactions',
    descEn: "The editors' pick",
    link: { kind: 'path', href: '/classements' },
  },
  {
    countLabelFr: '50 hôtels',
    countLabelEn: '50 hotels',
    titleFr: "Les meilleurs hôtels d'Italie",
    titleEn: 'The best hotels in Italy',
    descFr: 'De la Côte amalfitaine au lac de Côme',
    descEn: 'From the Amalfi Coast to Lake Como',
    link: { kind: 'path', href: '/classements' },
  },
  {
    countLabelFr: '50 hôtels',
    countLabelEn: '50 hotels',
    titleFr: 'Top Relais & Châteaux en France',
    titleEn: 'Top Relais & Châteaux in France',
    descFr: "L'art de vivre à la française",
    descEn: 'The French art of living',
    link: { kind: 'path', href: '/classements' },
  },
  {
    countLabelFr: '84 hôtels',
    countLabelEn: '84 hotels',
    titleFr: "Travel + Leisure World's Best 2025",
    titleEn: "Travel + Leisure World's Best 2025",
    descFr: 'Plébiscités par les voyageurs',
    descEn: 'Reader favourites worldwide',
    link: { kind: 'path', href: '/classements' },
  },
];

/** Kit destination tile photos when Cloudinary heroes are unavailable. */
export const KIT_STATIC_DEST_IMAGES: Readonly<Record<string, string>> = {
  paris: '/kit/img/paris.jpg',
  'cote-d-azur': '/kit/img/dest_riviera.jpg',
  italie: '/kit/img/amalfi.jpg',
  grece: '/kit/img/dest_grece.jpg',
  japon: '/kit/img/dest_japon.jpg',
  maroc: '/kit/img/marrakech.jpg',
  'etats-unis': '/kit/img/dest_newyork.jpg',
  maldives: '/kit/img/maldives.jpg',
};
