import { NextResponse } from 'next/server';

import { buildSitemapIndexXml } from '@mch/seo';

import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

/** Sitemap index — hotels + rankings (v2 bascule prep). */
export function GET(): NextResponse {
  const origin = siteOrigin();
  const now = new Date().toISOString();

  const xml = buildSitemapIndexXml([
    { loc: `${origin}/sitemaps/hotels.xml`, lastmod: now },
    { loc: `${origin}/sitemaps/rankings.xml`, lastmod: now },
  ]);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
