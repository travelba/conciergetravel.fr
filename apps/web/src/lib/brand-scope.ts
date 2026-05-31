import type { PublishedHotelIndexCard } from '@/server/hotels/get-hotel-by-slug';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';

/**
 * ADR-0021 Vague 2 — derive the editorial scope of a brand page from the
 * actual `country_code` distribution of its published hotels. The
 * `BrandScope` discriminated union drives the `<title>`, `meta`,
 * AEO question/answer, FAQ, and visible suffix copy so the brand page
 * never claims "in France" for a brand whose published catalogue lives
 * in Asia, the Caribbean or the Maldives.
 *
 * Three scopes:
 *   - `france-only`         — every published hotel is in FR (legacy)
 *   - `single-non-france`   — every published hotel is in a single
 *                             non-FR country (Aman → MD/JP/US/…, with
 *                             only one country actually represented)
 *   - `multi-country`       — 2+ countries (FR+other or several non-FR)
 *
 * Empty input returns `null` so the caller can render a noindex empty
 * state without committing to a scope.
 *
 * Skill: seo-technical §scope-aware-copy, geo-llm-optimization §AEO.
 */
export interface BrandScopeFranceOnly {
  readonly kind: 'france-only';
  readonly count: number;
  readonly cities: readonly string[];
  readonly palaceCount: number;
}

export interface BrandScopeSingleNonFrance {
  readonly kind: 'single-non-france';
  readonly count: number;
  readonly cities: readonly string[];
  readonly palaceCount: number;
  readonly countryCode: string;
  readonly countryLabelFr: string;
  readonly countryLabelEn: string;
}

export interface BrandScopeMultiCountry {
  readonly kind: 'multi-country';
  readonly count: number;
  readonly cities: readonly string[];
  readonly palaceCount: number;
  /** ISO codes ordered by descending hotel count. */
  readonly countryCodes: readonly string[];
  /** Localised labels matching `countryCodes`, FR fallback when EN is missing. */
  readonly countryLabelsFr: readonly string[];
  readonly countryLabelsEn: readonly string[];
}

export type BrandScope = BrandScopeFranceOnly | BrandScopeSingleNonFrance | BrandScopeMultiCountry;

/**
 * Compute the brand scope from the rows that match this brand. Caller
 * is responsible for filtering by `detectBrand(...)?.slug === brand.slug`
 * before passing the array in. Returns `null` for empty input —
 * matches the empty-state contract in `apps/web/src/app/[locale]/marque/[slug]/page.tsx`.
 */
export function computeBrandScope(hotels: readonly PublishedHotelIndexCard[]): BrandScope | null {
  if (hotels.length === 0) return null;

  const cityCounts = new Map<string, number>();
  let palaceCount = 0;
  // Country tracking — one row per ISO with FR/EN labels and the
  // running hotel count. We sort by count DESC + label ASC at the end
  // so the same brand page hit twice produces a stable ordering for
  // LLM caching and snapshot tests.
  const countryRows = new Map<string, { count: number; labelFr: string; labelEn: string }>();
  for (const h of hotels) {
    cityCounts.set(h.city, (cityCounts.get(h.city) ?? 0) + 1);
    if (h.isPalace) palaceCount += 1;
    const code = h.countryCode ?? 'FR';
    const labelFr = h.countryLabelFr ?? code;
    const labelEn = h.countryLabelEn ?? labelFr;
    const cur = countryRows.get(code);
    if (cur === undefined) {
      countryRows.set(code, { count: 1, labelFr, labelEn });
    } else {
      countryRows.set(code, { ...cur, count: cur.count + 1 });
    }
  }
  const cities = Array.from(cityCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city);

  const sortedCountries = Array.from(countryRows.entries()).sort(
    (a, b) => b[1].count - a[1].count || a[1].labelFr.localeCompare(b[1].labelFr),
  );

  const firstCountry = sortedCountries[0];
  if (sortedCountries.length === 1 && firstCountry !== undefined) {
    const [code, row] = firstCountry;
    if (code === 'FR') {
      return { kind: 'france-only', count: hotels.length, cities, palaceCount };
    }
    return {
      kind: 'single-non-france',
      count: hotels.length,
      cities,
      palaceCount,
      countryCode: code,
      countryLabelFr: row.labelFr,
      countryLabelEn: row.labelEn,
    };
  }
  return {
    kind: 'multi-country',
    count: hotels.length,
    cities,
    palaceCount,
    countryCodes: sortedCountries.map(([code]) => code),
    countryLabelsFr: sortedCountries.map(([, row]) => row.labelFr),
    countryLabelsEn: sortedCountries.map(([, row]) => row.labelEn),
  };
}

