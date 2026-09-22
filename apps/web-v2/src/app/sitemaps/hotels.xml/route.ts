import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { DEMO_HOTELS } from '@/lib/demo-data';
import { siteOrigin } from '@/lib/site-origin';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';

export const dynamic = 'force-dynamic';

function hrefForHotel(locale: Locale, slug: string): string {
  const origin = siteOrigin();
  const path = getPathname({
    locale,
    href: { pathname: '/hotel/[slug]', params: { slug } },
  });
  return `${origin}${path}`;
}

/** Hotels sub-sitemap — demo slugs until v2 read-models wire in. */
export function GET(): NextResponse {
  const entries: SitemapEntry[] = DEMO_HOTELS.map((h) => {
    const hrefForLocale = (l: Locale) => hrefForHotel(l, h.slug);
    return {
      loc: hrefForLocale('fr'),
      changefreq: 'weekly',
      priority: 0.8,
      alternates: buildSitemapAlternates(hrefForLocale),
    };
  });

  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
