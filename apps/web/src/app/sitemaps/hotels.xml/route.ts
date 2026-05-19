import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import type { Locale } from '@/i18n/routing';
import { withLocalePath } from '@/i18n/runtime';
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
        `${origin}${withLocalePath(l, `/hotel/${slugForLocale(l)}`)}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.8,
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
