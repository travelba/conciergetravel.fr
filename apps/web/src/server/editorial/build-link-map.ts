import 'server-only';

import type { EditorialLink, EditorialLinkMap } from '@/components/editorial/enriched-text';
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

export async function buildEditorialLinkMap(options: {
  readonly excludeGuideSlug?: string;
  readonly excludeRankingSlug?: string;
}): Promise<EditorialLinkMap> {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, EditorialLink>();

  const [hotelsRes, guidesRes, rankingsRes] = await Promise.all([
    supabase
      .from('hotels')
      .select('slug, name, brand_slug, city')
      .eq('is_published', true)
      .limit(200),
    supabase
      .from('editorial_guides')
      .select('slug, name_fr, name_en')
      .eq('is_published', true)
      .limit(200),
    supabase
      .from('editorial_rankings')
      .select('slug, title_fr, title_en')
      .eq('is_published', true)
      .limit(200),
  ]);

  // Hotels — link by full name AND short surname if distinctive.
  if (hotelsRes.data !== null) {
    for (const row of hotelsRes.data as unknown as HotelRow[]) {
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
  }

  // Cities — link to the city guide (case-insensitive will match).
  if (guidesRes.data !== null) {
    for (const row of guidesRes.data as unknown as GuideRow[]) {
      if (options.excludeGuideSlug === row.slug) continue;
      const href: EditorialLink = {
        pathname: '/guide/[citySlug]',
        params: { citySlug: row.slug },
      };
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
  }

  // Rankings — link by full title (less common to occur in body but
  // helps cross-link when one ranking mentions another).
  if (rankingsRes.data !== null) {
    for (const row of rankingsRes.data as unknown as RankingRow[]) {
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
  }

  // Brand surface — surface a handful of well-known brand names so
  // mentions like "Cheval Blanc" or "Airelles" auto-link to the brand
  // page even when the surrounding hotel is missing from our catalog.
  try {
    const brandsRes = await supabase
      .from('brands')
      .select('slug, name')
      .eq('is_published', true)
      .limit(50);
    if (brandsRes.data !== null) {
      for (const row of brandsRes.data as unknown as BrandRow[]) {
        if (row.name.length < 3) continue;
        const href: EditorialLink = {
          pathname: '/marque/[brandSlug]',
          params: { brandSlug: row.slug },
        };
        if (!map.has(row.name)) map.set(row.name, href);
      }
    }
  } catch {
    // `brands` table may not be exposed in all environments — skip silently.
  }

  return map;
}
