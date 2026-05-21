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

    // Root home — highest-priority URL of the site. Without this entry
    // the sitemap index never explicitly advertises `/` and `/en`, and
    // Search Console reports "URL not in any sitemap" for the home.
    const homeHrefForLocale = (l: Locale): string =>
      `${origin}${getPathname({ locale: l, href: '/' })}`;
    entries.push({
      loc: homeHrefForLocale('fr'),
      changefreq: 'daily',
      priority: 1.0,
      alternates: buildSitemapAlternates(homeHrefForLocale),
    });

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
        | '/le-concierge/fidelite'
        | '/le-concierge/faq'
        | '/le-concierge/pour-les-hoteliers'
        | '/le-concierge/mice-et-seminaires'
        | '/le-conseil-du-concierge'
        | '/le-concierge/presse-et-partenaires'
        | '/le-concierge/newsletter'
        | '/itineraires';
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
      // Vague 5 batch 2 — Loyalty is conversion-related, FAQ is AEO-premium (35 Q&A).
      { href: '/le-concierge/fidelite', priority: 0.6 },
      { href: '/le-concierge/faq', priority: 0.7 },
      // Vague-5 P1 — B2B surfaces (hotelier partnerships + MICE events).
      // Priority 0.5 — important for revenue but lower SERP volume than
      // the consumer-facing institutional pages.
      { href: '/le-concierge/pour-les-hoteliers', priority: 0.5 },
      { href: '/le-concierge/mice-et-seminaires', priority: 0.5 },
      // Vague-5 P1 — Le Conseil du Concierge USP hub (highest priority
      // alongside the marketing pages because it carries the unique
      // value proposition).
      { href: '/le-conseil-du-concierge', priority: 0.7 },
      { href: '/le-concierge/presse-et-partenaires', priority: 0.4 },
      { href: '/le-concierge/newsletter', priority: 0.5 },
      // Bumped from 0.4 to 0.7 once the hub goes from coming-soon to a
      // real listing (PR2 — Sprint 2). `last_updated` per slug ships
      // separately in `/sitemaps/itineraries.xml` (PR3).
      { href: '/itineraires', priority: 0.7 },
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

    // ── Legal / institutional pages ──────────────────────────────────────
    // Authority pages (mentions légales, CGV, RGPD, cookies). They carry
    // EEAT signal (skill `geo-llm-optimization` §E-E-A-T) and must be
    // indexed even though they live outside the editorial flow. Until we
    // ship a dedicated `sitemap-institutionnel.xml`, the hub sitemap is
    // the right home — it already groups every static index/hub page.
    const legalHrefs: {
      href: '/mentions-legales' | '/confidentialite' | '/cgv' | '/cookies';
      priority: number;
    }[] = [
      { href: '/mentions-legales', priority: 0.4 },
      { href: '/confidentialite', priority: 0.4 },
      { href: '/cgv', priority: 0.4 },
      { href: '/cookies', priority: 0.3 },
    ];
    for (const legal of legalHrefs) {
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({ locale: l, href: legal.href })}`;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'yearly',
        priority: legal.priority,
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
