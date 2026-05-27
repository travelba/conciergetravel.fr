import 'server-only';

import {
  TOP_DESTINATION_NAV_ENTRIES,
  pickEntryLabel,
  type NavLabeledEntry,
} from '@/components/layout/nav-data';
import type {
  CountryGuideHref,
  HomeDestinationCardData,
} from '@/components/home/home-destination-grid';
import type { Locale } from '@/i18n/routing';

interface CountryDestinationEntry extends NavLabeledEntry {
  readonly href: CountryGuideHref;
}

/**
 * Editorial intl destination picks for the home grid. Slugs match the
 * typed static routes in `apps/web/src/i18n/routing.ts` (pathnames).
 */
export const HOME_INTL_DESTINATION_ENTRIES: readonly CountryDestinationEntry[] = [
  {
    slug: 'italie',
    labelFr: 'Italie (Toscane, Côme)',
    labelEn: 'Italy (Tuscany, Lake Como)',
    href: '/guide/italie',
  },
  {
    slug: 'japon',
    labelFr: 'Japon (Kyoto, Tokyo)',
    labelEn: 'Japan (Kyoto, Tokyo)',
    href: '/guide/japon',
  },
  {
    slug: 'maroc',
    labelFr: 'Maroc (Marrakech, Fès)',
    labelEn: 'Morocco (Marrakech, Fez)',
    href: '/guide/maroc',
  },
  {
    slug: 'suisse',
    labelFr: 'Suisse (Alpes, Lacs)',
    labelEn: 'Switzerland (Alps, Lakes)',
    href: '/guide/suisse',
  },
  { slug: 'maldives', labelFr: 'Maldives', labelEn: 'Maldives', href: '/guide/maldives' },
  {
    slug: 'etats-unis',
    labelFr: 'États-Unis (New York…)',
    labelEn: 'United States (New York…)',
    href: '/guide/etats-unis',
  },
];

/**
 * Build the featured destinations payload for `<HomeDestinationGrid>`.
 *
 * Mixes up to 3 published French cities (with a real published hotel
 * count from `cityCounts`) with up to 3 intl country guide teasers, so
 * the grid is always at least half-international — backing the new
 * « hôtels d'exception dans le monde » framing (ADR-0021).
 *
 * `hotelCountLabel` is a localised plural formatter passed by the
 * caller (`featuredDestinations.countLabel` via `next-intl`) so the
 * helper stays pure and locale-agnostic.
 */
export function pickHomeDestinations(
  cityCounts: ReadonlyMap<string, number>,
  locale: Locale,
  hotelCountLabel: (count: number) => string,
): readonly HomeDestinationCardData[] {
  const out: HomeDestinationCardData[] = [];

  for (const entry of TOP_DESTINATION_NAV_ENTRIES) {
    const count = cityCounts.get(entry.slug) ?? 0;
    if (count === 0) continue;
    out.push({
      key: `city-${entry.slug}`,
      label: pickEntryLabel(entry, locale),
      variant: 'city',
      citySlug: entry.slug,
      hint: hotelCountLabel(count),
    });
    if (out.filter((d) => d.variant === 'city').length >= 3) break;
  }

  for (const entry of HOME_INTL_DESTINATION_ENTRIES) {
    out.push({
      key: `country-${entry.slug}`,
      label: pickEntryLabel(entry, locale),
      variant: 'country',
      href: entry.href,
    });
    if (out.filter((d) => d.variant === 'country').length >= 3) break;
  }

  return out;
}
