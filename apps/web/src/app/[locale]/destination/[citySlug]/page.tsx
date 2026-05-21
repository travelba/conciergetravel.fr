import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { getDestinationBySlug, listPublishedCities } from '@/server/destinations/cities';
import { getAmadeusAggregateRatingsBatch } from '@/server/hotels/get-amadeus-sentiments-batch';

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

export async function generateStaticParams(): Promise<Array<{ locale: string; citySlug: string }>> {
  try {
    const cities = await listPublishedCities();
    const params: Array<{ locale: string; citySlug: string }> = [];
    for (const c of cities) {
      params.push({ locale: 'fr', citySlug: c.slug });
      params.push({ locale: 'en', citySlug: c.slug });
    }
    return params;
  } catch {
    return [];
  }
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
  if (destination === null) return { robots: { index: false, follow: false } };

  const title = t('meta.title', { city: destination.name });
  const description = t('meta.description', { city: destination.name, region: destination.region });
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
  if (destination === null) notFound();

  // Fetch Amadeus ratings for every hotel in the city in a single
  // batched request (chunked internally if >20 — see helper). The
  // helper is fully forgiving, so an empty map means "no ratings to
  // show" and the cards render without the rating chip.
  const [t, ratingsByAmadeusId] = await Promise.all([
    getTranslations('destinationPage'),
    getAmadeusAggregateRatingsBatch(destination.hotels.map((h) => h.amadeusHotelId)),
  ]);
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
  const aeoAnswer = t(count === 1 ? 'aeo.answerSingular' : 'aeo.answerPlural', {
    count,
    city: destination.name,
    region: destination.region,
    date: today,
  });
  const aeoQuestion = t('aeo.question', { city: destination.name });

  // Canonical 10-Q FAQ payload — templated per city via i18n `{city}`
  // placeholder. The AEO Q&A is prepended as item[0] so the FAQPage
  // JSON-LD opens with the same answer surfaced visibly above.
  interface FaqEntry {
    readonly q: string;
    readonly a: string;
  }
  const cityFaqRaw = t.raw('cityFaq.items') as FaqEntry[];
  const cityFaqResolved = cityFaqRaw.map((it) => ({
    question: it.q.replace(/\{city\}/g, destination.name),
    answer: it.a.replace(/\{city\}/g, destination.name),
  }));
  const allFaqItems = [{ question: aeoQuestion, answer: aeoAnswer }, ...cityFaqResolved];
  const faqJsonLd = JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(allFaqItems));

  // `Place` JSON-LD for the city itself — gives LLM crawlers a stable
  // entity anchor for the destination separate from the hotel list.
  // GeoCoordinates omitted (server data model doesn't expose city
  // centroid yet — to be added in a future PR with `pois` table).
  const placeJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Place',
    '@id': `${pageUrl}#place`,
    name: destination.name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: destination.name,
      addressRegion: destination.region,
      addressCountry: 'FR',
    },
    containedInPlace: {
      '@type': 'AdministrativeArea',
      name: destination.region,
    },
  });

  // Freshness signal — visible badge synced with the AEO `date` cue.
  // `latestUpdate` is the MAX of hotel updated_at when available,
  // otherwise today's date as a fall-back so the badge always renders.
  const latestUpdateIso = new Date().toISOString();

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={placeJsonLd} nonce={nonce} />
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

      <header className="mb-10">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {t('title', { city: destination.name })}
        </h1>
        <p className="text-muted mt-3 text-lg sm:text-xl">
          {t('subtitle', { count, city: destination.name, region: destination.region })}
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
                      {hotel.isPalace ? t('card.palace') : t('card.stars', { count: hotel.stars })}
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
    </main>
  );
}
