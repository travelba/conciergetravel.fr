import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listItineraries } from '@/server/itineraries/list-itineraries';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Itineraries sub-sitemap (skill: seo-technical + itinerary-editorial-pipeline).
 *
 * Emits one entry per published itinerary detail page with FR + EN
 * alternates and the row's `last_updated` field as `lastmod` (triple
 * freshness sync with the `Article.dateModified` JSON-LD and the
 * `<LastUpdatedBadge />` visible UI signal — rule seo-geo.mdc §Freshness).
 *
 * Modelled on `rankings.xml` (same shape, same TTL). We deliberately
 * skip the hub (`/itineraires`) here because it is already emitted by
 * `hubs.xml` — duplicating it would just be extra crawl budget for no
 * gain.
 *
 * Defensive try/catch keeps the route from 500-ing when Supabase is
 * degraded; an empty `<urlset>` is preferable to a missing file (the
 * sitemap index keeps pointing at it).
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const itineraries = await listItineraries();
    for (const it of itineraries) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/itineraire/[slug]', params: { slug: it.slugFr } },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        lastmod: it.lastUpdated,
        changefreq: 'weekly',
        priority: 0.7,
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
