import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { RelatedItinerariesList } from '@/components/cross-links/related-itineraries-list';
import { RelatedRankingsList } from '@/components/cross-links/related-rankings-list';
import { CityGuideArticle } from '@/components/destination/city-guide-article';
import { StandaloneGuidePage } from '@/components/destination/standalone-guide-page';
import type { EditorialLink, EditorialLinkMap } from '@/components/editorial/enriched-text';
import { TocSidebar } from '@/components/editorial/toc-sidebar';
import {
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_INTL_DESTINATION_NAV_ENTRIES,
  pickEntryLabel,
} from '@/components/layout/nav-data';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { getDestinationBySlug, listPublishedCities } from '@/server/destinations/cities';
import { buildEditorialLinkMap } from '@/server/editorial/build-link-map';
import { getGuideBySlug } from '@/server/guides/get-guide-by-slug';
import { getAmadeusAggregateRatingsBatch } from '@/server/hotels/get-amadeus-sentiments-batch';
import { findItinerariesForCity } from '@/server/itineraries/find-itineraries-for-context';
import { findRankingsForCity } from '@/server/rankings/find-related-rankings';

/**
 * Known city slugs surfaced by the desktop + mobile mega-menu. When a
 * deep link lands on `/destination/<slug>` with a slug from this set
 * but `getDestinationBySlug` returns `null` (i.e. the city has zero
 * published hotels yet — typical of Phase 1 where 10/15 menu cities
 * are still in draft), we render a graceful noindex empty state
 * instead of a hard `notFound()`. Off-menu slugs still 404, preserving
 * crawl budget and surfacing broken inbound links honestly.
 *
 * ADR-0016 — international city slugs (Marrakech, NYC, Tokyo, Bali,
 * Mykonos…) join the FR menu set so the same graceful empty-state
 * applies on cold deploys before the guide pipeline writes the
 * `editorial_guides` row.
 *
 * Same pattern as `categorie/[categorySlug]`, `classements/[axe]/[valeur]`
 * and `marque/[brandSlug]` (skill `seo-technical` §Indexability).
 */
const KNOWN_MENU_CITY_SLUGS = new Set<string>([
  ...TOP_DESTINATION_NAV_ENTRIES.map((e) => e.slug),
  ...TOP_INTL_DESTINATION_NAV_ENTRIES.map((e) => e.slug),
]);

/**
 * Combined nav lookup so the empty-state can resolve a friendly label
 * for any known menu slug (FR or international) without bothering
 * Supabase. Order matters: TOP_DESTINATION first preserves the
 * historical FR resolution, the int'l set is added on top.
 */
const ALL_MENU_NAV_ENTRIES = [...TOP_DESTINATION_NAV_ENTRIES, ...TOP_INTL_DESTINATION_NAV_ENTRIES];

/**
 * Rendering mode: the page reads `headers()` to forward the per-request CSP
 * nonce to its inline JSON-LD scripts (ItemList + BreadcrumbList + FAQPage),
 * which forces dynamic rendering. The explicit `force-dynamic` directive
 * locks the contract — re-enabling ISR here would silently strip the nonce
 * from the cached HTML and `strict-dynamic` CSP would block the structured
 * data, breaking SEO. Re-introducing ISR requires switching the CSP from
 * per-request nonces to build-time hashes — out of scope (see
 * `components/seo/json-ld.tsx`).
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Type guard that narrows a generic integer `stars` field (the
 * Supabase schema allows the full int range) to the `1..5` literal
 * union expected by the SEO `Hotel`/`ListItem` builders. Anything
 * outside the range yields `null` so the caller falls back to a
 * starRating-less item rather than crashing or emitting bogus JSON-LD.
 */
function narrowStars(value: number): 1 | 2 | 3 | 4 | 5 | null {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return value;
    default:
      return null;
  }
}

/**
 * Cap on the number of cities materialised at build time. After
 * ADR-0016 (international expansion), `listPublishedCities` returns
 * the FR catalogue + every distinct international city — > 200 rows.
 * Multiplied by 2 locales that's 400+ ISR pages on cold deploy. We
 * cap at the top-N by `count DESC` so the highest-traffic cities are
 * pre-rendered; the long tail still works via on-demand ISR (the
 * route stays `force-dynamic` so the cap only affects build cost).
 */
