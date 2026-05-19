import type { Locale } from '@/i18n/routing';

/**
 * Shared navigation data for `<SiteHeader>` and `<MobileNav>`.
 *
 * Lives outside `server/` so a Client Component (mobile nav) can import
 * it without dragging in `server-only`. Labels are pre-resolved per
 * locale to avoid round-tripping through `next-intl` for entries that
 * are stable across the product (the 5 editorial categories that gate
 * `/categorie/[slug]`).
 *
 * The slugs MUST stay in sync with `server/hotels/editorial-categories.ts`
 * — the canonical list of category predicates. Mismatched slugs render
 * a category link to a 404'd page.
 */
export interface HotelCategoryNavEntry {
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

export const HOTEL_CATEGORY_NAV_ENTRIES: readonly HotelCategoryNavEntry[] = [
  {
    slug: 'palaces-france',
    labelFr: 'Tous les Palaces de France',
    labelEn: 'All Palaces in France',
  },
  {
    slug: 'palaces-paris',
    labelFr: 'Palaces parisiens',
    labelEn: 'Parisian Palaces',
  },
  {
    slug: 'palaces-montagne',
    labelFr: 'Palaces à la montagne',
    labelEn: 'Mountain Palaces',
  },
  {
    slug: 'palaces-bord-de-mer',
    labelFr: 'Palaces en bord de mer',
    labelEn: 'Seafront Palaces',
  },
  {
    slug: 'palaces-vignobles',
    labelFr: 'Palaces & vignobles',
    labelEn: 'Vineyard Palaces',
  },
];

export function pickCategoryLabel(entry: HotelCategoryNavEntry, locale: Locale): string {
  return locale === 'en' ? entry.labelEn : entry.labelFr;
}
