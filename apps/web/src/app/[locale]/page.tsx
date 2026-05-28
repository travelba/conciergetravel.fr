import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HomeAeoFaq, loadHomeAeoEntries } from '@/components/home/home-aeo-faq';
import { HomeClubRibbon } from '@/components/home/home-club-ribbon';
import { HomeConciergeAdviceCarousel } from '@/components/home/home-concierge-advice-carousel';
import { HomeDestinationGrid } from '@/components/home/home-destination-grid';
import { HomeEditorLetter } from '@/components/home/home-editor-letter';
import { HomeHero } from '@/components/home/home-hero';
import { HomeHotelGrid } from '@/components/home/home-hotel-grid';
import { HomeInspirationGrid } from '@/components/home/home-inspiration-grid';
import { TOP_RANKING_NAV_ENTRIES } from '@/components/layout/nav-data';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';
import { env } from '@/lib/env';
import { pickHomeDestinations } from '@/lib/home/featured-destinations';
import { getHomeFeaturedHotels } from '@/lib/home/featured-hotels';
import { listPublishedCities } from '@/server/destinations/cities';
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
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Fetch the 3 editorial datasets in parallel — they back the featured
  // sections below. Each helper is defensive (returns `[]` on Supabase
  // outages) so the home never 500s in a degraded environment. The
  // Concierge-advice carousel runs its own cached fetch (sampled with
  // a daily seed), so it sits outside this batch on purpose.
  const [featuredHotels, cities, rankings] = await Promise.all([
    getHomeFeaturedHotels(FEATURED_HOTEL_COUNT),
    listPublishedCities(),
    listPublishedRankings(),
  ]);
  const cityCounts = new Map(cities.map((c) => [c.slug, c.count] as const));
  const featuredRankings = pickFeaturedRankings(rankings);

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const agencyDescription =
    locale === 'en'
      ? `The Concierge's Selection — ${CATALOGUE_PUBLISHED} extraordinary hotels in ${CATALOGUE_COUNTRIES} countries (Palaces Atout France, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, boutique hotels). Editorial picks, operational tips per hotel, GDS net rates via our IATA agency, secure Amadeus payment, loyalty from the first night.`
      : `La sélection du Concierge — ${CATALOGUE_PUBLISHED} hôtels d'exception choisis dans ${CATALOGUE_COUNTRIES} pays (Palaces Atout France, Forbes Five Star, Michelin Keys, Relais & Châteaux, Leading Hotels of the World, boutiques-hôtels). Sélection éditoriale, conseils opérationnels par fiche, tarifs nets GDS via notre agence IATA, paiement sécurisé Amadeus, fidélité dès la première nuit.`;
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

  // ItemList of the featured hotels — surfaces the home as a small
  // editorial carousel in Google Rich Results without requiring any
  // booking-side data (Phase 1 compatible: no `Offer`, no `priceValidUntil`).
  const featuredItemListJsonLd =
    featuredHotels.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('featuredHotels.title'),
            items: featuredHotels.map((h) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
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

      {/* §1 — Hero éditorial avec vidéo + search Booking-style preview */}
      <HomeHero locale={locale} cloudName={cloudName} />

      {/* §2 — Le mot du Concierge (NEW) */}
      <HomeEditorLetter locale={locale} />

      {/* §3 — Les fiches du moment (6 hôtels, badges luxury_tier) */}
      <HomeHotelGrid locale={locale} hotels={featuredHotels} cloudName={cloudName} />

      {/* §4 — Le Conseil du Concierge (3 conseils réels sampled) */}
      <HomeConciergeAdviceCarousel locale={locale} />

      {/* §5 — Destinations (FR cities + intl countries) */}
      <HomeDestinationGrid
        locale={locale}
        destinations={pickHomeDestinations(cityCounts, locale, (count) =>
          t('featuredDestinations.countLabel', { count }),
        )}
      />

      {/* §6 — Inspirations (6 axes thème × occasion) */}
      <HomeInspirationGrid locale={locale} />

      {/* §7 — Classements éditoriaux (inline — scope sélectif) */}
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

      {/* §8 — AEO FAQ (4 Q&A) — same content as homeFaqJsonLd above */}
      <HomeAeoFaq locale={locale} entries={aeoEntries} />

      {/* §9 — Le Concierge Club ribbon */}
      <HomeClubRibbon locale={locale} />

      {/* §10 — Closing teaser (inline — scope sélectif) */}
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
