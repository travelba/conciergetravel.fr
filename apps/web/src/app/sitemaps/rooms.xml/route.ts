import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
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
      // Only list rooms whose sub-page is actually indexable — the page's
      // `generateMetadata` returns noindex below the thin-content threshold,
      // and a sitemap must never advertise noindex URLs (SE-1).
      if (!r.indexable) continue;
      // Per-locale hotel-slug selection (data layer — Phase 1c).
      const hotelSlugForLocale = (l: Locale): string =>
        l === 'en' ? (r.hotelSlugEn ?? r.hotelSlugFr) : r.hotelSlugFr;
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: {
            pathname: '/hotel/[slug]/chambres/[roomSlug]',
            params: { slug: hotelSlugForLocale(l), roomSlug: r.roomSlug },
          },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.6,
        // B9 — propagate `(room.updated_at | hotel.updated_at)` MAX as
        // `<lastmod>`. The reader picks the later of the two so a
        // hotel-level FAQ rewrite still re-crawls the room sub-pages.
        ...(r.updatedAt !== null ? { lastmod: r.updatedAt } : {}),
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