const STATIC_PARAMS_TOP_N = 100;

export async function generateStaticParams(): Promise<Array<{ locale: string; citySlug: string }>> {
  try {
    const cities = await listPublishedCities();
    const top = cities.slice(0, STATIC_PARAMS_TOP_N);
    const params: Array<{ locale: string; citySlug: string }> = [];
    for (const c of top) {
      params.push({ locale: 'fr', citySlug: c.slug });
      params.push({ locale: 'en', citySlug: c.slug });
    }
    return params;
  } catch {
    return [];
  }
}

/**
 * Renders the visible "region" line. FR cities use their administrative
 * region (e.g. "Île-de-France", "PACA"). International cities fall back
 * to their localised country label ("Maroc" / "Morocco") since
 * migration 0033 left `region` null off-FR. The fall-back ensures the
 * subtitle / breadcrumb / metadata never read "null" for foreign rows.
 */
function pickRegionLabel(
  destination: {
    readonly region: string | null;
    readonly countryLabelFr: string | null;
    readonly countryLabelEn: string | null;
    readonly countryCode: string;
  },
  locale: Locale,
): string {
  if (destination.region !== null && destination.region.length > 0) return destination.region;
  const localized = pickByLocale(locale, destination.countryLabelFr, destination.countryLabelEn);
  if (localized !== null && localized.length > 0) return localized;
  return destination.countryCode;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, citySlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'destinationPage' });

  const destination = await getDestinationBySlug(citySlug, locale);
  // No published hotel matches this slug:
  //  - on-menu slug (KNOWN_MENU_CITY_SLUGS) → render empty state under
  //    `noindex, follow` so the menu link resolves while the catalogue
  //    is being seeded.
  //  - off-menu slug → hard `noindex, nofollow` and the page will 404
  //    in the default export (preserves crawl budget).
  if (destination === null) {
    if (KNOWN_MENU_CITY_SLUGS.has(citySlug)) {
      const entry = ALL_MENU_NAV_ENTRIES.find((e) => e.slug === citySlug);
      const cityLabel = entry !== undefined ? pickEntryLabel(entry, locale) : citySlug;
      const buildCanonicalPath = (l: Locale): string =>
        getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug } },
        });
      return {
        title: t('meta.title', { city: cityLabel }),
        description: t('meta.description', { city: cityLabel, region: cityLabel }),
        alternates: {
          canonical: buildCanonicalPath(locale),
          languages: buildHreflangAlternates(buildCanonicalPath),
        },
        robots: { index: false, follow: true },
      };
    }
    // Phase 1.5 — region/cluster guides have no city destination row but
    // carry a full bilingual long-read. Serve their metadata here so the
    // standalone guide render (default export) is indexable + canonical.
    const guide = await getGuideBySlug(citySlug);
    if (guide !== null && (guide.scope === 'region' || guide.scope === 'cluster')) {
      const gName = pickByLocale(locale, guide.name_fr, guide.name_en ?? guide.name_fr);
      const gTitle =
        pickByLocale(locale, guide.meta_title_fr ?? '', guide.meta_title_en ?? '').length > 0
          ? pickByLocale(locale, guide.meta_title_fr ?? '', guide.meta_title_en ?? '')
          : pickByLocale(locale, `${gName} — Guide du Concierge`, `${gName} — Concierge guide`);
      const gDescRaw = pickByLocale(locale, guide.meta_desc_fr ?? '', guide.meta_desc_en ?? '');
      const gDesc =
        gDescRaw.length > 0
          ? gDescRaw
          : pickByLocale(locale, guide.summary_fr, guide.summary_en ?? guide.summary_fr);
      const buildGuideCanonicalPath = (l: Locale): string =>
        getPathname({
          locale: l,
          href: { pathname: '/destination/[citySlug]', params: { citySlug } },
        });
      return {
        title: gTitle,
        description: gDesc,
        alternates: {
          canonical: buildGuideCanonicalPath(locale),
          languages: buildHreflangAlternates(buildGuideCanonicalPath),
        },
        openGraph: {
          type: 'article',
          title: gTitle,
          description: gDesc,
          locale: ogLocale(locale),
          siteName: 'MyConciergeHotel',
        },
      };
    }
    return { robots: { index: false, follow: false } };
  }

  const title = t('meta.title', { city: destination.name });
  const description = t('meta.description', {
    city: destination.name,
    region: pickRegionLabel(destination, locale),
  });
  // citySlug is locale-invariant (no localized variant in destination data).
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/destination/[citySlug]', params: { citySlug } },
    });
  const canonical = buildCanonicalPath(locale);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      type: 'website',
      title,
      description,
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
    },
  };
}

