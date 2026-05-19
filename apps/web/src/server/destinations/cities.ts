import 'server-only';

import { z } from 'zod';

import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export type { SupportedLocale };

/**
 * Slugify a French city/region name into a URL-safe ASCII slug.
 *
 * - lowercase
 * - decompose diacritics (NFD) then strip the combining marks
 * - replace any run of non-alphanumeric with a single `-`
 * - trim leading/trailing `-`
 *
 * Examples:
 *   `Paris`             → `paris`
 *   `Antibes`           → `antibes`
 *   `Aix-en-Provence`   → `aix-en-provence`
 *   `Saint-Tropez`      → `saint-tropez`
 *   `Île-Rousse`        → `ile-rousse`
 */
export function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const stringOrNull = z
  .string()
  .nullish()
  .transform((v) => (typeof v === 'string' ? v : null));

const HotelGroupRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  slug_en: stringOrNull,
  name: z.string(),
  name_en: stringOrNull,
  city: z.string(),
  district: stringOrNull,
  // `region` is nullable since migration 0033 — international hotels
  // don't carry a French administrative region. Domestic (FR) rows
  // continue to be populated by the back-office.
  region: stringOrNull,
  // ISO 3166-1 alpha-2. Defaults to `'FR'` server-side; we still
  // enforce length here so a malformed row gets logged rather than
  // silently bucketed into the wrong group.
  country_code: z.string().length(2),
  country_label_fr: stringOrNull,
  country_label_en: stringOrNull,
  // Free-form premium label that earned the hotel its MCH listing
  // (CHECK-constrained in SQL — we keep this permissive here so a
  // schema mismatch surfaces as a Sentry log, not a silent filter).
  luxury_tier: stringOrNull,
  is_palace: z.boolean(),
  stars: z.number().int(),
  priority: z.enum(['P0', 'P1', 'P2']),
  description_fr: stringOrNull,
  description_en: stringOrNull,
  /** 8-char Amadeus property code — populated by the back-office for hotels eligible to sentiment enrichment. */
  amadeus_hotel_id: stringOrNull,
});

export type HotelGroupRow = z.infer<typeof HotelGroupRowSchema>;

const HOTELS_FOR_GROUPING_COLUMNS =
  'id, slug, slug_en, name, name_en, city, district, region, country_code, country_label_fr, country_label_en, luxury_tier, is_palace, stars, priority, description_fr, description_en, amadeus_hotel_id';

const PRIORITY_RANK: Record<HotelGroupRow['priority'], number> = { P0: 0, P1: 1, P2: 2 };

