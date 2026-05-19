import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Rankings sub-sitemap (plan rankings-parity-yonder WS2.5 v5,
 * skill: seo-technical).
 *
 * Emits:
 *   - One entry per published ranking detail page, with FR + EN
 *     alternates and the row's `updated_at` as `lastmod` (triple
 *     freshness sync with `LastUpdatedBadge` + JSON-LD `dateModified`).
 *   - One entry per discoverable sub-hub (`/classements/[axe]/[valeur]`)
 *     so Google indexes our facetted axes.
 *
 * Defensive try/catch keeps the route from 500-ing when Supabase
 * is degraded; an empty `<urlset>` is preferable to a missing file.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const rankings = await listPublishedRankings();

    // Detail pages — one entry per ranking.
    for (const r of rankings) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/classement/[slug]', params: { slug: r.slug } },
        })}`;
      const lastmod = r.updatedAt ?? undefined;
      entries.push({
        loc: hrefForLocale('fr'),
        ...(lastmod !== undefined ? { lastmod } : {}),
        changefreq: 'weekly',
        priority: 0.7,
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // Hub.
    const hubHrefForLocale = (l: Locale): string =>
      `${origin}${getPathname({ locale: l, href: '/classements' })}`;
    entries.push({
      loc: hubHrefForLocale('fr'),
      changefreq: 'daily',
      priority: 0.8,
      alternates: buildSitemapAlternates(hubHrefForLocale),
    });

    // Sub-hubs — derived from the axes payloads.
    const seenSubhubs = new Set<string>();
    const pushSubhub = (axe: string, valeur: string): void => {
      const key = `${axe}/${valeur}`;
      if (seenSubhubs.has(key)) return;
      seenSubhubs.add(key);
      const subhubHrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/classements/[axe]/[valeur]', params: { axe, valeur } },
        })}`;
      entries.push({
        loc: subhubHrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.6,
        alternates: buildSitemapAlternates(subhubHrefForLocale),
      });
    };
    for (const r of rankings) {
      for (const ty of r.axes.types) pushSubhub('type', ty);
      for (const th of r.axes.themes) pushSubhub('theme', th);
      for (const o of r.axes.occasions) pushSubhub('occasion', o);
      if (r.axes.lieu !== undefined) pushSubhub('lieu', r.axes.lieu.slug);
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
