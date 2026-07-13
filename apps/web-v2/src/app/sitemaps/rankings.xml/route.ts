import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { DEMO_RANKING } from '@/lib/demo-data';
import { siteOrigin } from '@/lib/site-origin';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';

export const dynamic = 'force-dynamic';

function hrefForRanking(locale: Locale, slug: string): string {
  const origin = siteOrigin();
  const path = getPathname({
    locale,
    href: { pathname: '/classement/[slug]', params: { slug } },
  });
  return `${origin}${path}`;
}

/** Rankings sub-sitemap — demo slug until editorial read-models wire in. */
export function GET(): NextResponse {
  const hrefForLocale = (l: Locale) => hrefForRanking(l, DEMO_RANKING.slug);

  const entries: SitemapEntry[] = [
    {
      loc: hrefForLocale('fr'),
      changefreq: 'weekly',
      priority: 0.7,
      alternates: buildSitemapAlternates(hrefForLocale),
    },
  ];

  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
