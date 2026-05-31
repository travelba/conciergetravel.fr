import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { TOP_INTL_DESTINATION_NAV_ENTRIES } from '@/components/layout/nav-data';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { listPublishedCities } from '@/server/destinations/cities';
import { listInternationalDestinations } from '@/server/destinations/list-destination-countries';

/**
 * Phase 4.A nav-pinned international slugs — we surface these first in
 * the "Monde — par ville" section regardless of their hotel count, so a
 * city like Marrakech (rank ~13 by count) lands above the fold next to
 * the high-volume cities (London, NYC, Dubai). Slugs that have zero
 * published hotels still appear here as the graceful empty-state link.
 * The cap on the rest of the long tail kicks in after this set.
 */
const PHASE_4A_INTL_SLUGS = new Set(TOP_INTL_DESTINATION_NAV_ENTRIES.map((e) => e.slug));

// The page emits a `JsonLdScript` carrying the per-request CSP nonce
// (skill: security-engineering §CSP). Reading `headers()` for that nonce
// forces dynamic rendering; the explicit directive below makes the
// contract grep-able and prevents a future ISR re-enable from silently
// stripping the nonce. See `components/seo/json-ld.tsx` for context.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const canonicalFor = (l: Locale): string => getPathname({ locale: l, href: '/destination' });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const t = await getTranslations({ locale: raw, namespace: 'destinationPage' });
  return {
    title: t('directory.title'),
    description: t('directory.subtitle', { count: 0 }),
    alternates: {
      canonical: canonicalFor(raw),
      languages: buildHreflangAlternates(canonicalFor),
    },
  };
}

