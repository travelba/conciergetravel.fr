import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { searchCitiesCatalogOnServer } from '@/lib/search/cities-catalog';
import { searchHotelsCatalogOnServer } from '@/lib/search/hotels-catalog';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';
import {
  getCityDirectoryResolver,
  getCountryNameByCode,
  searchCatalogCountries,
} from '@/server/search/catalog-countries';

const HITS_PER_PAGE = 24;
const CITY_HITS_FOR_QUERY = 6;
const COUNTRY_HITS_FOR_QUERY = 6;
const POPULAR_CITIES = 12;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) {
    return {};
  }
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'searchPage' });
  const canonical = getPathname({ locale, href: '/recherche' });
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical,
      languages: buildHreflangAlternates((l) => getPathname({ locale: l, href: '/recherche' })),
    },
    // Skill `seo-technical` §Indexability per segment:
    // search results pages get `noindex, follow` — we want Google to
    // crawl the categorical links but never index parameterised URLs.
    // The same rule applies to `/recherche` even without query params:
    // the page itself is the search shell, not editorial content.
    robots: { index: false, follow: true },
  };
}

interface RechercheSearchParams {
  readonly q?: string;
  // `destination` is the wire param emitted by the hero
  // (`CatalogSearchForm`), the header (`HeaderQuickSearch`), the mobile
  // nav and the home-page `SearchAction` JSON-LD. The page form itself
  // uses `q`. We read `q` first and fall back to `destination` so every
  // entry point lands on populated results (ADR-0014 §2.2).
  readonly destination?: string;
  readonly checkIn?: string;
  readonly checkOut?: string;
  readonly adults?: string;
  readonly children?: string;
  readonly error?: string;
}

function defaultStay(): { checkIn: string; checkOut: string } {
  const now = new Date();
  const ci = new Date(now.getTime() + 30 * 86_400_000);
  const co = new Date(now.getTime() + 33 * 86_400_000);
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { checkIn: fmt(ci), checkOut: fmt(co) };
}

function pickIsoDate(value: string | undefined, fallback: string): string {
  return value !== undefined && ISO_DATE_RE.test(value) ? value : fallback;
}

function pickPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function lockActionFor(locale: Locale, hotelId: string): string {
  const offerId = `TEST-OFFER-${hotelId}`;
  return getPathname({
    locale,
    href: { pathname: '/reservation/offer/[offerId]/lock', params: { offerId } },
  });
}

