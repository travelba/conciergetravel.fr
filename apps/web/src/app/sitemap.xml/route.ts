import { NextResponse } from 'next/server';

import { buildSitemapIndexXml } from '@mch/seo';

import { env } from '@/lib/env';
import { resolveSitemapLastmods } from '@/server/sitemap/sitemap-lastmods';

// ISR — recomputes the per-sub-sitemap `<lastmod>` hourly. NOT
// `force-static`: that would freeze the lastmods at build time. We read
// the origin from validated env (never `request.url`), so dynamic
// rendering can't bake a localhost origin into the deployed file.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * Sitemap index (skill: seo-technical). Sub-sitemaps are emitted by
 * `/sitemaps/{hotels,rooms,hubs,guides,rankings,itineraries,places}.xml`.
 *
 * GSC audit 2026-06-29 §5.3 — the index previously stamped all seven
 * sub-sitemaps with the same `new Date()` generation timestamp, which
 * Google treats as an unreliable signal and ignores for recrawl
 * prioritisation. Each entry now carries the real `MAX(updated_at)` of
 * the published content it lists (`resolveSitemapLastmods`), with a
 * per-entry fallback to `now` if an aggregate fails.
 *
 * D3 crawl-focus (PO decision 2026-07-02, "coupe complète") —
 * `rooms.xml` and `places.xml` are DELISTED from the index. The room
 * sub-pages (~thousands) and the 1 158 `/lieux/*` pages stay served and
 * internally meshed, but they are removed from the crawl-priority
 * surface while site authority is ~0: submitting them alongside the
 * ~600-800 head URLs diluted the crawl budget (8 202 URLs submitted,
 * 2.3 % with impressions). REVERSIBLE — re-add the two `{ loc, lastmod }`
 * entries below (the sub-sitemap routes are untouched and keep working)
 * once authority exists to justify the wider surface. See
 * docs/audits/gsc-submission-list-2026-07.md.
 *
 * The origin is read from validated env (never `new URL(request.url)`)
 * so the deployed file always points at the production domain.
 */
export async function GET(): Promise<NextResponse> {
  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const lastmods = await resolveSitemapLastmods();
  const xml = buildSitemapIndexXml([
    { loc: `${origin}/sitemaps/hotels.xml`, lastmod: lastmods.hotels },
    // rooms.xml — delisted 2026-07-02 (D3). Route still serves; re-add here to restore.
    { loc: `${origin}/sitemaps/hubs.xml`, lastmod: lastmods.hubs },
    { loc: `${origin}/sitemaps/guides.xml`, lastmod: lastmods.guides },
    { loc: `${origin}/sitemaps/rankings.xml`, lastmod: lastmods.rankings },
    { loc: `${origin}/sitemaps/itineraries.xml`, lastmod: lastmods.itineraries },
    // places.xml — delisted 2026-07-02 (D3). Route still serves; re-add here to restore.
  ]);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
