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
import { HomeOpeningsGrid } from '@/components/home/home-openings-grid';
import { HomeTopRankings } from '@/components/home/home-top-rankings';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';
import { env } from '@/lib/env';
import { pickHomeDestinations } from '@/lib/home/featured-destinations';
import { getHomeFeaturedHotels } from '@/lib/home/featured-hotels';
import { getRecentOpenings } from '@/lib/home/recent-openings';
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
  const [openings, featuredHotels, cities, rankings] = await Promise.all([
    getRecentOpenings(OPENINGS_COUNT),
    getHomeFeaturedHotels(FEATURED_HOTELS_COUNT),
    listPublishedCities(),
    listPublishedRankings(),
  ]);
  const cityCounts = new Map(cities.map((c) => [c.slug, c.count] as const));

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
    <main className="bg-bg">
      <JsonLdScript data={agencyJsonLd} nonce={nonce} />
      <JsonLdScript data={websiteSearchJsonLd} nonce={nonce} />
      <JsonLdScript data={homeFaqJsonLd} nonce={nonce} />
      {openingsItemListJsonLd !== null ? (
        <JsonLdScript data={openingsItemListJsonLd} nonce={nonce} />
      ) : null}
      {featuredItemListJsonLd !== null ? (
        <JsonLdScript data={featuredItemListJsonLd} nonce={nonce} />
      ) : null}

      {/* §1 — Hero éditorial : « MyConciergeHotel — Book like a
          concierge. » + H1 « Nous vous attendions » + chiffres
          réels (127 pays · 2 193 adresses) */}
      <HomeHero locale={locale} cloudName={cloudName} />

      {/* §2 — Le mot du Concierge (éditorial signé) */}
      <HomeEditorLetter locale={locale} />

      {/* §3 — Le Concierge a frappé à leur porte (4 dernières
          adresses passées au crible, CTA → /ouvertures) */}
      <HomeOpeningsGrid locale={locale} openings={openings} cloudName={cloudName} />

      {/* §4 — Les fiches du moment : 6 fiches sélectionnées par la
          conciergerie, mixées par tier (Palace / R&C / boutique) et
          rééquilibrées par pays via `diversifyByCountry` pour
          éviter l'effet "six Paris d'affilée" (audit 2026-05-27).
          Voir `lib/home/featured-hotels.ts` + ADR-0021 (scope mondial). */}
      <HomeHotelGrid locale={locale} hotels={featuredHotels} cloudName={cloudName} />

      {/* §5 — Trouver la bonne adresse selon l'occasion (6 axes :
          Spa, Famille, Golf, Lune de miel, Gastronomie, Rooftop) */}
      <HomeInspirationGrid locale={locale} />

      {/* §6 — Là où le Concierge aime envoyer ses clients
          (8 destinations : Paris, Côte d'Azur, Italie, Grèce,
          Japon, Maroc, États-Unis, Royaume-Uni) */}
      <HomeDestinationGrid
        locale={locale}
        destinations={pickHomeDestinations(cityCounts, locale, (count) =>
          t('featuredDestinations.countLabel', { count }),
        )}
      />

      {/* §7 — Les meilleurs hôtels, selon nos critères (6 classements
          avec le plus d'entrées, sélection automatique) */}
      <HomeTopRankings locale={locale} rankings={rankings} />

      {/* §8 — Le Conseil du Concierge × 3 (échantillon daily-rotated
          depuis 40 fiches, deterministe par UTC date — la "voix"
          opérationnelle qui referme la home avant la FAQ). */}
      <HomeConciergeAdviceCarousel locale={locale} />

      {/* §9 — Bandeau institutionnel Le Concierge Club (CTA gratuit
          + Prestige in-page anchor — ADR-0019/0020). */}
      <HomeClubRibbon locale={locale} />

      {/* §10 — Ce que vous voulez savoir (4 Q&A AEO + FAQPage JSON-LD) */}
      <HomeAeoFaq locale={locale} entries={aeoEntries} />
    </main>
  );
}
