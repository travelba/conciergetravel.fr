import type { Locale } from '@/i18n/routing';

import type { Destination } from './types';

interface TopCityEntry {
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

/** Curated top cities for the empty-state destination dropdown (hero search bar).
 * Slugs align with `TOP_DESTINATION_NAV_ENTRIES` / `TOP_INTL_DESTINATION_NAV_ENTRIES`. */
const TOP_SEARCH_CITY_ENTRIES: readonly TopCityEntry[] = [
  { slug: 'paris', labelFr: 'Paris', labelEn: 'Paris' },
  {
    slug: 'cannes',
    labelFr: "Côte d'Azur (Cannes, Nice…)",
    labelEn: 'French Riviera (Cannes, Nice…)',
  },
  { slug: 'new-york', labelFr: 'New York', labelEn: 'New York' },
  { slug: 'marrakech', labelFr: 'Marrakech', labelEn: 'Marrakech' },
  { slug: 'dubai', labelFr: 'Dubaï', labelEn: 'Dubai' },
];

export const TOP_SEARCH_CITY_COUNT = 5;

/** Locale-aware top city suggestions shown when the destination field opens empty. */
export function getTopSearchCities(locale: Locale): readonly Destination[] {
  return TOP_SEARCH_CITY_ENTRIES.slice(0, TOP_SEARCH_CITY_COUNT).map(
    (entry): Destination => ({
      id: entry.slug,
      label: locale === 'en' ? entry.labelEn : entry.labelFr,
      type: 'city',
    }),
  );
}
