import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { loadHomeAeoEntries } from '@/components/home/home-aeo-faq';
import { HomeClubRibbon } from '@/components/home/home-club-ribbon';
import { HomeConciergeFeature } from '@/components/home/home-concierge-feature';
import { HomeDestinationGrid } from '@/components/home/home-destination-grid';
import { HomeEditorLetter } from '@/components/home/home-editor-letter';
import { HomeHero } from '@/components/home/home-hero';
import { HomeHotelGrid } from '@/components/home/home-hotel-grid';
import { HomeInspirationGrid } from '@/components/home/home-inspiration-grid';
import { HomeKitFooter } from '@/components/home/home-kit-footer';
import { HomeKitHeader } from '@/components/home/home-kit-header';
import { HomeKitReveal } from '@/components/home/home-kit-reveal';
import { HomeOpeningsGrid } from '@/components/home/home-openings-grid';
import { HomeTopRankings } from '@/components/home/home-top-rankings';
import { HomeTrustBar } from '@/components/home/home-trust-bar';
import { SeoJsonLd } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { getDestinationHeroImages, pickHomeDestinations } from '@/lib/home/featured-destinations';
import { getHomeFeaturedHotels } from '@/lib/home/featured-hotels';
import { getRecentOpenings } from '@/lib/home/recent-openings';
import { buildWebsiteJsonLd } from '@/lib/jsonld/brand-organization';
import { listPublishedCities } from '@/server/destinations/cities';
import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';

// The page reads `headers()` to forward the per-request CSP nonce to its
// inline JSON-LD scripts (skill: security-engineering §CSP). That dynamic
// API call also marks the page as fully dynamic; the explicit
// `force-dynamic` keeps the contract grep-able. Re-introducing ISR here
// would silently strip the nonce and the strict-dynamic CSP would block
// the structured data — see `components/seo/json-ld.tsx` for the design.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

const OPENINGS_COUNT = 4;
const FEATURED_HOTELS_COUNT = 6;

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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('homepage');
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Four editorial datasets in parallel — back the openings strip,
  // the featured hotels grid, the destinations grid and the rankings
  // strip. Each helper is defensive (returns `[]` on Supabase
  // outages) so the home never 500s in a degraded environment. The
  // AEO entries + the Concierge advice picks load separately
  // downstream (no DB call for AEO; the advice carousel performs its
  // own cached fetch inside its RSC).
  const [openings, featuredHotels, cities, rankings, destinationHeroImages] = await Promise.all([
    getRecentOpenings(OPENINGS_COUNT),
    getHomeFeaturedHotels(FEATURED_HOTELS_COUNT),
    listPublishedCities(),
    listPublishedRankings(),
    getDestinationHeroImages(),
  ]);
  const cityCounts = new Map(cities.map((c) => [c.slug, c.count] as const));

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // The brand TravelAgency (Organization) node is emitted site-wide from
  // `[locale]/layout.tsx` (single source of truth, stable `@id`). The home
  // no longer re-declares it — it only references it via `WebSite.publisher`.

  // WebSite + SearchAction (Google sitelinks search box). Built from the
  // shared factory (alongside the brand Organization) and emitted ONLY here,
  // from the site root — Google expects the `WebSite` node at the root, not on
  // every page (ADR-0014 §2.2 + seo-geo.mdc). `publisher` references the global
  // brand Organization by `@id` so the two root nodes form one connected graph.
  const websiteJsonLd = buildWebsiteJsonLd(locale);

  // AEO entries (skill: geo-llm-optimization). The same list backs the
  // visible `<HomeAeoFaq>` block AND the `FAQPage` JSON-LD payload — DOM
  // ↔ JSON-LD parity is mandatory per Google's FAQPage policy (see
  // seo-geo.mdc §AEO). Loading once and threading the array through
  // both surfaces is the single source of truth.
  const aeoEntries = await loadHomeAeoEntries(locale);
  const homeFaqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd(
      aeoEntries.map((entry) => ({ question: entry.question, answer: entry.answer })),
    ),
  );

  // ItemList of the recent openings — surfaces the home as a small
  // editorial carousel in Google Rich Results without requiring any
  // booking-side data (Phase 1 compatible: no `Offer`, no
  // `priceValidUntil`). Mirrors the visible `<HomeOpeningsGrid>` above.
  const isValidStarRating = (n: number): n is 1 | 2 | 3 | 4 | 5 =>
    n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
  const openingsItemListJsonLd =
    openings.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('openings.title'),
            items: openings.map((h) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
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

  // Mirror ItemList for the `<HomeHotelGrid>` (Sélection du
  // Concierge / Les fiches du moment). Same Phase-1 contract — no
  // `Offer`, no `priceValidUntil` — just an editorial cluster Google
  // can rank as a "Top picks" carousel. Distinct from the openings
  // ItemList because the slice is curated by `priority` + tier
  // diversity rather than chronological recency.
  const featuredItemListJsonLd =
    featuredHotels.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('featuredHotels.title'),
            items: featuredHotels.map((h) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
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
    <HomeKitReveal>
      <main className="mch-kit home-page">
        <SeoJsonLd
          nonce={nonce}
          nodes={[websiteJsonLd, homeFaqJsonLd, openingsItemListJsonLd, featuredItemListJsonLd]}
        />

        <HomeKitHeader />

        {/* Ordre aligné sur design/html-kit/index.html */}
        <HomeHero locale={locale} cloudName={cloudName} />
        <HomeHotelGrid locale={locale} hotels={featuredHotels} cloudName={cloudName} />
        <HomeTrustBar locale={locale} />
        <HomeConciergeFeature locale={locale} />
        <HomeOpeningsGrid locale={locale} openings={openings} cloudName={cloudName} />
        <HomeInspirationGrid locale={locale} />
        <HomeDestinationGrid
          locale={locale}
          cloudName={cloudName}
          destinations={pickHomeDestinations(
            cityCounts,
            locale,
            (count) => t('featuredDestinations.countLabel', { count }),
            destinationHeroImages,
          )}
        />
        <HomeTopRankings locale={locale} rankings={rankings} />
        <HomeClubRibbon locale={locale} />
        <HomeEditorLetter locale={locale} />
        <HomeKitFooter locale={locale} />
      </main>
    </HomeKitReveal>
  );
}
