import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedCities } from '@/server/destinations/cities';
import { EDITORIAL_CATEGORIES } from '@/server/hotels/editorial-categories';
import { KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

// ISR — fetches the destination directory at build, then revalidates hourly.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Hub sub-sitemap (skill: seo-technical).
 * Emits the `/destination` directory plus one entry per destination
 * (`/destination/<slug>`) with FR + EN alternates. Weekly changefreq —
 * the catalog evolves slowly.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const cities = await listPublishedCities();

    const directoryHrefForLocale = (l: Locale): string =>
      `${origin}${getPathname({ locale: l, href: '/destination' })}`;
    entries.push({
      loc: directoryHrefForLocale('fr'),
      changefreq: 'weekly',
      priority: 0.6,
      alternates: buildSitemapAlternates(directoryHrefForLocale),
    });

    for (const c of cities) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug: c.slug } },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.7,
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // ── Static hub pages (ADR-0014) ──────────────────────────────────────
    // Each entry is locale-aware via `buildSitemapAlternates`.
    const staticHubs: {
      href:
        | '/inspiration'
        | '/marques'
        | '/le-concierge'
        | '/le-concierge/methode-editoriale'
        | '/le-concierge/reserver'
        | '/le-concierge/contact'
        | '/itineraire';
      priority: number;
    }[] = [
      { href: '/inspiration', priority: 0.7 },
      { href: '/marques', priority: 0.6 },
      { href: '/le-concierge', priority: 0.6 },
      // Vague 5 — institutional pages around /le-concierge. EEAT
      // methodology and the contact page are high-priority surfaces
      // (Knowledge Panel signals). "Reserver" is conversion-critical.
      { href: '/le-concierge/methode-editoriale', priority: 0.6 },
      { href: '/le-concierge/reserver', priority: 0.6 },
      { href: '/le-concierge/contact', priority: 0.5 },
      { href: '/itineraire', priority: 0.4 }, // coming-soon hub, low priority
    ];
    for (const hub of staticHubs) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({ locale: l, href: hub.href })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: hub.priority,
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // ── Editorial categories (5 palace + 7 non-palace — ADR-0016) ────────
    for (const cat of EDITORIAL_CATEGORIES) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/categorie/[categorySlug]', params: { categorySlug: cat.slug } },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.6,
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // ── Brand pages (one per `KNOWN_BRANDS` family) ──────────────────────
    for (const brand of KNOWN_BRANDS) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/marque/[brandSlug]', params: { brandSlug: brand.slug } },
        })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.5,
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
