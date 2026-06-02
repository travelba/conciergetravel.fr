import 'server-only';

import { type SupportedLocale } from '@/i18n/supported-locale';
import { citySlug, listPublishedHotelsForGrouping } from '@/server/destinations/cities';

import { buildCountryDirectoryList, type CountryDirectoryEntry } from './country-slugs';

/**
 * Annuaire — directory index accessor (ADR-0026).
 *
 * Returns every published country (FR included) with its derived slug
 * and hotel count, sorted by count desc. Used by the sitemap to emit
 * the `/hotels/[pays]` URLs and available to any surface that needs the
 * full country list without a city-level grouping.
 *
 * Pages that already hold the published rows (e.g. `/hotels`) should
 * call `buildCountryDirectoryList` directly on those rows to avoid a
 * second Supabase round-trip.
 */
export async function listDirectoryCountries(
  locale: SupportedLocale,
): Promise<readonly CountryDirectoryEntry[]> {
  const rows = await listPublishedHotelsForGrouping();
  return buildCountryDirectoryList(rows, locale);
}

/** A single `/hotels/[pays]/[ville]` path (for the sitemap). */
export interface DirectoryCityPath {
  readonly paysSlug: string;
  readonly villeSlug: string;
}

/**
 * Every distinct `(country, city)` pair across the published catalogue,
 * projected as annuaire path segments. Country slug is the canonical
 * per-code slug (aggregated labels, FR-anchored — see `country-slugs`),
 * city slug uses the same `citySlug()` the routes derive at request
 * time, so the emitted URLs always resolve. Deduped by `pays/ville`.
 */
export async function listDirectoryCityPaths(): Promise<readonly DirectoryCityPath[]> {
  const rows = await listPublishedHotelsForGrouping();
  // Canonical country slug per ISO code (FR anchored, label-aggregated).
  const slugByCode = new Map(
    buildCountryDirectoryList(rows, 'fr').map((c) => [c.code, c.slug] as const),
  );

  const seen = new Set<string>();
  const out: DirectoryCityPath[] = [];
  for (const r of rows) {
    const paysSlug = slugByCode.get(r.country_code);
    if (paysSlug === undefined) continue;
    const villeSlug = citySlug(r.city);
    if (villeSlug.length === 0) continue;
    const key = `${paysSlug}/${villeSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ paysSlug, villeSlug });
  }
  return out;
}
