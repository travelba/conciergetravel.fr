import type { ComponentProps } from 'react';

import type { Link } from '@/i18n/navigation';

/** Stitch mock top nav — flat links (no mega-menus) on `/hotel/*`. */
export const HERITAGE_FLAT_NAV_HREFS = [
  { pathname: '/destination' },
  { pathname: '/guides' },
  { pathname: '/classements' },
  { pathname: '/le-concierge' },
] as const satisfies readonly { readonly pathname: ComponentProps<typeof Link>['href'] }[];

export type HeritageFlatNavHref = (typeof HERITAGE_FLAT_NAV_HREFS)[number]['pathname'];

export const HERITAGE_FLAT_NAV_LABEL_KEYS = [
  'primaryNav.destinations',
  'primaryNav.guides',
  'primaryNav.rankings',
  'primaryNav.concierge',
] as const;