async function fetchAllPublished(): Promise<readonly HotelGroupRow[]> {
  // Both env-construction (build without secrets) and the network call may
  // throw; the destination pages tolerate an empty catalog so we coerce all
  // failure modes to `[]` here rather than scattering try/catch at every
  // call site.
  //
  // Failures are surfaced via `console.error` in every environment (including
  // production) — silent empty arrays previously hid Vercel preview env
  // misconfigurations for hours. PII never reaches this code path; the
  // logged error contains nothing user-related.
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(HOTELS_FOR_GROUPING_COLUMNS)
      .eq('is_published', true)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(2000);
    if (error) {
      console.error('[destinations.cities] Supabase returned error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }
    if (!Array.isArray(data)) {
      console.error('[destinations.cities] Supabase returned non-array data:', typeof data);
      return [];
    }
    const out: HotelGroupRow[] = [];
    let parseFailures = 0;
    for (const raw of data) {
      const parsed = HotelGroupRowSchema.safeParse(raw);
      if (parsed.success) {
        out.push(parsed.data);
      } else {
        parseFailures += 1;
      }
    }
    if (parseFailures > 0) {
      console.error('[destinations.cities] Schema validation failures:', {
        totalRows: data.length,
        parsed: out.length,
        failures: parseFailures,
      });
    }
    return out;
  } catch (e) {
    console.error(
      '[destinations.cities] fetchAllPublished threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

export interface CitySummary {
  readonly slug: string;
  readonly name: string;
  readonly region: string;
  readonly count: number;
  readonly hasPalace: boolean;
}

/**
 * Aggregates the published catalog into French city groups. One row per
 * distinct `city` value (case-sensitive — the catalog is editor-curated
 * so casing is stable). Region is taken from the **first** hotel found,
 * since a city never spans regions in the French administrative
 * division we use.
 *
 * **Scope** — French cities only. International countries are surfaced
 * separately by `listInternationalDestinations` in
 * `list-destination-countries.ts`, which the `/destination` hub renders
 * alongside this output as a second "Monde — par pays" section. The
 * `/destination/[citySlug]` detail page also stays France-only (foreign
 * destinations route through `/guide/[countrySlug]` instead, since
 * country guides are far richer than a ville-style hub).
 */
export async function listPublishedCities(): Promise<readonly CitySummary[]> {
  const all = await fetchAllPublished();
  const map = new Map<
    string,
    { name: string; region: string; count: number; hasPalace: boolean }
  >();
  for (const h of all) {
    if (h.country_code !== 'FR') continue;
    if (h.region === null) continue;
    const slug = citySlug(h.city);
    if (slug.length === 0) continue;
    const existing = map.get(slug);
    if (existing === undefined) {
      map.set(slug, { name: h.city, region: h.region, count: 1, hasPalace: h.is_palace });
    } else {
      existing.count += 1;
      if (h.is_palace) existing.hasPalace = true;
    }
  }
  const out: CitySummary[] = [];
  for (const [slug, value] of map) {
    out.push({
      slug,
      name: value.name,
      region: value.region,
      count: value.count,
      hasPalace: value.hasPalace,
    });
  }
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  return out;
}

export interface DestinationHotel {
  readonly id: string;
  readonly slug: string;
  readonly slugEn: string;
  readonly name: string;
  readonly district: string | null;
  readonly isPalace: boolean;
  readonly stars: number;
  readonly priority: HotelGroupRow['priority'];
  readonly excerpt: string;
  /** Surfaced by the destination hub so the page can batch-fetch sentiment ratings. */
  readonly amadeusHotelId: string | null;
}

export interface DestinationDetail {
  readonly slug: string;
  readonly name: string;
  readonly region: string;
  readonly hotels: readonly DestinationHotel[];
}

function pickName(row: HotelGroupRow, locale: SupportedLocale): string {
  // The FR-side column is the unprefixed `name` (not `name_fr`), so we
  // can't use `pickLocalizedText` directly — `pickByLocale` lets us
  // express "FR/DE/ES/IT take the FR column, EN takes name_en with FR
  // fallback".
  return pickByLocale(locale, row.name, row.name_en ?? row.name);
}

function pickSlugEn(row: HotelGroupRow): string {
  const en = row.slug_en;
  return en !== null && en.length > 0 ? en : row.slug;
}

function pickDescription(row: HotelGroupRow, locale: SupportedLocale): string {
  const raw = (pickLocalizedText(locale, row.description_fr, row.description_en) ?? '').trim();
  if (raw.length === 0) return '';
  const max = 180;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).replace(/[\s,;.:!?-]+$/u, '')}…`;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCitySlug(candidate: string): boolean {
  return SLUG_RE.test(candidate);
}

export async function getDestinationBySlug(
  slug: string,
  locale: SupportedLocale,
): Promise<DestinationDetail | null> {
  if (!isValidCitySlug(slug)) return null;

  const all = await fetchAllPublished();
  if (all.length === 0) return null;

  // `/destination/[city]` is FR-only until the international guide
  // pipeline ships. Reject foreign cities (and FR rows missing a region,
  // which would also break the back-compat CitySummary contract).
  const matching = all.filter(
    (h) => h.country_code === 'FR' && h.region !== null && citySlug(h.city) === slug,
  );
  const [first] = matching;
  if (first === undefined) return null;

  const cityName = first.city;
  // `first.region` is narrowed by the filter above, but TS doesn't see
  // through `Array.prototype.filter` — guard explicitly.
  if (first.region === null) return null;
  const region = first.region;

  const sorted = [...matching].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    if (a.is_palace !== b.is_palace) return a.is_palace ? -1 : 1;
    return pickName(a, locale).localeCompare(pickName(b, locale), locale);
  });

  const hotels: DestinationHotel[] = sorted.map((row) => ({
    id: row.id,
    slug: row.slug,
    slugEn: pickSlugEn(row),
    name: pickName(row, locale),
    district: row.district,
    isPalace: row.is_palace,
    stars: row.stars,
    priority: row.priority,
    excerpt: pickDescription(row, locale),
    amadeusHotelId: row.amadeus_hotel_id,
  }));

  return { slug, name: cityName, region, hotels };
}

// ───────────────────────────────────────────────────────────────────────
// International expansion (May 2026) — public catalog accessor + helpers
// ───────────────────────────────────────────────────────────────────────

/**
 * Public service-role accessor returning every published hotel row with
 * the columns needed by the grouping helpers below (and the `/hotels`
 * listing page). Equivalent to the private `fetchAllPublished` — exposed
 * so consumers stay on a single Zod-validated read path.
 *
 * Ordering: priority (P0 → P2) then `name` ASC. Failure modes collapse
 * to `[]` so the page renders an empty state rather than 500-ing on a
 * Supabase outage.
 */
export async function listPublishedHotelsForGrouping(): Promise<readonly HotelGroupRow[]> {
  return fetchAllPublished();
}

/**
 * Splits a hotel list into domestic (France) and foreign buckets based
 * on `country_code`. Used by the `/hotels` listing to render the
 * "France — par région" and "Monde — par pays" sections side by side.
 *
 * Returned arrays preserve the input ordering, which the upstream query
 * sorts by editorial `priority` then `name`. Callers may resort within
 * each bucket without disturbing the partition.
 */
export function partitionByDomesticForeign(rows: readonly HotelGroupRow[]): {
  readonly domestic: readonly HotelGroupRow[];
  readonly foreign: readonly HotelGroupRow[];
} {
  const domestic: HotelGroupRow[] = [];
  const foreign: HotelGroupRow[] = [];
  for (const r of rows) {
    if (r.country_code === 'FR') {
      domestic.push(r);
    } else {
      foreign.push(r);
    }
  }
  return { domestic, foreign };
}

export interface CountryGroup {
  readonly code: string;
  readonly label: string;
  readonly hotels: readonly HotelGroupRow[];
}

/**
 * Groups hotels by ISO `country_code`, returning a Map keyed by code in
 * insertion order (first occurrence wins). The label is resolved with
 * the locale-aware `pickByLocale` over `country_label_fr/en`, falling
 * back to the raw ISO code when both labels are null — keeps the UI
 * resilient if an editor forgets to fill the translation.
 *
 * Caller decides ordering. Typical usage on `/hotels`:
 *
 * ```ts
 * const groups = [...groupByCountry(foreign, locale).values()]
 *   .sort((a, b) => b.hotels.length - a.hotels.length);
 * ```
 */
export function groupByCountry(
  rows: readonly HotelGroupRow[],
  locale: SupportedLocale,
): Map<string, CountryGroup> {
  const out = new Map<string, CountryGroup>();
  for (const r of rows) {
    const code = r.country_code;
    const existing = out.get(code);
    if (existing === undefined) {
      const label = pickLocalizedText(locale, r.country_label_fr, r.country_label_en) ?? code;
      out.set(code, { code, label, hotels: [r] });
    } else {
      out.set(code, { ...existing, hotels: [...existing.hotels, r] });
    }
  }
  return out;
}

/**
 * Like `groupByCountry` but for regions. Skips rows with a null region
 * (international hotels). Mirrors the inline `Map<string, T[]>` loop
 * that has lived in `/hotels` page.tsx — extracted so both the listing
 * page and future destination hubs can share the canonical grouping.
 */
export interface RegionGroup {
  readonly region: string;
  readonly hotels: readonly HotelGroupRow[];
}

export function groupByRegion(rows: readonly HotelGroupRow[]): Map<string, RegionGroup> {
  const out = new Map<string, RegionGroup>();
  for (const r of rows) {
    if (r.region === null) continue;
    const existing = out.get(r.region);
    if (existing === undefined) {
      out.set(r.region, { region: r.region, hotels: [r] });
    } else {
      out.set(r.region, { ...existing, hotels: [...existing.hotels, r] });
    }
  }
  return out;
}
