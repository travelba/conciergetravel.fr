import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import type { Locale } from '@/i18n/routing';
import { withLocalePath } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedCities } from '@/server/destinations/cities';

// ISR — fetches the destination directory at build, then revalidates hourly.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Hub sub-sitemap (skill: seo-technical).
 * Emits the `/destination` directory plus one entry per destination
 * (`/destination/<slug>`) with FR + EN alternates. Weekly changefreq —
 * the catalog evolves slowly.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const cities = await listPublishedCities();

    const directoryHrefForLocale = (l: Locale): string =>
      `${origin}${withLocalePath(l, '/destination')}`;
    entries.push({
      loc: directoryHrefForLocale('fr'),
      changefreq: 'weekly',
      priority: 0.6,
      alternates: buildSitemapAlternates(directoryHrefForLocale),
    });

    for (const c of cities) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${withLocalePath(l, `/destination/${c.slug}`)}`;
      entries.push({
        loc: hrefForLocale('fr'),
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
