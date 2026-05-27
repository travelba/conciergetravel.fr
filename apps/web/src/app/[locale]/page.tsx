import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';
import { HotelImage } from '@mch/ui';

import { HomeDestinationGrid } from '@/components/home/home-destination-grid';
import { HotelImagePlaceholder } from '@/components/hotel/hotel-image-placeholder';
import { JsonLdScript } from '@/components/seo/json-ld';
import { TOP_RANKING_NAV_ENTRIES } from '@/components/layout/nav-data';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { pickHomeDestinations } from '@/lib/home/featured-destinations';
import { listPublishedCities } from '@/server/destinations/cities';
import {
  listPublishedHotelsForIndex,
  type PublishedHotelIndexCard,
} from '@/server/hotels/get-hotel-by-slug';
import {
  listPublishedRankings,
  type PublishedRankingCard,
} from '@/server/rankings/get-ranking-by-slug';

// The page reads `headers()` to forward the per-request CSP nonce to its
// inline JSON-LD scripts (skill: security-engineering §CSP). That dynamic
// API call also marks the page as fully dynamic; the explicit
// `force-dynamic` keeps the contract grep-able. Re-introducing ISR here
// would silently strip the nonce and the strict-dynamic CSP would block
// the structured data — see `components/seo/json-ld.tsx` for the design.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

const FEATURED_HOTEL_COUNT = 6;

/**
 * Home `generateMetadata` — canonical, hreflang, OG.
 *
 * Without an explicit `generateMetadata` the root layout's metadata only
 * carries the brand title; the home page is the single most important
 * URL of the site and must expose:
 *   - a unique 50-60 char title and 140-160 char meta description
 *   - `alternates.canonical` (relative — middleware normalises locale)
 *   - `alternates.languages` (fr-FR, en, x-default) for hreflang signal
 *   - locale-aware Open Graph (LCP-relevant og:locale)
 *
 * Skill: seo-technical §Metadata baseline + seo-geo.mdc §Metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: '/' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDesc'),
      type: 'website',
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
    },
  };
}

/**
 * Pick the N highest-priority published hotels for the home featured grid.
 * Prefers rows with a `hero_image` so the visual section never opens with
 * a wall of placeholders; falls back to placeholder-only entries when the
 * catalogue is still in editorial-only mode (Phase 1 — see AGENTS.md §4ter).
 */
function pickFeaturedHotels(
  rows: readonly PublishedHotelIndexCard[],
  limit: number,
): readonly PublishedHotelIndexCard[] {
  const withHero = rows.filter((r) => r.heroPublicId !== null);
  if (withHero.length >= limit) return withHero.slice(0, limit);
  // Top-up with hero-less rows so we always render `limit` cards.
  const withoutHero = rows.filter((r) => r.heroPublicId === null);
  return [...withHero, ...withoutHero].slice(0, limit);
}

