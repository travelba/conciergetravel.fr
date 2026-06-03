import 'server-only';

import { type SupportedLocale } from '@/i18n/supported-locale';
import {
  citySlug,
  listPublishedHotelsForGrouping,
  type HotelGroupRow,
} from '@/server/destinations/cities';

import {
  buildCountryDirectoryList,
  countrySlug,
  isValidCountrySlug,
  resolveCountryFromRows,
  type CountryDirectoryEntry,
} from './country-slugs';
import { sortDirectoryRows, toDirectoryHotel, type DirectoryHotel } from './directory-shared';

/**
 * Annuaire — country directory accessor (ADR-0026).
 *
 * Returns the **exhaustive** list of published hotels for one country,
 * grouped by city. No cap (unlike the editorial `getHotelsForCountry`
 * which slices to 18) — the annuaire is the canonical "all hotels"
 * surface for the country/city intent.
 */

export interface DirectoryCityGroup {
  /** `citySlug(city)` — second URL segment under `/hotels/[pays]/[ville]`. */
  readonly slug: string;
  readonly name: string;
  readonly hotels: readonly DirectoryHotel[];
}

export interface CountryDirectory {
  readonly code: string;
  readonly slug: string;
  /** Localised country label. */
  readonly name: string;
  readonly totalCount: number;
  readonly cityCount: number;
  readonly cities: readonly DirectoryCityGroup[];
  /** Sibling countries (FR included) for the cross-link strip. */
  readonly otherCountries: readonly CountryDirectoryEntry[];
}

export async function getCountryDirectory(
  paysSlug: string,
  locale: SupportedLocale,
): Promise<CountryDirectory | null> {
  if (!isValidCountrySlug(paysSlug)) return null;

  const rows = await listPublishedHotelsForGrouping();
  if (rows.length === 0) return null;

  const resolved = resolveCountryFromRows(rows, paysSlug);
  if (resolved === null) return null;

  const inCountry = rows.filter((r) => r.country_code === resolved.code);
  if (inCountry.length === 0) return null;

  // Group by derived city slug — the same slugifier `/destination` uses,
  // so the second segment matches the existing city pages.
  const byCity = new Map<string, { name: string; rows: HotelGroupRow[] }>();
  for (const r of inCountry) {
    const slug = citySlug(r.city);
    if (slug.length === 0) continue;
    const existing = byCity.get(slug);
    if (existing === undefined) {
      byCity.set(slug, { name: r.city, rows: [r] });
    } else {
      existing.rows.push(r);
    }
  }

  const cities: DirectoryCityGroup[] = [...byCity.entries()]
    .map(([slug, value]) => ({
      slug,
      name: value.name,
      hotels: sortDirectoryRows(value.rows, locale).map((row) => toDirectoryHotel(row, locale)),
    }))
    .sort((a, b) => b.hotels.length - a.hotels.length || a.name.localeCompare(b.name, locale));

  const name =
    (locale === 'en' ? resolved.labelEn : resolved.labelFr) ??
    resolved.labelFr ??
    resolved.labelEn ??
    resolved.code;

  const otherCountries = buildCountryDirectoryList(rows, locale).filter(
    (c) => c.code !== resolved.code,
  );

  return {
    code: resolved.code,
    slug: countrySlug(resolved.labelFr, resolved.labelEn, resolved.code),
    name,
    totalCount: inCountry.length,
    cityCount: cities.length,
    cities,
    otherCountries,
  };
}
