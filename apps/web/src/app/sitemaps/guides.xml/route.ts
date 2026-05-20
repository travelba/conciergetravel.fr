import { NextResponse } from 'next/server';

import { buildSitemapXml } from '@mch/seo';

/**
 * `/sitemaps/guides.xml` — empty sitemap.
 *
 * ADR-0015 fused `/guide/[city]` into `/destination/[city]`. The hub
 * sub-sitemap (`/sitemaps/hubs.xml`) already emits the destination
 * URLs, and `permanentRedirect` from `/guide/*` keeps inbound link
 * juice flowing without exposing the deprecated URLs in any sitemap.
 *
 * The sitemap index (`/sitemap.xml`) keeps referencing this route so
 * search engines that fetched it once before continue to see a valid
 * (empty) sitemap rather than a 404. Following an ADR retirement
 * cadence, this file is slated to be removed once GSC reports zero
 * recent fetches for it.
 *
 * @see docs/adr/0015-merge-guide-destination.md
 */
export const revalidate = 86400;

export function GET(): NextResponse {
  const xml = buildSitemapXml([]);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
