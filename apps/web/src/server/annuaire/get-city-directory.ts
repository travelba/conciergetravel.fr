import 'server-only';

import { type SupportedLocale } from '@/i18n/supported-locale';
import {
  citySlug,
  isValidCitySlug,
  listPublishedHotelsForGrouping,
} from '@/server/destinations/cities';

import { countrySlug, isValidCountrySlug, resolveCountryFromRows } from './country-slugs';
import { sortDirectoryRows, toDirectoryHotel, type DirectoryHotel } from './directory-shared';

/**
 * Annuaire — city directory accessor (ADR-0026).
 *
 * Variant of `getDestinationBySlug` **scoped by country**
 * (`country_code` + `citySlug(city) === villeSlug`). The country scope
 * is what resolves the homonym collision — two cities named "San José"
 * (Costa Rica vs USA) get distinct `/hotels/<pays>/san-jose` URLs.
 *
 * Returns the exhaustive, sorted hotel list for the city.
 */

export interface CityDirectory {
  readonly countryCode: string;
  readonly countrySlug: string;
  readonly countryName: string;
  readonly citySlug: string;
  readonly cityName: string;
  /** French administrative region (FR only; null off-FR). */
  readonly region: string | null;
  readonly totalCount: number;
  readonly hotels: readonly DirectoryHotel[];
}

export async function getCityDirectory(
  paysSlug: string,
  villeSlug: string,
  locale: SupportedLocale,
): Promise<CityDirectory | null> {
  if (!isValidCountrySlug(paysSlug) || !isValidCitySlug(villeSlug)) return null;

  const rows = await listPublishedHotelsForGrouping();
  if (rows.length === 0) return null;

  const resolved = resolveCountryFromRows(rows, paysSlug);
  if (resolved === null) return null;

  // Scope strictly by country FIRST, then by derived city slug — this
  // is the homonym-collision fix vs the flat `/destination/[citySlug]`.
  const matching = rows.filter(
    (r) => r.country_code === resolved.code && citySlug(r.city) === villeSlug,
  );
  const [first] = matching;
  if (first === undefined) return null;

  let region: string | null = first.region;
  if (region === null) {
    for (const h of matching) {
      if (h.region !== null) {
        region = h.region;
        break;
      }
    }
  }

  const countryName =
    (locale === 'en' ? resolved.labelEn : resolved.labelFr) ??
    resolved.labelFr ??
    resolved.labelEn ??
    resolved.code;

  return {
    countryCode: resolved.code,
    countrySlug: countrySlug(resolved.labelFr, resolved.labelEn, resolved.code),
    countryName,
    citySlug: villeSlug,
    cityName: first.city,
    region,
    totalCount: matching.length,
    hotels: sortDirectoryRows(matching, locale).map((row) => toDirectoryHotel(row, locale)),
  };
}
