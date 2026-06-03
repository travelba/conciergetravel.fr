import 'server-only';

import { unstable_cache } from 'next/cache';

import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { countrySlug } from '@/server/annuaire/country-slugs';
import { listPublishedHotelsForGrouping } from '@/server/destinations/cities';

/**
 * Country search source for the destination/hotel autocomplete and the
 * `/recherche` page (skill: search-engineering).
 *
 * The Algolia hotel index carries **no country field**, so "find a hotel
 * by its country" is bridged through the annuaire country directory:
 * each suggestion deep-links to `/hotels/<slug>` (ADR-0026), the
 * exhaustive per-country listing. The aggregate is read once per hour
 * (the suggest route runs on every keystroke) — never hit Supabase
 * directly from the request path.
 */

export interface CountrySuggestion {
  /** ISO 3166-1 alpha-2 (uppercase). */
  readonly code: string;
  /** Localised display name (falls back to the ISO code). */
  readonly name: string;
  /** Locale-invariant annuaire slug (FR-anchored, ADR-0008). */
  readonly slug: string;
  /** Number of published hotels in this country. */
  readonly hotelsCount: number;
}

interface CountryAggregate {
  readonly code: string;
  readonly slug: string;
  readonly labelFr: string | null;
  readonly labelEn: string | null;
  readonly hotelsCount: number;
}

/** Accent- and case-insensitive fold so `etats` matches `États-Unis`. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function buildAggregate(): Promise<readonly CountryAggregate[]> {
  const rows = await listPublishedHotelsForGrouping();
  const map = new Map<
    string,
    { labelFr: string | null; labelEn: string | null; count: number }
  >();
  for (const r of rows) {
    const existing = map.get(r.country_code);
    if (existing === undefined) {
      map.set(r.country_code, {
        labelFr: r.country_label_fr,
        labelEn: r.country_label_en,
        count: 1,
      });
    } else {
      existing.count += 1;
      if (existing.labelFr === null && r.country_label_fr !== null) {
        existing.labelFr = r.country_label_fr;
      }
      if (existing.labelEn === null && r.country_label_en !== null) {
        existing.labelEn = r.country_label_en;
      }
    }
  }

  const out: CountryAggregate[] = [];
  for (const [code, value] of map) {
    out.push({
      code,
      slug: countrySlug(value.labelFr, value.labelEn, code),
      labelFr: value.labelFr,
      labelEn: value.labelEn,
      hotelsCount: value.count,
    });
  }
  return out;
}

// Cache key shares the `intl-destinations` tag so a publish/unpublish
// hook that already revalidates the destinations directory also refreshes
// the country search source.
const cachedAggregate = unstable_cache(buildAggregate, ['catalog-countries-agg-v1'], {
  revalidate: 3600,
  tags: ['intl-destinations'],
});

/**
 * Match published countries by FR **or** EN label (accent-insensitive),
 * ranking exact prefix matches first, then by hotel count. Returns up to
 * `limit` suggestions. Degrades to `[]` on any read failure (the
 * underlying reader already collapses Supabase errors to an empty list).
 */
export async function searchCatalogCountries(
  locale: SupportedLocale,
  query: string,
  limit: number,
): Promise<readonly CountrySuggestion[]> {
  const needle = fold(query);
  if (needle.length === 0) return [];

  let aggregate: readonly CountryAggregate[];
  try {
    aggregate = await cachedAggregate();
  } catch {
    return [];
  }

  const scored: { entry: CountryAggregate; rank: number }[] = [];
  for (const entry of aggregate) {
    const fr = entry.labelFr === null ? '' : fold(entry.labelFr);
    const en = entry.labelEn === null ? '' : fold(entry.labelEn);
    const slugFolded = fold(entry.slug.replace(/-/g, ' '));
    const startsWith = fr.startsWith(needle) || en.startsWith(needle);
    const contains =
      fr.includes(needle) || en.includes(needle) || slugFolded.includes(needle);
    if (!contains) continue;
    scored.push({ entry, rank: startsWith ? 0 : 1 });
  }

  scored.sort((a, b) => a.rank - b.rank || b.entry.hotelsCount - a.entry.hotelsCount);

  return scored.slice(0, limit).map(({ entry }) => ({
    code: entry.code,
    name: pickLocalizedText(locale, entry.labelFr, entry.labelEn) ?? entry.code,
    slug: entry.slug,
    hotelsCount: entry.hotelsCount,
  }));
}

/**
 * Locale-aware `code → country name` lookup used to enrich city and hotel
 * suggestions with their country (the city index only stores
 * `country_code`). Backed by the same cached aggregate.
 */
export async function getCountryNameByCode(
  locale: SupportedLocale,
): Promise<Readonly<Record<string, string>>> {
  let aggregate: readonly CountryAggregate[];
  try {
    aggregate = await cachedAggregate();
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const entry of aggregate) {
    out[entry.code] = pickLocalizedText(locale, entry.labelFr, entry.labelEn) ?? entry.code;
  }
  return out;
}