export default async function RecherchePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RechercheSearchParams>;
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();

  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations('searchPage');

  const rawQuery =
    typeof sp.q === 'string' && sp.q.trim().length > 0
      ? sp.q
      : typeof sp.destination === 'string'
        ? sp.destination
        : '';
  const q = rawQuery.trim();
  const defaults = defaultStay();
  const checkIn = pickIsoDate(sp.checkIn, defaults.checkIn);
  const checkOut = pickIsoDate(sp.checkOut, defaults.checkOut);
  const adults = Math.max(1, pickPositiveInt(sp.adults, 2));
  const children = pickPositiveInt(sp.children, 0);
  const errorKind = typeof sp.error === 'string' && sp.error.length > 0 ? sp.error : undefined;
  const fakeEnabled = isFakeOffersEnabled();

  // Cities feed two states: when the query is empty we surface the most
  // popular destinations (empty Algolia query → top records by the index
  // custom ranking on `popularity_score`); when a query is present we
  // show the matching destinations above the hotel hits so the user can
  // pivot to a destination hub in one click.
  // Three result dimensions match the search promise: hotel name, city,
  // and country. The Algolia hotel index has no country field, so the
  // country dimension is sourced from the published-hotels aggregate and
  // bridges to the annuaire directory `/hotels/[pays]` (ADR-0026). The
  // `code → country name` map enriches city hits (the city index only
  // stores `country_code`). Both are cached, so they cost nothing on the
  // request path.
  const [hits, cityHits, countryHits, countryNames, cityResolver] = await Promise.all([
    searchHotelsCatalogOnServer(locale, q, HITS_PER_PAGE),
    searchCitiesCatalogOnServer(locale, q, q.length === 0 ? POPULAR_CITIES : CITY_HITS_FOR_QUERY),
    q.length === 0
      ? Promise.resolve([])
      : searchCatalogCountries(locale, q, COUNTRY_HITS_FOR_QUERY),
    getCountryNameByCode(locale),
    getCityDirectoryResolver(),
  ]);

  const cityLocation = (city: { region: string; country_code: string }): string =>
    [city.region, countryNames[city.country_code] ?? ''].filter((s) => s.length > 0).join(' · ');

  // A city search lands on the country-scoped annuaire directory
  // `/hotels/<pays>/<ville>` (ADR-0026) when that page exists; otherwise
  // it falls back to the legacy `/destination/<slug>` hub so the link is
  // never a 404.
  const cityLinkHref = (city: {
    slug: string;
    name: string;
    country_code: string;
  }):
    | { pathname: '/hotels/[pays]/[ville]'; params: { pays: string; ville: string } }
    | { pathname: '/destination/[citySlug]'; params: { citySlug: string } } => {
    const dir = cityResolver.resolve(city.name, city.country_code);
    return dir !== null
      ? { pathname: '/hotels/[pays]/[ville]', params: { pays: dir.pays, ville: dir.ville } }
      : { pathname: '/destination/[citySlug]', params: { citySlug: city.slug } };
  };

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="text-muted mt-2 max-w-prose">{t('subtitle')}</p>

        <form
          method="get"
          className="border-border bg-bg mt-8 flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
          role="search"
          aria-label={t('form.ariaLabel')}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor="catalog-search-q" className="text-fg text-sm font-medium">
                {t('form.label')}
              </label>
              <input
                id="catalog-search-q"
                name="q"
                type="search"
                defaultValue={q}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('form.placeholder')}
                className="border-border bg-bg text-fg ring-offset-bg focus-visible:ring-ring w-full rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
              />
            </div>
            <button
              type="submit"
              className="bg-fg text-bg focus-visible:ring-ring self-end rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {t('form.submit')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('stay.checkIn')}</span>
              <input
                type="date"
                name="checkIn"
                defaultValue={checkIn}
                className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('stay.checkOut')}</span>
              <input
                type="date"
                name="checkOut"
                defaultValue={checkOut}
                className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('stay.adults')}</span>
              <input
                type="number"
                name="adults"
                min={1}
                max={9}
                defaultValue={adults}
                className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('stay.children')}</span>
              <input
                type="number"
                name="children"
                min={0}
                max={9}
                defaultValue={children}
                className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
              />
            </label>
          </div>
        </form>

        {errorKind !== undefined ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {t('errors.lockFailed', { kind: errorKind })}
          </p>
        ) : null}
      </header>

      {q.length === 0 && cityHits.length > 0 ? (
        <section aria-labelledby="popular-destinations-heading" className="mb-12">
          <h2
            id="popular-destinations-heading"
            className="text-fg mb-4 font-serif text-xl sm:text-2xl"
          >
            {t('popular.heading')}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cityHits.map((city) => (
              <li key={city.objectID}>
                <Link
                  href={cityLinkHref(city)}
                  className="border-border bg-bg focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2"
                >
                  <span className="min-w-0">
                    <span className="text-fg block truncate font-medium">{city.name}</span>
                    {cityLocation(city).length > 0 ? (
                      <span className="text-muted block truncate text-xs">
                        {cityLocation(city)}
                      </span>
                    ) : null}
                  </span>
                  {city.hotels_count > 0 ? (
                    <span className="text-muted shrink-0 text-xs">
                      {t('results.cityHotelsCount', { count: city.hotels_count })}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-live="polite" aria-busy={false}>
        {q.length > 0 && cityHits.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
              {t('results.citiesHeading')}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cityHits.map((city) => (
                <li key={city.objectID}>
                  <Link
                    href={cityLinkHref(city)}
                    className="border-border bg-bg focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <span className="min-w-0">
                      <span className="text-fg block truncate font-medium">{city.name}</span>
                      {cityLocation(city).length > 0 ? (
                        <span className="text-muted block truncate text-xs">
                          {cityLocation(city)}
                        </span>
                      ) : null}
                    </span>
                    {city.hotels_count > 0 ? (
                      <span className="text-muted shrink-0 text-xs">
                        {t('results.cityHotelsCount', { count: city.hotels_count })}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {q.length > 0 && countryHits.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
              {t('results.countriesHeading')}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {countryHits.map((country) => (
                <li key={country.code}>
                  <Link
                    href={{ pathname: '/hotels/[pays]', params: { pays: country.slug } }}
                    className="border-border bg-bg focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <span className="text-fg min-w-0 truncate font-medium">{country.name}</span>
                    {country.hotelsCount > 0 ? (
                      <span className="text-muted shrink-0 text-xs">
                        {t('results.cityHotelsCount', { count: country.hotelsCount })}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {q.length > 0 && (cityHits.length > 0 || countryHits.length > 0) ? (
          <h2 className="text-muted mb-3 text-xs font-semibold uppercase tracking-wider">
            {t('results.hotelsHeading')}
          </h2>
        ) : null}

        <p className="text-muted mb-6 text-sm">
          {hits.length === 0
            ? q.length === 0
              ? t('results.emptyPrompt')
              : t('results.noneForQuery')
            : t('results.count', { count: hits.length })}
        </p>

        {hits.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {hits.map((hit) => {
              const hotelIsUuid = UUID_RE.test(hit.objectID);
              return (
                <li key={hit.objectID}>
                  <article className="border-border bg-bg rounded-lg border p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-fg font-serif text-lg">
                        <Link
                          href={{ pathname: '/hotel/[slug]', params: { slug: hit.slug } }}
                          className="hover:underline"
                        >
                          {hit.name}
                        </Link>
                      </h2>
                      <p className="text-muted text-xs">
                        {hit.is_palace
                          ? t('badges.palace')
                          : t('badges.stars', { count: hit.stars })}
                        {hit.city ? ` · ${hit.city}` : ''}
                        {hit.region ? ` · ${hit.region}` : ''}
                        {hit.country !== undefined && hit.country.length > 0
                          ? ` · ${hit.country}`
                          : ''}
                      </p>
                    </div>
                    {hit.description_excerpt.length > 0 ? (
                      <p className="text-muted mt-2 line-clamp-3 text-sm">
                        {hit.description_excerpt}
                      </p>
                    ) : null}

                    {fakeEnabled && hotelIsUuid ? (
                      <form
                        method="post"
                        action={lockActionFor(locale, hit.objectID)}
                        className="mt-4 flex flex-wrap items-center gap-3"
                      >
                        <input type="hidden" name="hotelId" value={hit.objectID} />
                        <input type="hidden" name="fake" value="1" />
                        <input type="hidden" name="checkIn" value={checkIn} />
                        <input type="hidden" name="checkOut" value={checkOut} />
                        <input type="hidden" name="adults" value={String(adults)} />
                        <input type="hidden" name="children" value={String(children)} />
                        <button
                          type="submit"
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                        >
                          {t('results.reserveTest')}
                        </button>
                        <span className="text-muted text-xs">{t('results.reserveTestHint')}</span>
                      </form>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