export default async function DestinationHubPage({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}) {
  const { locale: raw, citySlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const destination = await getDestinationBySlug(citySlug, locale);
  if (destination === null) {
    // On-menu slug with zero published hotels → empty state (noindex
    // already set in generateMetadata).
    if (KNOWN_MENU_CITY_SLUGS.has(citySlug)) {
      const entry = ALL_MENU_NAV_ENTRIES.find((e) => e.slug === citySlug);
      const cityLabel = entry !== undefined ? pickEntryLabel(entry, locale) : citySlug;
      return <DestinationEmptyState locale={locale} cityLabel={cityLabel} />;
    }
    // Phase 1.5 — region/cluster editorial guide with no city hub: render
    // it as a standalone long-read instead of 404ing (these carry 10-12
    // bilingual sections + TOC + FAQ). City guides keep their hub-inlined
    // render below; country scope stays out (8 hand-built `/guide/<x>`
    // pages remain canonical — handled separately).
    const standaloneGuide = await getGuideBySlug(citySlug);
    if (
      standaloneGuide !== null &&
      (standaloneGuide.scope === 'region' || standaloneGuide.scope === 'cluster')
    ) {
      const origin = siteOrigin();
      const pageUrl = `${origin}${getPathname({
        locale,
        href: { pathname: '/destination/[citySlug]', params: { citySlug } },
      })}`;
      const nonce = (await headers()).get('x-nonce') ?? undefined;
      const linkMap = await buildEditorialLinkMap({ excludeGuideSlug: standaloneGuide.slug });
      return (
        <StandaloneGuidePage
          guide={standaloneGuide}
          locale={locale}
          linkMap={linkMap}
          pageUrl={pageUrl}
          origin={origin}
          nonce={nonce}
        />
      );
    }
    // Off-menu, no guide → hard 404 (preserves crawl budget).
    notFound();
  }

  // Fetch Amadeus ratings + lateral cross-links (rankings + itineraries
  // matching this city) + editorial city guide in parallel. The helpers
  // return `null`/`[]` on any error so the page degrades gracefully
  // rather than 500. Cross-links and the editorial guide are mesh
  // enhancements (ADR-0015 step 1 — see ADR-0015), not hard requirements:
  //   - cross-links absent → no Related* block
  //   - guide absent       → page renders the hub-only single-column layout
  //                          (matches the pre-merge behaviour)
  // The editorial link map only feeds the guide article so it's wrapped
  // in a thin shim that returns an empty Map when no guide is loaded —
  // saves the Supabase round-trip on the hot path of FR cities that
  // don't yet have a long-read.
  const [t, ratingsByAmadeusId, relatedRankings, relatedItineraries, guide] = await Promise.all([
    getTranslations('destinationPage'),
    getAmadeusAggregateRatingsBatch(destination.hotels.map((h) => h.amadeusHotelId)),
    findRankingsForCity({ citySlug, limit: 6 }),
    findItinerariesForCity({ citySlug, limit: 4 }),
    getGuideBySlug(citySlug),
  ]);
  // Build the link map only when a guide will actually render — keeps
  // the Supabase budget on hub-only cities at zero extra reads.
  const linkMap: EditorialLinkMap =
    guide !== null
      ? await buildEditorialLinkMap({ excludeGuideSlug: guide.slug })
      : new Map<string, EditorialLink>();
  const origin = siteOrigin();
  const pageUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/destination/[citySlug]', params: { citySlug } },
  })}`;

  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: t('meta.title', { city: destination.name }),
      items: destination.hotels.map((h) => {
        const rating =
          h.amadeusHotelId !== null ? (ratingsByAmadeusId.get(h.amadeusHotelId) ?? null) : null;
        // Only upgrade to a `Hotel`-nested ListItem when we have a
        // publishable rating; otherwise keep the lean navigational
        // shape so we don't dilute the structured-data signal.
        const stars = narrowStars(h.stars);
        // Slug selection stays locale-aware (data-layer concern) until
        // ADR-0012 Phase 3 — see docs/runbooks/i18n-v2-rollout.md. V2
        // locales fall back to the FR slug until migration 0034.
        const hotelSlugForLocale = pickByLocale(locale, h.slug, h.slugEn);
        return {
          name: h.name,
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/hotel/[slug]', params: { slug: hotelSlugForLocale } },
          })}`,
          ...(rating !== null
            ? {
                hotel: {
                  ...(stars !== null ? { starRating: stars } : {}),
                  aggregateRating: {
                    ratingValue: rating.ratingValue,
                    reviewCount: rating.reviewCount,
                    bestRating: rating.bestRating,
                    worstRating: rating.worstRating,
                  },
                },
              }
            : {}),
        };
      }),
    }),
  );

  // Breadcrumb : Home > Destinations > [City]. The previous variant
  // pointed the parent to `/recherche` (search form) which is misleading
  // for users *and* dilutes the `/destination` directory in JSON-LD
  // (skill `seo-technical` §Anti-cannibalisation: every breadcrumb level
  // must point to the canonical hub for that depth, not to a sibling).
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      {
        name: t('breadcrumb.destinations'),
        url: `${origin}${getPathname({ locale, href: '/destination' })}`,
      },
      { name: destination.name, url: pageUrl },
    ]),
  );

  // AEO block — visible only (no JSON-LD here). The canonical FAQPage
  // JSON-LD is emitted below over the 10 canonical city Q&A so that
  // ADR-0011 C1 ("exactly one FAQPage per page") is respected — the
  // AEO question is also the first FAQ item, ensuring the LLM can
  // still extract it as the lead answer.
  const today = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    dateStyle: 'long',
  }).format(new Date());
  const count = destination.hotels.length;
  const regionLabel = pickRegionLabel(destination, locale);
  const aeoAnswer = t(count === 1 ? 'aeo.answerSingular' : 'aeo.answerPlural', {
    count,
    city: destination.name,
    region: regionLabel,
    date: today,
  });
  const aeoQuestion = t('aeo.question', { city: destination.name });

  // Canonical 10-Q FAQ payload — templated per city via i18n `{city}`
  // placeholder. The AEO Q&A is prepended as item[0] so the FAQPage
  // JSON-LD opens with the same answer surfaced visibly above.
  //
  // ADR-0015 step 1 — when a city guide exists, its `faq` rows whose
  // `section_anchor` is `null` (i.e. global, not contextual) are
  // appended to the canonical 10-Q list so the page stays a single
  // `FAQPage` (ADR-0011 C1). Section-anchored rows live next to their
  // section heading (rendered inline below) and are not duplicated in
  // the page-level FAQ to avoid bloating the JSON-LD.
  interface FaqEntry {
    readonly q: string;
    readonly a: string;
  }
  const cityFaqRaw = t.raw('cityFaq.items') as FaqEntry[];
  const cityFaqResolved = cityFaqRaw.map((it) => ({
    question: it.q.replace(/\{city\}/g, destination.name),
    answer: it.a.replace(/\{city\}/g, destination.name),
  }));
  const guideGlobalFaq =
    guide !== null
      ? guide.faq
          .filter(
            (f) =>
              (typeof f.section_anchor !== 'string' || f.section_anchor.length === 0) &&
              pickByLocale(locale, f.question_fr, f.question_en).length > 0 &&
              pickByLocale(locale, f.answer_fr, f.answer_en).length > 0,
          )
          .map((f) => ({
            question: pickByLocale(locale, f.question_fr, f.question_en),
            answer: pickByLocale(locale, f.answer_fr, f.answer_en),
          }))
      : [];
  const allFaqItems = [
    { question: aeoQuestion, answer: aeoAnswer },
    ...cityFaqResolved,
    ...guideGlobalFaq,
  ];
  const faqJsonLd = JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(allFaqItems));

  // `Place` JSON-LD for the city itself — gives LLM crawlers a stable
  // entity anchor for the destination separate from the hotel list.
  // GeoCoordinates omitted (server data model doesn't expose city
  // centroid yet — to be added in a future PR with `pois` table).
  // ADR-0016 — `addressCountry` mirrors the real ISO-2 code (FR / MA /
  // US / JP …) instead of the previous hard-coded `'FR'`. `addressRegion`
  // and `containedInPlace.name` fall back to the localised country
  // label when the FR-region is null (international rows since
  // migration 0033). LLM crawlers see a self-consistent address.
  const placeJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Place',
    '@id': `${pageUrl}#place`,
    name: destination.name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: destination.name,
      addressRegion: regionLabel,
      addressCountry: destination.countryCode,
    },
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: regionLabel,
    },
  });

  // Freshness signal — visible badge synced with the AEO `date` cue.
  // When a guide exists we anchor the badge on the guide's
  // `updated_at` (the most recent editorial touch); otherwise we fall
  // back to today's date so the badge always renders. The same value
  // is fed to the `Article` JSON-LD `dateModified` to keep the visible
  // surface and the structured-data signal in sync (rule from skill
  // `seo-technical` §Freshness signals).
  const latestUpdateIso =
    guide !== null && guide.updated_at !== null ? guide.updated_at : new Date().toISOString();

  // ADR-0015 step 1 — Article JSON-LD when a guide exists. `@id` and
  // `isPartOf` tie the article to the city `Place` node so an LLM
  // crawler sees a single editorial entity rather than two
  // disconnected nodes (Place + free-floating Article). `inLanguage`
  // mirrors the hreflang key so the structured data and the
  // hreflang/alternates contract stay aligned across locales.
  const articleJsonLd =
    guide !== null
      ? JsonLd.withSchemaOrgContext({
          ...JsonLd.articleJsonLd({
            headline: pickByLocale(
              locale,
              `Guide du Concierge — ${guide.name_fr}`,
              `Concierge guide — ${guide.name_en ?? guide.name_fr}`,
            ),
            url: pageUrl,
            description: pickByLocale(
              locale,
              guide.summary_fr,
              guide.summary_en ?? guide.summary_fr,
            ),
            datePublished:
              guide.reviewed_at ?? guide.updated_at ?? new Date().toISOString().slice(0, 10),
            dateModified:
              guide.updated_at ?? guide.reviewed_at ?? new Date().toISOString().slice(0, 10),
            author: {
              name: guide.author_name ?? 'MyConciergeHotel Éditorial',
              ...(guide.author_url !== null ? { url: `${origin}${guide.author_url}` } : {}),
            },
            publisher: { name: 'MyConciergeHotel', logoUrl: `${origin}/logo.png` },
            inLanguage: hreflangKey(locale),
          }),
          '@id': `${pageUrl}#guide-article`,
          isPartOf: { '@id': `${pageUrl}#place` },
        })
      : null;

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // ADR-0015 step 1 — when a guide exists we render in a 2-col layout
  // (1fr | 240px sticky TOC) so the long-read sidebar stays visible
  // while the reader scrolls. Hub-only cities (no editorial guide
  // yet) keep the historical single-col `max-w-editorial` for a
  // tighter reading column.
  const has2ColLayout = guide !== null;

  return (
    <main
      className={
        has2ColLayout
          ? 'container mx-auto max-w-7xl px-4 py-10 sm:py-14'
          : 'max-w-editorial container mx-auto px-4 py-10 sm:py-14'
      }
    >
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={placeJsonLd} nonce={nonce} />
      {articleJsonLd !== null ? <JsonLdScript data={articleJsonLd} nonce={nonce} /> : null}
      <JsonLdScript data={faqJsonLd} nonce={nonce} />

      <nav aria-label={t('breadcrumb.destinations')} className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/destination" className="hover:underline">
              {t('breadcrumb.destinations')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {destination.name}
          </li>
        </ol>
      </nav>

      <div className={has2ColLayout ? 'lg:grid lg:grid-cols-[1fr_240px] lg:gap-10' : ''}>
        <div className={has2ColLayout ? 'min-w-0' : ''}>
          <header className="mb-10">
            <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
            <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
              {t('title', { city: destination.name })}
            </h1>
            <p className="text-muted mt-3 text-lg sm:text-xl">
              {t('subtitle', { count, city: destination.name, region: regionLabel })}
            </p>
            <LastUpdatedBadge isoDate={latestUpdateIso} locale={locale} variant="inline" />
          </header>

          <section
            data-aeo
            aria-labelledby="aeo-title"
            className="border-border bg-bg mb-12 rounded-lg border p-5"
          >
            <h2 id="aeo-title" className="text-fg font-serif text-lg">
              {aeoQuestion}
            </h2>
            <p className="text-muted mt-2 text-sm">{aeoAnswer}</p>
          </section>

          {destination.hotels.length === 0 ? (
            <p className="text-muted text-sm">{t('empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {destination.hotels.map((hotel) => {
                const slugForLocale = pickByLocale(locale, hotel.slug, hotel.slugEn);
                const rating =
                  hotel.amadeusHotelId !== null
                    ? (ratingsByAmadeusId.get(hotel.amadeusHotelId) ?? null)
                    : null;
                return (
                  <li key={hotel.id}>
                    <article className="border-border bg-bg flex h-full flex-col rounded-lg border p-5">
                      <header className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-fg font-serif text-xl">
                          <Link
                            href={{ pathname: '/hotel/[slug]', params: { slug: slugForLocale } }}
                            className="hover:underline"
                          >
                            {hotel.name}
                          </Link>
                        </h2>
                        <p className="text-muted text-xs">
                          {hotel.isPalace
                            ? t('card.palace')
                            : t('card.stars', { count: hotel.stars })}
                        </p>
                      </header>
                      {hotel.district !== null && hotel.district.length > 0 ? (
                        <p className="text-muted mt-1 text-xs uppercase tracking-[0.14em]">
                          {hotel.district}
                        </p>
                      ) : null}
                      {rating !== null ? (
                        <p
                          className="text-fg mt-2 inline-flex items-center gap-1.5 text-xs"
                          data-testid="destination-card-rating"
                          aria-label={t('card.ratingAria', {
                            value: rating.ratingValue.toFixed(1),
                            best: rating.bestRating,
                            count: rating.reviewCount,
                          })}
                        >
                          <span aria-hidden>★</span>
                          <span className="font-medium tabular-nums">
                            {t('card.ratingScore', {
                              value: rating.ratingValue.toFixed(1),
                              best: rating.bestRating,
                            })}
                          </span>
                          <span className="text-muted">
                            {t('card.ratingReviews', { count: rating.reviewCount })}
                          </span>
                        </p>
                      ) : null}
                      {hotel.excerpt.length > 0 ? (
                        <p className="text-muted mt-3 text-sm">{hotel.excerpt}</p>
                      ) : null}
                      <p className="mt-4">
                        <Link
                          href={{ pathname: '/hotel/[slug]', params: { slug: slugForLocale } }}
                          className="text-fg text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {t('card.viewHotel')} →
                        </Link>
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {/*
        ADR-0015 step 1 — when an `editorial_guides` row exists for this
        slug, render the long-read editorial article between the hotel
        grid and the cross-link blocks. The 33 published city guides
        carry ~12 sections, 16 TOC anchors, 4-10 sources, 4 callouts,
        ~30 FAQ rows. The guide's section-level FAQs render inline near
        their anchor (handled by `<CityGuideArticle>`) while its
        global FAQ rows are merged into the canonical 10-Q FAQ above.
      */}
          {guide !== null ? (
            <CityGuideArticle guide={guide} locale={locale} linkMap={linkMap} />
          ) : null}

          {relatedRankings.length > 0 ? (
            <div className="mt-12">
              <RelatedRankingsList
                locale={locale}
                heading={pickByLocale(
                  locale,
                  `Classements éditoriaux à ${destination.name}`,
                  `Editorial rankings in ${destination.name}`,
                )}
                intro={pickByLocale(
                  locale,
                  `Nos classements MyConciergeHotel autour de ${destination.name} — sélections par étoiles, par thématique et par occasion.`,
                  `Our MyConciergeHotel rankings around ${destination.name} — by stars, theme and occasion.`,
                )}
                rankings={relatedRankings}
                cta={pickByLocale(locale, 'Lire le classement', 'Read the ranking')}
              />
            </div>
          ) : null}

          {relatedItineraries.length > 0 ? (
            <div className="mt-12">
              <RelatedItinerariesList
                locale={locale}
                heading={pickByLocale(
                  locale,
                  `Itinéraires Concierge passant par ${destination.name}`,
                  `Concierge itineraries through ${destination.name}`,
                )}
                intro={pickByLocale(
                  locale,
                  `Combinez ${destination.name} avec d'autres étapes — itinéraires multi-villes pensés par notre conciergerie.`,
                  `Combine ${destination.name} with other stops — multi-city itineraries crafted by our concierge desk.`,
                )}
                itineraries={relatedItineraries}
                cta={pickByLocale(locale, "Voir l'itinéraire", 'View the itinerary')}
              />
            </div>
          ) : null}

          {/*
        Canonical 10-Q FAQ (skill `geo-llm-optimization` §FAQ extraction).
        The accordion mirrors the JSON-LD `FAQPage` emitted at the top
        of the page so the DOM and the structured data carry the same
        text — LLM crawlers extract the visible `<details>` content and
        Google rich results use the JSON-LD. First item rendered `open`
        so the lead answer is in the DOM at load.
      */}
          <section
            aria-labelledby="destination-city-faq-title"
            className="border-border mt-12 border-t pt-10"
          >
            <h2
              id="destination-city-faq-title"
              className="text-fg mb-6 font-serif text-2xl sm:text-3xl"
            >
              {t('cityFaq.title', { city: destination.name })}
            </h2>
            <div className="flex flex-col gap-3">
              {allFaqItems.map((item, idx) => (
                <details
                  key={item.question}
                  open={idx === 0}
                  className="border-border bg-bg group rounded-lg border p-4"
                >
                  <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-base [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className="h-4 w-4 opacity-60 transition group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="text-muted mt-2 text-sm md:text-base">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
        {has2ColLayout && guide !== null ? (
          <aside className="hidden lg:block">
            <TocSidebar anchors={guide.toc_anchors} locale={locale} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Empty-state surface for on-menu city slugs that have zero published
 * hotels yet (typical of Phase 1 where 10/15 `TOP_DESTINATION_NAV_ENTRIES`
 * cities are still drafts). Mirrors the noindex empty state used by
 * `categorie/[categorySlug]` and `classements/[axe]/[valeur]`.
 *
 * The page renders so the menu link resolves and the user is offered a
 * graceful path back to the catalogue + rankings. `generateMetadata`
 * has already set `robots: { index: false, follow: true }` so Google
 * does not index the thin URL — soft-404 pollution is avoided while
 * the catalogue grows.
 */
function DestinationEmptyState({
  locale,
  cityLabel,
}: {
  readonly locale: Locale;
  readonly cityLabel: string;
}) {
  const heading = pickByLocale(
    locale,
    `${cityLabel} — sélection à venir`,
    `${cityLabel} — selection coming soon`,
  );
  const lead = pickByLocale(
    locale,
    `Notre conciergerie sélectionne actuellement les adresses 5★ et Palaces de ${cityLabel}. Le catalogue ouvrira prochainement avec ses fiches éditoriales complètes — chacune se terminant par un Conseil du Concierge. En attendant, explorez nos destinations déjà publiées ou nos classements éditoriaux.`,
    `Our concierge desk is curating the 5-star and Palace addresses for ${cityLabel}. The catalogue will open soon with its full editorial pages — each closing with a Concierge Tip. In the meantime, browse our published destinations or editorial rankings.`,
  );
  return (
    <main className="container mx-auto max-w-3xl px-4 py-14 sm:py-20">
      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {pickByLocale(locale, 'Accueil', 'Home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/destination" className="hover:underline">
              {pickByLocale(locale, 'Destinations', 'Destinations')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {cityLabel}
          </li>
        </ol>
      </nav>
      <header className="mb-8 max-w-2xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">
          {pickByLocale(locale, 'Destination', 'Destination')}
        </p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{heading}</h1>
      </header>
      <section
        aria-labelledby="dest-empty-state-title"
        className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
      >
        <h2 id="dest-empty-state-title" className="text-fg font-serif text-xl">
          {pickByLocale(
            locale,
            'La sélection est en cours de constitution',
            'Selection in progress',
          )}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{lead}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/destination"
            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          >
            {pickByLocale(locale, 'Toutes les destinations', 'All destinations')} →
          </Link>
          <Link
            href="/hotels"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {pickByLocale(locale, 'Voir tous les hôtels', 'See all hotels')} →
          </Link>
          <Link
            href="/classements"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {pickByLocale(locale, 'Voir nos classements', 'See our rankings')} →
          </Link>
        </div>
      </section>
    </main>
  );
}
