import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
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
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/guide/[citySlug]', params: { citySlug: g.slug } },
        })}`;
      const entry: SitemapEntry = {
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.7,
        alternates: buildSitemapAlternates(hrefForLocale),
      };
      // B9 — prefer the later of `updated_at` (every edit) vs
      // `reviewed_at` (editorial milestone). Picking `MAX` keeps the
      // freshness signal sharp without losing the milestone marker
      // when an unrelated content patch lands.
      const lastmod =
        g.updatedAt !== null && g.reviewedAt !== null
          ? g.updatedAt > g.reviewedAt
            ? g.updatedAt
            : g.reviewedAt
          : (g.updatedAt ?? g.reviewedAt);
      if (lastmod !== null) {
        (entry as { lastmod?: string }).lastmod = lastmod;
      }
      entries.push(entry);
    }
    // Also include the hub.
    const hubHrefForLocale = (l: Locale): string =>
      `${origin}${getPathname({ locale: l, href: '/guides' })}`;
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
