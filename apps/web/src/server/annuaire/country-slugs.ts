import 'server-only';

import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { citySlug, type HotelGroupRow } from '@/server/destinations/cities';

/**
 * Annuaire — country slug helpers (ADR-0026).
 *
 * There is **no `country_slug` column** in Postgres. Just like city
 * slugs (`citySlug` in `cities.ts`), the country slug is **derived at
 * runtime** from `country_label_fr` so it stays locale-invariant
 * (ADR-0008 — slugs identical across locales, anchored on the FR label).
 *
 *   `France`               → `france`
 *   `Émirats arabes unis`  → `emirats-arabes-unis`
 *   `États-Unis`           → `etats-unis`
 *
 * The reverse lookup (slug → ISO `country_code`) can't be a static map
 * because the catalogue grows; we rebuild the index from the published
 * rows the page already fetched.
 */

/**
 * Derive the canonical country slug. Anchored on the FR label so the
 * slug is the same in every locale (ADR-0008). Falls back to the EN
 * label, then to the lowercased ISO code if both labels are null.
 */
export function countrySlug(labelFr: string | null, labelEn: string | null, code: string): string {
  const base = labelFr ?? labelEn ?? '';
  const slug = citySlug(base);
  return slug.length > 0 ? slug : code.toLowerCase();
}

export interface CountryDirectoryEntry {
  /** ISO 3166-1 alpha-2 (uppercase). */
  readonly code: string;
  /** URL slug, derived from the FR label (locale-invariant). */
  readonly slug: string;
  /** Localised display name. */
  readonly name: string;
  /** Number of published hotels in this country. */
  readonly hotelCount: number;
  /** Convenience flag for the FR section of the `/hotels` index. */
  readonly isFrance: boolean;
}

/**
 * Aggregate published rows into one entry per country, sorted by hotel
 * count desc then localised name. Pure — operates on rows already read
 * by the caller (no extra Supabase round-trip).
 */
export function buildCountryDirectoryList(
  rows: readonly HotelGroupRow[],
  locale: SupportedLocale,
): readonly CountryDirectoryEntry[] {
  const map = new Map<string, { labelFr: string | null; labelEn: string | null; count: number }>();
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

  const out: CountryDirectoryEntry[] = [];
  for (const [code, value] of map) {
    out.push({
      code,
      slug: countrySlug(value.labelFr, value.labelEn, code),
      name: pickLocalizedText(locale, value.labelFr, value.labelEn) ?? code,
      hotelCount: value.count,
      isFrance: code === 'FR',
    });
  }
  out.sort((a, b) => b.hotelCount - a.hotelCount || a.name.localeCompare(b.name, locale));
  return out;
}

export interface ResolvedCountry {
  readonly code: string;
  readonly slug: string;
  readonly labelFr: string | null;
  readonly labelEn: string | null;
}

/**
 * Resolve a `[pays]` URL slug to its ISO country code.
 *
 * The match is computed against the **aggregated** label of each country
 * (first non-null `country_label_fr` / `_en` across all rows of that
 * code), NOT against an arbitrary row. This is critical: the catalogue
 * has rows with inconsistent labels for the same country (e.g. France
 * has 259 rows with `country_label_fr = null` and 101 with `'France'`).
 * Matching row-by-row would let BOTH `/hotels/fr` (from a null-label row,
 * slug `fr`) and `/hotels/france` (from a labelled row, slug `france`)
 * resolve to the same content → duplicate indexable URLs. Aggregating
 * first guarantees one canonical slug per ISO code.
 *
 * Returns `null` when no published country produces that slug (→ 404).
 */
export function resolveCountryFromRows(
  rows: readonly HotelGroupRow[],
  paysSlug: string,
): ResolvedCountry | null {
  const agg = new Map<string, { labelFr: string | null; labelEn: string | null }>();
  for (const r of rows) {
    const existing = agg.get(r.country_code);
    if (existing === undefined) {
      agg.set(r.country_code, {
        labelFr: r.country_label_fr,
        labelEn: r.country_label_en,
      });
    } else {
      if (existing.labelFr === null && r.country_label_fr !== null) {
        existing.labelFr = r.country_label_fr;
      }
      if (existing.labelEn === null && r.country_label_en !== null) {
        existing.labelEn = r.country_label_en;
      }
    }
  }

  for (const [code, labels] of agg) {
    const slug = countrySlug(labels.labelFr, labels.labelEn, code);
    if (slug === paysSlug) {
      return { code, slug, labelFr: labels.labelFr, labelEn: labels.labelEn };
    }
  }
  return null;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCountrySlug(candidate: string): boolean {
  return SLUG_RE.test(candidate);
}