/**
 * Return the localised scope suffix used in the brand page H1 +
 * `<title>` + breadcrumb tail. Mirrors the "in / dans le / au"
 * grammar the editorial voice expects.
 *
 * Examples:
 *   france-only           → "en France"
 *   single-non-france (MD)→ "aux Maldives"
 *   single-non-france (JP)→ "au Japon"
 *   single-non-france (US)→ "aux États-Unis"
 *   multi-country         → "dans le monde"
 *
 * Single non-FR countries fall back to a generic preposition ("à
 * <country>") when the editorial mapping is missing — never breaks
 * rendering, just sounds slightly less natural.
 */
export function brandScopeSuffix(scope: BrandScope, locale: Locale): string {
  switch (scope.kind) {
    case 'france-only':
      return pickByLocale(locale, 'en France', 'in France');
    case 'multi-country':
      return pickByLocale(locale, 'dans le monde', 'worldwide');
    case 'single-non-france': {
      const labelFr = scope.countryLabelFr;
      const labelEn = scope.countryLabelEn;
      const prepositionFr = COUNTRY_PREP_FR[scope.countryCode] ?? `à ${labelFr}`;
      const prepositionEn = `in ${labelEn}`;
      return pickByLocale(locale, prepositionFr, prepositionEn);
    }
  }
}

/**
 * Hand-curated FR prepositions for the ~25 single-non-FR countries
 * MyConciergeHotel actually publishes today (2026-05-28 catalogue:
 * Aman, Belmond, Six Senses, Bulgari, Auberge Resorts, Mandarin
 * Oriental, Park Hyatt …). Anything not in this map falls back to the
 * generic `à <country>` prefix at runtime.
 */
const COUNTRY_PREP_FR: Readonly<Record<string, string>> = {
  US: 'aux États-Unis',
  GB: 'au Royaume-Uni',
  IT: 'en Italie',
  ES: 'en Espagne',
  DE: 'en Allemagne',
  CH: 'en Suisse',
  PT: 'au Portugal',
  GR: 'en Grèce',
  HR: 'en Croatie',
  AT: 'en Autriche',
  TR: 'en Turquie',
  AE: 'aux Émirats arabes unis',
  SA: 'en Arabie saoudite',
  MA: 'au Maroc',
  EG: 'en Égypte',
  ZA: 'en Afrique du Sud',
  KE: 'au Kenya',
  TZ: 'en Tanzanie',
  MV: 'aux Maldives',
  TH: 'en Thaïlande',
  ID: 'en Indonésie',
  VN: 'au Vietnam',
  JP: 'au Japon',
  CN: 'en Chine',
  IN: 'en Inde',
  PH: 'aux Philippines',
  AU: 'en Australie',
  NZ: 'en Nouvelle-Zélande',
  CA: 'au Canada',
  MX: 'au Mexique',
  BR: 'au Brésil',
  AR: 'en Argentine',
  PE: 'au Pérou',
  CL: 'au Chili',
  CO: 'en Colombie',
  CR: 'au Costa Rica',
  PA: 'au Panama',
  DO: 'en République dominicaine',
  CU: 'à Cuba',
  BB: 'à la Barbade',
  TC: 'aux îles Turques-et-Caïques',
  KY: 'aux îles Caïmans',
  BS: 'aux Bahamas',
  JM: 'en Jamaïque',
  HK: 'à Hong Kong',
  SG: 'à Singapour',
  KR: 'en Corée du Sud',
  IL: 'en Israël',
  IS: 'en Islande',
  NO: 'en Norvège',
  SE: 'en Suède',
  FI: 'en Finlande',
  DK: 'au Danemark',
  NL: 'aux Pays-Bas',
  BE: 'en Belgique',
  IE: 'en Irlande',
  CZ: 'en République tchèque',
  PL: 'en Pologne',
  HU: 'en Hongrie',
  RO: 'en Roumanie',
};

/**
 * Localised cities label for AEO and FAQ copy. Returns the joined
 * top-N cities formatted with the locale's list-separator.
 */
export function brandScopeCitiesLabel(scope: BrandScope, topN = 4): string {
  return scope.cities.slice(0, topN).join(', ');
}
