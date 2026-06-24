import 'server-only';

import { unstable_cache } from 'next/cache';

import type { EditorialLink, EditorialLinkMap } from '@/components/editorial/enriched-text';
import { isHandBuiltCountrySlug } from '@/lib/destinations/hand-built-country-guides';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Builds the auto-linking dictionary consumed by `<EnrichedText />`.
 * The dictionary maps a display string (e.g. "Plaza Athénée",
 * "Cheval Blanc", "Cannes") to an internal href.
 *
 * Strategy:
 *   - Pull every published hotel: name, slug, brand_slug.
 *   - Pull every published guide: name_fr/en, slug.
 *   - Pull every published ranking: title_fr/en, slug.
 *   - Static dictionary for the 5 editorial categories
 *     (`apps/web/src/server/hotels/editorial-categories.ts`).
 *
 * Result: an `EditorialLinkMap` (i.e. `Map<displayName, typed href>`)
 * ready for the `<EnrichedText />` component to consume. Built once per
 * page render (~50ms on warm Supabase pool), so cheap enough to inline
 * into the server component lifecycle. The href shape mirrors the
 * `{ pathname, params }` literal next-intl's typed `<Link>` accepts —
 * the locale prefix is added by next-intl at render time.
 *
 * Anti-overlinking: the component itself caps auto-links to N per
 * paragraph and de-duplicates the same entity per paragraph. This
 * module just supplies the index; rendering applies the caps.
 *
 * Skill: seo-technical §internal-linking.
 */

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly brand_slug: string | null;
  readonly city: string;
}

interface GuideRow {
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string | null;
}

interface RankingRow {
  readonly slug: string;
  readonly title_fr: string;
  readonly title_en: string | null;
}

interface BrandRow {
  readonly slug: string;
  readonly name: string;
}

interface EditorialEntities {
  readonly hotels: readonly HotelRow[];
  readonly guides: readonly GuideRow[];
  readonly rankings: readonly RankingRow[];
  readonly brands: readonly BrandRow[];
}

// PostgREST caps a single response at ~1000 rows. The catalogue now holds
// 2200+ published hotels and 560+ rankings, so the legacy `.limit(200)`
// truncated ~90 % of hotels and ~65 % of rankings out of the auto-link
// corpus (B4). We paginate with `.range()` to cover everything, bounded by
// `MAX_ROWS` as a runaway guard.
const PAGE_SIZE = 1000;
const MAX_ROWS = 6000;

