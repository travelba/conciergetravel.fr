import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import type { Locale } from '@/i18n/routing';
import { withLocalePath } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Editorial destination-guides sub-sitemap (skill: seo-technical).
 * Emits one entry per published guide with FR + EN alternates and a
 * monthly changefreq (long-reads change less often than fiches).
 * Falls back to an empty `<urlset>` on any read error.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const guides = await listPublishedGuides();
    for (const g of guides) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${withLocalePath(l, `/guide/${g.slug}`)}`;
      const entry: SitemapEntry = {
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.7,
        alternates: buildSitemapAlternates(hrefForLocale),
      };
      // exactOptionalPropertyTypes — only set lastmod when we actually
      // have a reviewedAt value, never as `undefined`.
      if (g.reviewedAt !== null && g.reviewedAt !== undefined) {
        (entry as { lastmod?: string }).lastmod = g.reviewedAt;
      }
      entries.push(entry);
    }
    // Also include the hub.
    const hubHrefForLocale = (l: Locale): string => `${origin}${withLocalePath(l, '/guides')}`;
    entries.unshift({
      loc: hubHrefForLocale('fr'),
      changefreq: 'weekly',
      priority: 0.6,
      alternates: buildSitemapAlternates(hubHrefForLocale),
    });
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
