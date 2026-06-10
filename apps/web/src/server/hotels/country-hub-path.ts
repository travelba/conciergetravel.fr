import 'server-only';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { countrySlug } from '@/server/annuaire/country-slugs';
import type { HotelDetailRow } from '@/server/hotels/get-hotel-by-slug';

/** Canonical country annuaire path for breadcrumb + JSON-LD (`/hotels/france`, …). */
export function buildHotelCountryHubPath(row: HotelDetailRow, locale: Locale): string {
  const pays = countrySlug(row.country_label_fr, row.country_label_en, row.country_code);
  return getPathname({ locale, href: { pathname: '/hotels/[pays]', params: { pays } } });
}
