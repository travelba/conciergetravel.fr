import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import type { Locale } from '@/i18n/routing';
import { withLocalePath } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedRoomSlugs } from '@/server/hotels/get-room-by-slug';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Room sub-pages sub-sitemap (skill: seo-technical).
 *
 * Emits one entry per published `(hotel_slug, room_slug)` tuple — i.e. every
 * URL served by `/[locale]/hotel/[slug]/chambres/[roomSlug]`. FR + EN
 * alternates included. `changefreq=monthly` (room descriptions are stable
 * after publication) and `priority=0.6` (subordinate to the parent fiche).
 *
 * Returns an empty `<urlset>` on read error so the route never 500s.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const rooms = await listPublishedRoomSlugs();
    for (const r of rooms) {
      // Per-locale hotel-slug selection (data layer — Phase 1c).
      const hotelSlugForLocale = (l: Locale): string =>
        l === 'en' ? (r.hotelSlugEn ?? r.hotelSlugFr) : r.hotelSlugFr;
      const hrefForLocale = (l: Locale): string =>
        `${origin}${withLocalePath(l, `/hotel/${hotelSlugForLocale(l)}/chambres/${r.roomSlug}`)}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.6,
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