async function fetchAllPublishedHotels(): Promise<readonly HotelRow[]> {
  const supabase = getSupabaseAdminClient();
  const out: HotelRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('hotels')
      .select('slug, name, brand_slug, city')
      .eq('is_published', true)
      .order('slug', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error !== null || data === null) break;
    out.push(...(data as unknown as HotelRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * Loads the full published-entity corpus that feeds the auto-link map.
 * Wrapped in `unstable_cache` (1 h TTL, tag `editorial-link-map`) so the
 * multi-page hotel scan runs at most once per hour per server instance —
 * the per-render `buildEditorialLinkMap` only rebuilds the in-memory Map
 * from these cached plain arrays. A Payload publish hook can
 * `revalidateTag('editorial-link-map')` to refresh on demand.
 *
 * Cached values must be JSON-serialisable, so this returns plain row
 * arrays (never a `Map`); the typed-href Map is assembled downstream.
 */
const loadEditorialEntities = unstable_cache(
  async (): Promise<EditorialEntities> => {
    const supabase = getSupabaseAdminClient();
    const [hotels, guidesRes, rankingsRes] = await Promise.all([
      fetchAllPublishedHotels(),
      // Guides (~99) and rankings (~560) both fit under the 1000-row cap,
      // so a single generous `.limit()` covers the whole set.
      supabase
        .from('editorial_guides')
        .select('slug, name_fr, name_en')
        .eq('is_published', true)
        .limit(PAGE_SIZE),
      supabase
        .from('editorial_rankings')
        .select('slug, title_fr, title_en')
        .eq('is_published', true)
        .limit(PAGE_SIZE),
    ]);

    let brands: readonly BrandRow[] = [];
    try {
      const brandsRes = await supabase
        .from('brands')
        .select('slug, name')
        .eq('is_published', true)
        .limit(200);
      if (brandsRes.data !== null) brands = brandsRes.data as unknown as BrandRow[];
    } catch {
      // `brands` table may not be exposed in all environments — skip silently.
    }

    return {
      hotels,
      guides: guidesRes.data !== null ? (guidesRes.data as unknown as GuideRow[]) : [],
      rankings: rankingsRes.data !== null ? (rankingsRes.data as unknown as RankingRow[]) : [],
      brands,
    };
  },
  ['editorial-link-entities'],
  { revalidate: 3600, tags: ['editorial-link-map'] },
);

export async function buildEditorialLinkMap(options: {
  readonly excludeGuideSlug?: string;
  readonly excludeRankingSlug?: string;
}): Promise<EditorialLinkMap> {
  const { hotels, guides, rankings, brands } = await loadEditorialEntities();
  const map = new Map<string, EditorialLink>();

  // Hotels — link by full name AND short surname if distinctive.
  for (const row of hotels) {
    const href: EditorialLink = {
      pathname: '/hotel/[slug]',
      params: { slug: row.slug },
    };
    if (!map.has(row.name)) map.set(row.name, href);
    // Short surname: drop "Hôtel ", "Le ", "La " prefixes.
    const short = row.name.replace(/^(?:Hôtel\s+|Le\s+|La\s+|Les\s+)/iu, '');
    if (short.length >= 6 && short !== row.name && !map.has(short)) {
      map.set(short, href);
    }
  }

  // Cities — link to the city guide (case-insensitive will match).
  for (const row of guides) {
    if (options.excludeGuideSlug === row.slug) continue;
    // Canonical landing is `/destination/<slug>` post ADR-0015 (guide↔
    // destination merge) — link there directly to avoid a 308 hop in the
    // body mesh. The 8 hand-built country guides stay canonical at
    // `/guide/<slug>` (static page wins, DB row unpublished).
    const href: EditorialLink = isHandBuiltCountrySlug(row.slug)
      ? { pathname: '/guide/[citySlug]', params: { citySlug: row.slug } }
      : { pathname: '/destination/[citySlug]', params: { citySlug: row.slug } };
    if (!map.has(row.name_fr)) map.set(row.name_fr, href);
    if (
      row.name_en !== null &&
      row.name_en.length >= 3 &&
      row.name_en !== row.name_fr &&
      !map.has(row.name_en)
    ) {
      map.set(row.name_en, href);
    }
  }

  // Rankings — link by full title (less common to occur in body but
  // helps cross-link when one ranking mentions another).
  for (const row of rankings) {
    if (options.excludeRankingSlug === row.slug) continue;
    const href: EditorialLink = {
      pathname: '/classement/[slug]',
      params: { slug: row.slug },
    };
    if (!map.has(row.title_fr) && row.title_fr.length >= 8) {
      map.set(row.title_fr, href);
    }
    if (
      row.title_en !== null &&
      row.title_en.length >= 8 &&
      row.title_en !== row.title_fr &&
      !map.has(row.title_en)
    ) {
      map.set(row.title_en, href);
    }
  }

  // Brand surface — surface a handful of well-known brand names so
  // mentions like "Cheval Blanc" or "Airelles" auto-link to the brand
  // page even when the surrounding hotel is missing from our catalog.
  for (const row of brands) {
    if (row.name.length < 3) continue;
    const href: EditorialLink = {
      pathname: '/marque/[brandSlug]',
      params: { brandSlug: row.slug },
    };
    if (!map.has(row.name)) map.set(row.name, href);
  }

  return map;
}
