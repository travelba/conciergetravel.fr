import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPlaceCityKeys, listPublishedPlaceParams } from '@/server/places/list-places';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Places sub-sitemap (lieux à visiter vertical, skill: seo-technical).
 *
 * Emits:
 *   - One entry per published place fiche `/lieux/[citySlug]/[placeSlug]`
 *     with FR + EN alternates (EN uses `slug_en` when set) and the row's
 *     `updated_at` as `lastmod`.
 *   - One entry per city index `/lieux/[citySlug]`.
 *
 * Defensive: an empty `<urlset>` beats a 500 when Supabase is degraded.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const [params, cities] = await Promise.all([listPublishedPlaceParams(), listPlaceCityKeys()]);

    for (const p of params) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: {
            pathname: '/lieux/[citySlug]/[placeSlug]',
            params: {
              citySlug: p.citySlug,
              placeSlug: l === 'en' && p.slugEn !== null ? p.slugEn : p.slugFr,
            },
          },
        })}`;
      const lastmod = p.updatedAt ?? undefined;
      entries.push({
        loc: hrefForLocale('fr'),
        ...(lastmod !== undefined ? { lastmod } : {}),
        changefreq: 'weekly',
        priority: 0.6,
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    for (const citySlug of cities) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/lieux/[citySlug]', params: { citySlug } },
        })}`;
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
