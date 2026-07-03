import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { HAND_BUILT_COUNTRY_GUIDE_SLUGS } from '@/lib/destinations/hand-built-country-guides';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedCities } from '@/server/destinations/cities';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
import { isDestinationIndexable } from '@/server/hotels/indexability';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Guides sub-sitemap (skill: seo-technical, ADR-0015).
 *
 * ADR-0015 fused `/guide/[city]` into `/destination/[city]`, so every
 * published `editorial_guides` row is now served from `/destination/<slug>`
 * (the long-read is inlined on the city hub, and region/cluster/country
 * guides render standalone via `<StandaloneGuidePage>` on the same URL).
 *
 * For ~6 months this route emitted an **empty** `<urlset>` even though
 * 82 guides are published — the GSC audit (2026-06-29) flagged it as a
 * dead sitemap Google keeps downloading for nothing. We now emit one
 * entry per published guide at the URL **actually served**, never a 404:
 *
 *   - `scope = 'city'`   → `/destination/<slug>` **only if** the city hub
 *     is indexable under the D3 predicate (`isDestinationIndexable`, i.e.
 *     ≥ `DESTINATION_MIN_PUBLISHED_HOTELS` published hotels). Cities with
 *     no or too few published hotels render `noindex, follow`, so they are
 *     skipped — a sitemap must never advertise noindex.
 *   - `scope ∈ {region, cluster, country}` → `/destination/<slug>`
 *     (standalone long-read), unless a same-slug city hub shadows the
 *     guide on the page (see the D3 note in `hubs.xml`).
 *   - Hand-built country guides (`/guide/<country>` — italie, japon, …)
 *     keep `/guide/<country>` canonical and are emitted by `hubs.xml`
 *     `staticHubs`; they are `is_published = false` in `editorial_guides`
 *     so they never reach this list, but the explicit guard keeps the
 *     route correct if that flag is ever flipped.
 *   - Legacy `guide-*` rows (editorial_sections only, no renderable
 *     `sections`) have no route and are skipped.
 *
 * `<lastmod>` is the row's own `updated_at` (falling back to
 * `reviewed_at`) so the editorial freshness signal is per-URL accurate.
 *
 * Defensive try/catch keeps the route from 500-ing when Supabase is
 * degraded; an empty `<urlset>` is preferable to a missing file.
 *
 * @see docs/adr/0015-merge-guide-destination.md
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const [guides, cities] = await Promise.all([listPublishedGuides(), listPublishedCities()]);
    const cityCountBySlug = new Map(cities.map((c) => [c.slug, c.count]));

    for (const g of guides) {
      // Legacy `guide-*` twins (FR-only editorial_sections) render nowhere.
      if (g.slug.startsWith('guide-')) continue;
      // Hand-built country guides keep `/guide/<country>` canonical and are
      // listed by hubs.xml — never emit a `/destination/<handbuilt>` URL
      // (that route 308-redirects to `/guide/<handbuilt>`).
      if (HAND_BUILT_COUNTRY_GUIDE_SLUGS.has(g.slug)) continue;
      const cityCount = cityCountBySlug.get(g.slug);
      // City guides render inlined on the `/destination/<slug>` city hub.
      // D3 (2026-07-02): the hub emits `noindex, follow` below the
      // `DESTINATION_MIN_PUBLISHED_HOTELS` threshold (and when the city has
      // no published hotels at all), so the sitemap must apply the SAME
      // predicate as `hubs.xml` / `generateMetadata` — a sitemap must
      // never advertise a noindex URL.
      if (g.scope === 'city' && !isDestinationIndexable(cityCount ?? 0)) continue;
      // Region/cluster/country guides whose slug collides with a real city
      // are shadowed by the city hub on the page (see the D3 note in
      // `hubs.xml`): if the city is indexable the URL is already listed by
      // `hubs.xml`; if it is thin, the page renders noindex. Skip either way.
      if (g.scope !== 'city' && cityCount !== undefined) continue;

      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug: g.slug } },
        })}`;
      const lastmod = g.updatedAt ?? g.reviewedAt;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.7,
        ...(lastmod !== null ? { lastmod } : {}),
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }
  } catch {
    entries = [];
  }

  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