function pickFeaturedRankings(
  all: readonly PublishedRankingCard[],
): readonly PublishedRankingCard[] {
  const allowed = new Set(TOP_RANKING_NAV_ENTRIES.map((e) => e.slug));
  return all.filter((r) => allowed.has(r.slug));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('homepage');
  const tCommon = await getTranslations('common');
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Fetch the 3 editorial datasets in parallel — they back the featured
  // sections below. Each helper is defensive (returns `[]` on Supabase
  // outages) so the home never 500s in a degraded environment.
  const [hotelIndex, cities, rankings] = await Promise.all([
    listPublishedHotelsForIndex(40),
    listPublishedCities(),
    listPublishedRankings(),
  ]);
  const featuredHotels = pickFeaturedHotels(hotelIndex, FEATURED_HOTEL_COUNT);
  const cityCounts = new Map(cities.map((c) => [c.slug, c.count] as const));
  const featuredRankings = pickFeaturedRankings(rankings);

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const agencyDescription =
    locale === 'en'
      ? "The Concierge's Selection — 615 extraordinary hotels in 91 countries (Palaces Atout France, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, boutique hotels). Editorial picks, operational tips per hotel, GDS net rates via our IATA agency, secure Amadeus payment, loyalty from the first night."
      : "La sélection du Concierge — 615 hôtels d'exception choisis dans 91 pays (Palaces Atout France, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, boutiques-hôtels). Sélection éditoriale, conseils opérationnels par fiche, tarifs nets GDS via notre agence IATA, paiement sécurisé Amadeus, fidélité dès la première nuit.";
  const agencyJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.travelAgencyJsonLd({
      name: 'MyConciergeHotel',
      url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
      description: agencyDescription,
      iataCode: 'FR',
    }),
  );

  // WebSite + SearchAction (Google sitelinks search box).
  // Only emitted from the home page — Google requires the `WebSite` node
  // at the site root, not on every page (ADR-0014 §2.2 + seo-geo.mdc).
  const searchUrl = `${siteUrl}${getPathname({ locale, href: '/recherche' })}`;
  const websiteSearchJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: 'MyConciergeHotel',
    url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${searchUrl}?destination={search_term_string}`,
      },
      // `query-input` is required by Google for sitelinks search box.
      // The literal string contract is fragile but mandated by schema.org.
      'query-input': 'required name=search_term_string',
    },
  });

  // AEO block (skill: geo-llm-optimization). Short, quotable answer paired
  // with a FAQPage JSON-LD payload so AI Overviews / ChatGPT Search can
  // surface the value-prop verbatim without paraphrasing.
  const aeoQuestion = t('aeo.question');
  const aeoAnswer = t('aeo.answer');
  const homeFaqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd([{ question: aeoQuestion, answer: aeoAnswer }]),
  );

  // ItemList of the featured hotels — surfaces the home as a small
  // editorial carousel in Google Rich Results without requiring any
  // booking-side data (Phase 1 compatible: no `Offer`, no `priceValidUntil`).
  const featuredItemListJsonLd =
    featuredHotels.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('featuredHotels.title'),
            items: featuredHotels.map((h) => {
              const slug = pickByLocale(locale, h.slugFr, h.slugEn ?? h.slugFr);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
              const isValidStarRating = (n: number): n is 1 | 2 | 3 | 4 | 5 =>
                n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
              return {
                name,
                url: `${siteUrl}${getPathname({
                  locale,
                  href: { pathname: '/hotel/[slug]', params: { slug } },
                })}`,
                ...(isValidStarRating(h.stars) ? { hotel: { starRating: h.stars } } : {}),
              };
            }),
          }),
        )
      : null;

  return (
    <main className="bg-bg">
      <JsonLdScript data={agencyJsonLd} nonce={nonce} />
      <JsonLdScript data={websiteSearchJsonLd} nonce={nonce} />
      <JsonLdScript data={homeFaqJsonLd} nonce={nonce} />
      {featuredItemListJsonLd !== null ? (
        <JsonLdScript data={featuredItemListJsonLd} nonce={nonce} />
      ) : null}

      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="container mx-auto max-w-screen-xl px-4 py-16 sm:py-24">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">
            {tCommon('siteName')} — {tCommon('tagline')}
          </p>
          <h1 className="text-fg font-serif text-4xl sm:text-5xl md:text-6xl">{t('title')}</h1>
          {/*
            Global-scope metrics callout (ADR-0021). Sits as a sober
            italic line under the H1 so the «91 pays · 615 adresses»
            signal is visible above the fold without competing with
            the editorial subtitle that follows.
          */}
          <p className="text-fg/70 -mt-2 font-serif text-base italic sm:text-lg">
            {t('intlBadge')}
          </p>
          <p className="text-muted max-w-prose text-lg sm:text-xl">{t('subtitle')}</p>

          <div className="text-muted mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="border-border bg-bg rounded-md border px-3 py-1.5">
              {t('trust.iata')}
            </span>
            <span className="border-border bg-bg rounded-md border px-3 py-1.5">
              {t('trust.aspst')}
            </span>
            <span className="border-border bg-bg rounded-md border px-3 py-1.5">
              {t('trust.amadeus')}
            </span>
          </div>

          {/* AEO Q&A — sits inside the hero so LLM crawlers find the
              value-prop in the first viewport without scrolling. */}
          <section
            data-aeo
            aria-labelledby="home-aeo-title"
            className="border-border bg-bg mt-6 max-w-prose rounded-lg border p-5"
          >
            <h2 id="home-aeo-title" className="text-fg font-serif text-lg">
              {aeoQuestion}
            </h2>
            <p className="text-muted mt-2 text-sm">{aeoAnswer}</p>
          </section>
        </div>
      </section>

      {/* ─── Le Concierge Club ribbon ──────────────────────────────────
          Surfaces the membership programme (ADR-0019) from the home page
          without disturbing the editorial-first hero. After the 2026-05-26
          PO consolidation both tiers (free Club + Prestige waitlist) live
          on a single landing — the ribbon now carries one canonical CTA
          and the Prestige tier is discovered in-page (`#prestige` anchor).
          Single-row framed border so it reads as institutional rather than
          promotional — Phase 1 only advertises the free tier perks
          (ADR-0020 SEA constraints). */}
      <section
        aria-labelledby="home-club-ribbon-title"
        className="border-border container mx-auto max-w-screen-xl border-t px-4 py-10 sm:py-12"
      >
        <div className="border-border bg-muted/5 flex flex-col items-start gap-5 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-2xl">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">
              {t('clubRibbon.eyebrow')}
            </p>
            <h2
              id="home-club-ribbon-title"
              className="text-fg mt-2 font-serif text-2xl sm:text-3xl"
            >
              {t('clubRibbon.title')}
            </h2>
            <p className="text-muted mt-2 text-sm sm:text-base">{t('clubRibbon.body')}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Link
              href="/le-concierge-club"
              className="border-border bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('clubRibbon.ctaDiscover')}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Featured Hotels ───────────────────────────────────────── */}
      {featuredHotels.length > 0 ? (
        <section
          aria-labelledby="home-featured-hotels"
          className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-muted text-xs uppercase tracking-[0.18em]">
                {t('featuredHotels.eyebrow')}
              </p>
              <h2
                id="home-featured-hotels"
                className="text-fg mt-2 font-serif text-3xl sm:text-4xl"
              >
                {t('featuredHotels.title')}
              </h2>
              <p className="text-muted mt-3 text-sm sm:text-base">{t('featuredHotels.subtitle')}</p>
            </div>
            <Link
              href="/hotels"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('featuredHotels.seeAll')}
            </Link>
          </div>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredHotels.map((h) => {
              const slug = pickByLocale(locale, h.slugFr, h.slugEn ?? h.slugFr);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
              return (
                <li key={h.slugFr}>
                  <article className="border-border bg-bg group h-full overflow-hidden rounded-lg border transition-shadow hover:shadow-md">
                    <Link
                      href={{ pathname: '/hotel/[slug]', params: { slug } }}
                      className="block focus-visible:outline-none"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden">
                        {h.heroPublicId !== null ? (
                          <HotelImage
                            cloudName={cloudName}
                            publicId={h.heroPublicId}
                            alt={name}
                            width={640}
                            height={480}
                            transforms="f_auto,q_auto:good,c_fill,g_auto,w_640,h_480"
                          />
                        ) : (
                          <HotelImagePlaceholder variant="thumbnail" hotelName={name} />
                        )}
                      </div>
                      <div className="p-4 sm:p-5">
                        <div className="text-muted flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
                          {h.isPalace ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                              {t('featuredHotels.palace')}
                            </span>
                          ) : (
                            <span className="border-border bg-bg rounded-md border px-2 py-0.5">
                              {'★'.repeat(h.stars)}
                            </span>
                          )}
                          <span>{h.city}</span>
                        </div>
                        <h3 className="text-fg mt-3 font-serif text-lg leading-snug">{name}</h3>
                        <p className="text-muted mt-3 inline-flex items-center text-xs underline-offset-2 group-hover:underline">
                          {t('featuredHotels.viewFiche')} →
                        </p>
                      </div>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ─── Featured Destinations (mixed FR cities + intl countries) */}
      <HomeDestinationGrid
        locale={locale}
        destinations={pickHomeDestinations(cityCounts, locale, (count) =>
          t('featuredDestinations.countLabel', { count }),
        )}
      />

      {/* ─── Featured Rankings ─────────────────────────────────────── */}
      {featuredRankings.length > 0 ? (
        <section
          aria-labelledby="home-featured-rankings"
          className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-muted text-xs uppercase tracking-[0.18em]">
                {t('featuredRankings.eyebrow')}
              </p>
              <h2
                id="home-featured-rankings"
                className="text-fg mt-2 font-serif text-3xl sm:text-4xl"
              >
                {t('featuredRankings.title')}
              </h2>
              <p className="text-muted mt-3 text-sm sm:text-base">
                {t('featuredRankings.subtitle')}
              </p>
            </div>
            <Link
              href="/classements"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('featuredRankings.seeAll')}
            </Link>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredRankings.map((r) => {
              const title = pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr);
              const summary = pickByLocale(
                locale,
                r.factualSummaryFr ?? '',
                r.factualSummaryEn ?? r.factualSummaryFr ?? '',
              );
              return (
                <li key={r.slug}>
                  <Link
                    href={{ pathname: '/classement/[slug]', params: { slug: r.slug } }}
                    className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
                  >
                    <p className="text-muted text-[10px] uppercase tracking-[0.18em]">
                      {r.entryCount > 0
                        ? t('featuredDestinations.countLabel', { count: r.entryCount })
                        : null}
                    </p>
                    <h3 className="text-fg mt-1 font-serif text-lg leading-snug">{title}</h3>
                    {summary !== '' ? (
                      <p className="text-muted mt-3 line-clamp-3 text-sm">{summary}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ─── Le Conseil du Concierge teaser ────────────────────────── */}
      <section
        aria-labelledby="home-concierge-teaser"
        className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">
            {t('conciergeTeaser.eyebrow')}
          </p>
          <h2 id="home-concierge-teaser" className="text-fg mt-3 font-serif text-3xl sm:text-4xl">
            {t('conciergeTeaser.title')}
          </h2>
          <p className="text-muted mt-4 text-base sm:text-lg">{t('conciergeTeaser.body')}</p>
          <Link
            href="/le-conseil-du-concierge"
            className="border-border bg-bg hover:bg-muted/10 focus-visible:ring-ring mt-6 inline-flex rounded-md border px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('conciergeTeaser.cta')}
          </Link>
        </div>
      </section>
    </main>
  );
}
