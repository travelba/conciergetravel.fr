import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import { HAND_BUILT_COUNTRY_GUIDE_SLUGS } from '@/lib/destinations/hand-built-country-guides';
import { buildSitemapAlternates } from '@/lib/sitemap-alternates';
import { listPublishedCities } from '@/server/destinations/cities';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
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
    // ADR-0015 step 1 — lastmod for `/destination/<city>` entries
    // mirrors the editorial guide `updated_at` when one exists. The
    // city hub now hosts the long-read article inline, so the guide's
    // freshness drives the sitemap signal — Google + GPTBot pick up
    // the editorial refresh without us having to push a per-hotel
    // MAX aggregation. Hub-only cities (no guide yet) keep no
    // lastmod, which matches the previous behaviour.
    const [cities, guides] = await Promise.all([listPublishedCities(), listPublishedGuides()]);
    const guideUpdatedAtBySlug = new Map<string, string>();
    for (const g of guides) {
      const iso = g.updatedAt ?? g.reviewedAt;
      if (iso !== null) guideUpdatedAtBySlug.set(g.slug, iso);
    }

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
      const lastmod = guideUpdatedAtBySlug.get(c.slug);
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'weekly',
        priority: 0.7,
        ...(lastmod !== undefined ? { lastmod } : {}),
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // Phase 1.5 — region & cluster guides are now served standalone at
    // `/destination/<slug>` (see `standalone-guide-page.tsx`). Their slugs
    // are disjoint from city slugs, so emit one entry each with the
    // guide's own `updated_at` as lastmod. Country-scope guides stay out
    // (the 8 hand-built `/guide/<country>` pages are listed below).
    for (const g of guides) {
      if (g.scope !== 'region' && g.scope !== 'cluster') continue;
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug: g.slug } },
        })}`;
      const lastmod = g.updatedAt ?? g.reviewedAt;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.6,
        ...(lastmod !== null ? { lastmod } : {}),
        alternates: buildSitemapAlternates(hrefForLocale),
      });
    }

    // Phase 1.5 — DB-backed country guides surfaced at `/destination/<slug>`
    // (`<StandaloneGuidePage>`). Only plain-slug published country guides
    // are renderable; the legacy `guide-*` rows (editorial_sections only)
    // and the 8 hand-built `/guide/<country>` pages (listed in staticHubs
    // below) are excluded so the sitemap never advertises a 404 or a
    // duplicate of a hand-built page.
    for (const g of guides) {
      if (g.scope !== 'country') continue;
      if (g.slug.startsWith('guide-')) continue;
      if (HAND_BUILT_COUNTRY_GUIDE_SLUGS.has(g.slug)) continue;
      const hrefForLocale = (l: Locale): string =>
        `${origin}${getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug: g.slug } },
        })}`;
      const lastmod = g.updatedAt ?? g.reviewedAt;
      entries.push({
        loc: hrefForLocale('fr'),
        changefreq: 'monthly',
        priority: 0.7,
        ...(lastmod !== null ? { lastmod } : {}),
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
        | '/guide/italie'
        | '/guide/suisse'
        | '/guide/maroc'
        | '/guide/maldives'
        | '/guide/emirats-arabes-unis'
        | '/guide/japon'
        | '/guide/thailande'
        | '/guide/etats-unis'
        | '/itineraires'
        | '/ouvertures';
      priority: number;
    }[] = [
      { href: '/inspiration', priority: 0.7 },
      { href: '/marques', priority: 0.6 },
      { href: '/le-concierge', priority: 0.6 },
      // Vague-6 — all 8 international country guides indexable.
      // Priority 0.7 alongside top-funnel editorial pages because
      // each guide doubles as destination discovery + LLM citation
      // surface (long-tail queries "luxury hotel in {country}").
      { href: '/guide/italie', priority: 0.7 },
      { href: '/guide/suisse', priority: 0.7 },
      { href: '/guide/maroc', priority: 0.7 },
      { href: '/guide/maldives', priority: 0.7 },
      { href: '/guide/emirats-arabes-unis', priority: 0.7 },
      { href: '/guide/japon', priority: 0.7 },
      { href: '/guide/thailande', priority: 0.7 },
      { href: '/guide/etats-unis', priority: 0.7 },
      // Vague 5 — institutional pages around /le-concierge.
      { href: '/le-concierge/methode-editoriale', priority: 0.6 },
      { href: '/le-concierge/reserver', priority: 0.6 },
      { href: '/le-concierge/contact', priority: 0.5 },
      { href: '/le-concierge/fidelite', priority: 0.6 },
      { href: '/le-concierge/faq', priority: 0.7 },
      { href: '/le-concierge/pour-les-hoteliers', priority: 0.5 },
      { href: '/le-concierge/mice-et-seminaires', priority: 0.5 },
      { href: '/le-conseil-du-concierge', priority: 0.7 },
      { href: '/le-concierge/presse-et-partenaires', priority: 0.4 },
      { href: '/le-concierge/newsletter', priority: 0.5 },
      { href: '/itineraires', priority: 0.7 },
      // 2026-05-28 — page éditoriale "Le Concierge a frappé à leur porte"
      // (FR `/ouvertures`, EN `/openings`). Surface canonique pour les
      // 20 dernières adresses visitées ; CTA depuis le bloc home dédié.
      { href: '/ouvertures', priority: 0.6 },
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
