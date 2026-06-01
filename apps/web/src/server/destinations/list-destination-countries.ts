import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { HAND_BUILT_COUNTRY_GUIDE_BY_CODE } from '@/lib/destinations/hand-built-country-guides';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Per-country summary for the `/destination` directory hub.
 *
 * Aggregates every published hotel with `country_code != 'FR'` and joins
 * (in memory) the published country guides in `editorial_guides`
 * (`scope = 'country'`) so the UI can offer a direct link to the
 * editorial guide when one exists, and degrade gracefully to a catalog
 * deep-link otherwise.
 *
 * Sibling of `listInternationalCountries` in `get-international-countries.ts`,
 * which is bound to a different cache key (`intl-countries-v1`) and a
 * different consumer (homepage teaser). They are intentionally kept
 * separate so a future schema change on one doesn't ripple into the
 * other's cache entry.
 */
export interface InternationalDestinationCard {
  /** ISO 3166-1 alpha-2 code (uppercase). */
  readonly code: string;
  /** Localised label, falling back to the ISO code when both translations are null. */
  readonly name: string;
  /** Number of published hotels in this country. */
  readonly hotelCount: number;
  /**
   * Slug of the linkable country guide, when one exists. Resolves to
   * either a DB-backed editorial guide (rendered at `/destination/<slug>`)
   * or one of the 8 hand-built `/guide/<slug>` pages — see `guideRoute`.
   */
  readonly guideSlug: string | null;
  /**
   * Which route renders `guideSlug`:
   *  - `'guide'`       → hand-built `/guide/<slug>` (8 polished countries).
   *  - `'destination'` → DB-backed `<StandaloneGuidePage>` at
   *                      `/destination/<slug>`.
   *  - `null`          → no guide (country surfaced via `/hotels` anchor).
   */
  readonly guideRoute: 'guide' | 'destination' | null;
}

const HotelCountryRowSchema = z.object({
  country_code: z.string().length(2),
  country_label_fr: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
  country_label_en: z
    .string()
    .nullish()
    .transform((v) => v ?? null),
});

const GuideCountryRowSchema = z.object({
  slug: z.string().min(1),
  country_code: z.string().length(2),
});

interface CountryAggregate {
  code: string;
  labelFr: string | null;
  labelEn: string | null;
  hotelCount: number;
}

async function fetchInternationalDestinations(): Promise<readonly CountryAggregate[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('country_code, country_label_fr, country_label_en')
      .eq('is_published', true)
      .neq('country_code', 'FR')
      .limit(5000);
    if (error !== null) {
      console.error('[destinations.intl-directory] Supabase error on hotels:', {
        message: error.message,
        code: error.code,
      });
      return [];
    }
    if (!Array.isArray(data)) return [];

    const aggregates = new Map<string, CountryAggregate>();
    for (const raw of data) {
      const parsed = HotelCountryRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const row = parsed.data;
      const existing = aggregates.get(row.country_code);
      if (existing === undefined) {
        aggregates.set(row.country_code, {
          code: row.country_code,
          labelFr: row.country_label_fr,
          labelEn: row.country_label_en,
          hotelCount: 1,
        });
      } else {
        existing.hotelCount += 1;
        // Backfill labels lazily so a missing translation on one row
        // doesn't drop the whole country off the directory.
        if (existing.labelFr === null && row.country_label_fr !== null) {
          existing.labelFr = row.country_label_fr;
        }
        if (existing.labelEn === null && row.country_label_en !== null) {
          existing.labelEn = row.country_label_en;
        }
      }
    }
    return [...aggregates.values()];
  } catch (e) {
    console.error(
      '[destinations.intl-directory] fetchInternationalDestinations threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Returns a plain object `code -> guideSlug`.
 *
 * **Why not a `Map`?** This function is wrapped in `unstable_cache`,
 * which JSON-serializes the return value before persisting it. `Map`
 * (and `Set`) are not JSON-serializable, so they round-trip as `{}` —
 * the consumer then crashes with `TypeError: x.get is not a function`
 * on every cache hit after the first in-memory miss. Use a plain
 * record for any cached aggregate keyed by a primitive.
 */
async function fetchPublishedCountryGuides(): Promise<Readonly<Record<string, string>>> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('editorial_guides')
      .select('slug, country_code')
      .eq('is_published', true)
      .eq('scope', 'country')
      // Exclude the legacy `guide-*` rows: they only carry
      // `editorial_sections` (no renderable `sections`) so they 404 at
      // `/destination/<slug>` until their Tranche 2 conversion renames
      // them to a plain slug. Only plain-slug country guides are
      // currently linkable at `/destination`.
      .not('slug', 'like', 'guide-%');
    if (error !== null || !Array.isArray(data)) return {};
    const out: Record<string, string> = {};
    for (const raw of data) {
      const parsed = GuideCountryRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      // First wins — a country should only have a single canonical
      // guide; if duplicates ever appear the deterministic ordering of
      // the Supabase response is preserved.
      const code = parsed.data.country_code.toUpperCase();
      if (!(code in out)) out[code] = parsed.data.slug;
    }
    return out;
  } catch (e) {
    console.error(
      '[destinations.intl-directory] fetchPublishedCountryGuides threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return {};
  }
}

/**
 * Cached, locale-aware accessor returning every country that has at
 * least one published hotel, sorted by hotel count desc then by name.
 *
 * Cache TTL: 1 h, tagged `intl-destinations` — back-office hooks that
 * publish a new hotel or country guide should `revalidateTag` to
 * refresh.
 */
export async function listInternationalDestinations(
  locale: SupportedLocale,
): Promise<readonly InternationalDestinationCard[]> {
  const [aggregates, guideSlugs] = await Promise.all([cachedAggregates(), cachedGuideSlugs()]);

  const cards: InternationalDestinationCard[] = aggregates.map((row) => {
    const name = pickLocalizedText(locale, row.labelFr, row.labelEn) ?? row.code;
    // Hand-built country pages win over a DB row (the 4 clean rows whose
    // country also has a hand-built page were unpublished, but we still
    // route the country to its polished `/guide/<slug>` page).
    const handBuilt = HAND_BUILT_COUNTRY_GUIDE_BY_CODE[row.code];
    const dbGuide = guideSlugs[row.code];
    const guideSlug = handBuilt ?? dbGuide ?? null;
    const guideRoute: 'guide' | 'destination' | null =
      handBuilt !== undefined ? 'guide' : dbGuide !== undefined ? 'destination' : null;
    return {
      code: row.code,
      name,
      hotelCount: row.hotelCount,
      guideSlug,
      guideRoute,
    };
  });

  cards.sort((a, b) => {
    if (b.hotelCount !== a.hotelCount) return b.hotelCount - a.hotelCount;
    return a.name.localeCompare(b.name, locale);
  });

  return cards;
}

const cachedAggregates = unstable_cache(
  fetchInternationalDestinations,
  ['intl-destinations-aggregates-v1'],
  { revalidate: 3600, tags: ['intl-destinations'] },
);

// Cache key bumped to v2 in the same commit that switched the return
// shape from `Map` to `Record`. Old v1 entries in the Vercel data cache
// persisted a JSON-serialised empty Map (`{}`) and would crash the
// new consumer if served. The bump guarantees a fresh fetch on the
// first request after deploy.
const cachedGuideSlugs = unstable_cache(
  fetchPublishedCountryGuides,
  ['intl-destinations-guide-slugs-v2'],
  { revalidate: 3600, tags: ['intl-destinations', 'editorial-guides'] },
);
