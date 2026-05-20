import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listIndexableHotelSlugs } from '@/server/hotels/get-hotel-by-slug';

// ISR — fetches the published catalog at build, then revalidates hourly.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Hotels sub-sitemap (skill: seo-technical).
 * Emits one entry per published hotel slug with FR + EN alternates and a
 * weekly changefreq. Falls back to an empty `<urlset>` on any read error.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    // Indexable only — exclude catalog stubs (noindex on the page).
    const slugs = await listIndexableHotelSlugs();
    for (const s of slugs) {
      // Per-locale slug selection (data layer — Phase 1c will widen
      // `slugEn`/`slugFr` into a per-locale map keyed on routing.locales).
      const slugForLocale = (l: Locale): string => (l === 'en' ? (s.slugEn ?? s.slugFr) : s.slugFr);
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/hotel/[slug]', params: { slug: slugForLocale(l) } },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.8,
        // B9 — propagate `hotels.updated_at` as `<lastmod>` so Google /
        // Bing crawl budget targets recently-updated rows first. The
        // editorial pipeline bumps `updated_at` on any content change
        // (description, FAQ, awards, photos) via Payload `afterChange`
        // hooks, so this signal stays sharp.
        ...(s.updatedAt !== null ? { lastmod: s.updatedAt } : {}),
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