export default async function DestinationDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const t = await getTranslations('destinationPage');
  const [cities, countries] = await Promise.all([
    listPublishedCities(),
    listInternationalDestinations(locale),
  ]);
  // ADR-0022 — `cities` now mixes FR + international rows. We split
  // them visually: FR cities under "France — par ville", international
  // cities under "Monde — par ville". The "Monde — par pays" section
  // (countries with published editorial country-guides) keeps surfacing
  // separately for breadth, since not every country has a city-level
  // page (and not every international city has a published country
  // guide).
  //
  // The intl city sort is two-tiered: the 14 Phase 4.A nav-pinned slugs
  // bubble to the top regardless of count, then the remaining cities
  // follow by hotel count DESC capped at 40 (cap covers the long tail
  // without flooding the page; Phase 4.A slugs always appear).
  const frCities = cities.filter((c) => c.countryCode === 'FR');
  const allIntlCities = cities.filter((c) => c.countryCode !== 'FR');
  const intlPinned = allIntlCities.filter((c) => PHASE_4A_INTL_SLUGS.has(c.slug));
  const intlPinnedSet = new Set(intlPinned.map((c) => c.slug));
  // PR-D — bumped from 40 → 80 (ADR-0021 Vague 4: the catalogue
  // exposes 127 countries; 40 was an early-phase guard against an
  // empty long tail, which no longer applies). The pinned list still
  // bubbles to the top so the curated cities stay above the fold.
  const intlRest = allIntlCities.filter((c) => !intlPinnedSet.has(c.slug)).slice(0, 80);
  const intlCities = [...intlPinned, ...intlRest];

  // PR-D — split the country directory into TWO sections so the
  // worldwide footprint is no longer hidden behind the 8 published
  // country-guides. Countries with a guide get the editorial deep
  // link; countries with > 3 published hotels but no guide yet are
  // surfaced as anchor links into `/hotels#country-<code>` (the
  // catalogue page emits matching `id="country-<code>"` sections).
  // Threshold = 4 because 1-3 hotels in a country is the long tail
  // already accessible from `/hotels`; surfacing them here would
  // dilute the directory.
  const guidedCountries = countries.filter((c) => c.guideSlug !== null);
  const unguidedCountries = countries.filter((c) => c.guideSlug === null && c.hotelCount >= 4);
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const totalDestinations =
    frCities.length + intlCities.length + guidedCountries.length + unguidedCountries.length;

  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: t('directory.title'),
      items: [
        ...frCities.map((c) => ({
          name: c.name,
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/destination/[citySlug]', params: { citySlug: c.slug } },
          })}`,
        })),
        ...intlCities.map((c) => ({
          name: c.name,
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/destination/[citySlug]', params: { citySlug: c.slug } },
          })}`,
        })),
        ...guidedCountries.map((c) => ({
          name: c.name,
          url: `${origin}${getPathname({
            locale,
            // `guideSlug` is non-null in this branch — the filter above
            // narrows the type for humans, but TS can't see through
            // `Array.prototype.filter`, hence the assertion-free fallback.
            href: { pathname: '/guide/[citySlug]', params: { citySlug: c.guideSlug ?? '' } },
          })}`,
        })),
      ],
    }),
  );

  // Freshness signal for the AEO answer + the visible badge.
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const todayIso = new Date().toISOString();

  // Read FAQ items as an array (next-intl `t.raw` returns the JSON
  // payload untouched — same pattern as `/le-concierge` page).
  interface FaqItem {
    readonly q: string;
    readonly a: string;
  }
  const faqItems = t.raw('directory.faqItems') as FaqItem[];

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />

      <header className="mb-10">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {t('directory.title')}
        </h1>
        <p className="text-muted mt-3">{t('directory.subtitle', { count: totalDestinations })}</p>
        <LastUpdatedBadge isoDate={todayIso} locale={locale} variant="inline" />
      </header>

      <HubAeoSection
        question={t('directory.aeoQuestion')}
        answer={t('directory.aeoAnswer', { count: totalDestinations, date: freshnessDate })}
        headingId="destination-directory-aeo-title"
      />

      {totalDestinations === 0 ? (
        <p className="text-muted text-sm">{t('empty')}</p>
      ) : (
        <div className="space-y-12">
          {frCities.length > 0 && (
            <section aria-labelledby="destination-france-heading">
              <header className="mb-4 flex items-baseline justify-between gap-4">
                <h2
                  id="destination-france-heading"
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {t('directory.franceSection.title')}
                </h2>
                <p className="text-muted text-xs">
                  {t('directory.franceSection.subtitle', { count: frCities.length })}
                </p>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {frCities.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={{
                        pathname: '/destination/[citySlug]',
                        params: { citySlug: c.slug },
                      }}
                      className="border-border bg-bg hover:bg-muted/10 flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <span>
                        <span className="text-fg font-serif text-lg">{c.name}</span>
                        {c.region !== null && (
                          <span className="text-muted ml-2 text-xs">{c.region}</span>
                        )}
                      </span>
                      <span className="text-muted text-xs">
                        {t('directory.count', { count: c.count })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {intlCities.length > 0 && (
            <section aria-labelledby="destination-intl-cities-heading">
              <header className="mb-4 flex items-baseline justify-between gap-4">
                <h2
                  id="destination-intl-cities-heading"
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {t('directory.intlCitiesSection.title')}
                </h2>
                <p className="text-muted text-xs">
                  {t('directory.intlCitiesSection.subtitle', { count: intlCities.length })}
                </p>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {intlCities.map((c) => {
                  const country = pickByLocale(locale, c.countryLabelFr, c.countryLabelEn);
                  return (
                    <li key={c.slug}>
                      <Link
                        href={{
                          pathname: '/destination/[citySlug]',
                          params: { citySlug: c.slug },
                        }}
                        className="border-border bg-bg hover:bg-muted/10 flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3"
                      >
                        <span>
                          <span className="text-fg font-serif text-lg">{c.name}</span>
                          {country !== null && (
                            <span className="text-muted ml-2 text-xs">{country}</span>
                          )}
                        </span>
                        <span className="text-muted text-xs">
                          {t('directory.count', { count: c.count })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {guidedCountries.length > 0 && (
            <section aria-labelledby="destination-world-heading">
              <header className="mb-4 flex items-baseline justify-between gap-4">
                <h2
                  id="destination-world-heading"
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {t('directory.worldSection.title')}
                </h2>
                <p className="text-muted text-xs">
                  {t('directory.worldSection.subtitle', { count: guidedCountries.length })}
                </p>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {guidedCountries.map((c) => (
                  <li key={c.code}>
                    <Link
                      href={{
                        pathname: '/guide/[citySlug]',
                        params: { citySlug: c.guideSlug ?? '' },
                      }}
                      className="border-border bg-bg hover:bg-muted/10 flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <span>
                        <span className="text-fg font-serif text-lg">{c.name}</span>
                        <span className="text-muted ml-2 text-xs uppercase tracking-wide">
                          {c.code}
                        </span>
                      </span>
                      <span className="text-muted text-xs">
                        {t('directory.worldSection.hotelsCount', { count: c.hotelCount })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-4 text-xs">
                {t('directory.worldSection.fullCatalogHint', {
                  count: countries.length - guidedCountries.length,
                })}{' '}
                <Link
                  href="/hotels"
                  className="text-fg hover:text-fg/80 underline decoration-dotted"
                >
                  {t('directory.worldSection.fullCatalogLink')}
                </Link>
              </p>
            </section>
          )}

          {/* PR-D — "Autres pays au catalogue" : countries with ≥ 4
              published hotels but no editorial guide yet. The link
              targets the per-country anchor on `/hotels` (emitted by
              `apps/web/src/app/[locale]/hotels/page.tsx` line ~415,
              `id="country-<code>"`), so users discover the worldwide
              breadth without 404ing on a non-existent guide. */}
          {unguidedCountries.length > 0 && (
            <section aria-labelledby="destination-world-unguided-heading">
              <header className="mb-4 flex items-baseline justify-between gap-4">
                <h2
                  id="destination-world-unguided-heading"
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {t('directory.unguidedCountriesSection.title')}
                </h2>
                <p className="text-muted text-xs">
                  {t('directory.unguidedCountriesSection.subtitle', {
                    count: unguidedCountries.length,
                  })}
                </p>
              </header>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {unguidedCountries.map((c) => (
                  <li key={c.code}>
                    <Link
                      href={{
                        pathname: '/hotels',
                        hash: `country-${c.code.toLowerCase()}`,
                      }}
                      className="border-border bg-bg hover:bg-muted/10 flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3"
                    >
                      <span className="text-fg font-serif text-base">{c.name}</span>
                      <span className="text-muted text-xs">
                        {t('directory.count', { count: c.hotelCount })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <HubFaqSection
        heading={t('directory.faqTitle')}
        items={faqItems.map((it) => ({ question: it.q, answer: it.a }))}
      />
    </main>
  );
}
