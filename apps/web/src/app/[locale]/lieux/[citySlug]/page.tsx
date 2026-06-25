import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { PlaceRankingCard } from '@/components/lieux/place-blocks';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';
import {
  listPlaceCityKeys,
  listPublishedPlacesForCity,
  type PlaceListItem,
} from '@/server/places/list-places';
import { pickListName } from '@/server/places/place-view';

// JSON-LD via headers() nonce read forces dynamic — align with the place
// fiche / classement precedent.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * Cards rendered per crawlable page. Caps the DOM / HTML / JSON-LD payload
 * to a bounded slice (≈ PAGE_SIZE place cards) while a crawlable numbered
 * pager exposes the full published set: every POI stays reachable from the
 * maillage without exploding a single document (observability-perf budget).
 */
const PAGE_SIZE = 60;

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/** A list item paired with its 1-based rank inside its own bucket. */
interface RankedPlace {
  readonly item: PlaceListItem;
  readonly position: number;
}

interface CityPlacesView {
  readonly visit: readonly RankedPlace[];
  readonly doIt: readonly RankedPlace[];
  readonly total: number;
  readonly totalPages: number;
}

/** Parse a `?page=` search param into a 1-based page number (defaults to 1). */
function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Build the per-bucket ranked views for a city from the full published set.
 * Buckets are concatenated (visit, then do) into a single stable order so
 * the page slice never skips or duplicates a row across page boundaries.
 */
function buildCityView(places: readonly PlaceListItem[]): {
  ordered: readonly RankedPlace[];
  total: number;
  totalPages: number;
} {
  const visit: RankedPlace[] = [];
  const doIt: RankedPlace[] = [];
  for (const item of places) {
    if (item.bucket === 'do') doIt.push({ item, position: doIt.length + 1 });
    else visit.push({ item, position: visit.length + 1 });
  }
  const ordered = [...visit, ...doIt];
  const total = ordered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { ordered, total, totalPages };
}

/** Slice the ordered set to a single page, then re-split into buckets. */
function pageView(places: readonly PlaceListItem[], page: number): CityPlacesView {
  const { ordered, total, totalPages } = buildCityView(places);
  const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return {
    visit: slice.filter((r) => r.item.bucket === 'visit'),
    doIt: slice.filter((r) => r.item.bucket === 'do'),
    total,
    totalPages,
  };
}

export async function generateStaticParams(): Promise<{ locale: string; citySlug: string }[]> {
  try {
    const cities = await listPlaceCityKeys();
    const out: { locale: string; citySlug: string }[] = [];
    for (const citySlug of cities) {
      out.push({ locale: 'fr', citySlug });
      out.push({ locale: 'en', citySlug });
    }
    return out;
  } catch {
    return [];
  }
}

/** Display city label — derived from the first place row, fallback to a titled slug. */
function cityLabel(places: readonly PlaceListItem[], citySlug: string): string {
  const first = places[0];
  if (first !== undefined && first.city.length > 0) return first.city;
  return citySlug
    .split('-')
    .map((s) => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(' ');
}

/** Localised in-app path to a city page, optionally carrying a `?page=`. */
function cityPagePath(locale: Locale, citySlug: string, page: number): string {
  const base = getPathname({
    locale,
    href: { pathname: '/lieux/[citySlug]', params: { citySlug } },
  });
  return page > 1 ? `${base}?page=${page}` : base;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}): Promise<Metadata> {
  const [{ locale: raw, citySlug }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const places = await listPublishedPlacesForCity(citySlug);
  if (places.length === 0) return {};
  const { totalPages } = buildCityView(places);
  const page = Math.min(parsePageParam(sp.page), totalPages);
  const t = await getTranslations({ locale, namespace: 'lieux' });
  const city = cityLabel(places, citySlug);

  const baseTitle = `${t('rankingIndexTitle', { city })} | MyConciergeHotel`;
  const title = page > 1 ? `${t('paginationTitleSuffix', { page })} — ${baseTitle}` : baseTitle;
  const description = t('rankingIndexIntro', { city });

  return {
    title,
    description,
    alternates: {
      canonical: cityPagePath(locale, citySlug, page),
      languages: buildHreflangAlternates((l) => cityPagePath(l, citySlug, page)),
    },
    openGraph: { title, description, type: 'website', locale: ogLocale(locale) },
  };
}

export default async function CityPlacesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ locale: raw, citySlug }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const places = await listPublishedPlacesForCity(citySlug);
  if (places.length === 0) notFound();

  const { totalPages } = buildCityView(places);
  const requestedPage = parsePageParam(sp.page);
  // Out-of-range page → 404 (avoid indexable empty/duplicate URLs).
  if (requestedPage > totalPages) notFound();
  const page = requestedPage;
  const view = pageView(places, page);

  const t = await getTranslations({ locale, namespace: 'lieux' });
  const city = cityLabel(places, citySlug);
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const placeUrl = (p: PlaceListItem): string => {
    const slug = locale === 'en' && p.slug_en ? p.slug_en : p.slug;
    return `${origin}${getPathname({
      locale,
      href: { pathname: '/lieux/[citySlug]/[placeSlug]', params: { citySlug, placeSlug: slug } },
    })}`;
  };

  const breadcrumbNode = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: t('breadcrumbHome'),
        url: `${origin}${getPathname({ locale, href: { pathname: '/' } })}`,
      },
      { name: t('breadcrumbLieux'), url: `${origin}${cityPagePath(locale, citySlug, 1)}` },
      { name: city, url: `${origin}${cityPagePath(locale, citySlug, 1)}` },
    ]),
  );

  const buildList = (items: readonly RankedPlace[], name: string) =>
    items.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name,
            items: items.map((r) => ({
              name: pickListName(r.item, locale),
              url: placeUrl(r.item),
            })),
          }),
        )
      : null;

  const jsonLdNodes = [
    breadcrumbNode,
    buildList(view.visit, t('rankingTitleVisit', { city })),
    buildList(view.doIt, t('rankingTitleDo', { city })),
  ].filter((n): n is NonNullable<typeof n> => n !== null);

  const renderSection = (
    items: readonly RankedPlace[],
    heading: string,
    intro: string,
    id: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <section aria-labelledby={`${id}-heading`} className="mt-12">
        <h2 id={`${id}-heading`} className="text-2xl font-semibold tracking-tight">
          {heading}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{intro}</p>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <PlaceRankingCard
              key={`${r.item.city_key}-${r.item.slug}`}
              item={r.item}
              locale={locale}
              position={r.position}
              viewLabel={t('viewPlace')}
            />
          ))}
        </ul>
      </section>
    );
  };

  const renderPager = () => {
    if (view.totalPages <= 1) return null;
    const prev = page > 1 ? page - 1 : null;
    const next = page < view.totalPages ? page + 1 : null;
    // Bounded window of numbered links around the current page so the DOM
    // stays small even with dozens of pages.
    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(view.totalPages, page + 2);
    const numbers: number[] = [];
    for (let n = windowStart; n <= windowEnd; n += 1) numbers.push(n);

    const linkClass =
      'inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition hover:bg-neutral-100';

    return (
      <nav
        aria-label={t('paginationAriaLabel')}
        className="mt-14 flex flex-wrap items-center justify-center gap-2"
      >
        {prev !== null ? (
          <a href={cityPagePath(locale, citySlug, prev)} rel="prev" className={linkClass}>
            {t('paginationPrevious')}
          </a>
        ) : null}
        {windowStart > 1 ? (
          <>
            <a href={cityPagePath(locale, citySlug, 1)} className={linkClass}>
              1
            </a>
            {windowStart > 2 ? (
              <span aria-hidden className="text-muted-foreground px-1">
                …
              </span>
            ) : null}
          </>
        ) : null}
        {numbers.map((n) =>
          n === page ? (
            <span
              key={n}
              aria-current="page"
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-md bg-neutral-900 px-3 text-sm font-semibold text-white"
            >
              {n}
            </span>
          ) : (
            <a key={n} href={cityPagePath(locale, citySlug, n)} className={linkClass}>
              {n}
            </a>
          ),
        )}
        {windowEnd < view.totalPages ? (
          <>
            {windowEnd < view.totalPages - 1 ? (
              <span aria-hidden className="text-muted-foreground px-1">
                …
              </span>
            ) : null}
            <a href={cityPagePath(locale, citySlug, view.totalPages)} className={linkClass}>
              {view.totalPages}
            </a>
          </>
        ) : null}
        {next !== null ? (
          <a href={cityPagePath(locale, citySlug, next)} rel="next" className={linkClass}>
            {t('paginationNext')}
          </a>
        ) : null}
      </nav>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {jsonLdNodes.map((node, i) => (
        <JsonLdScript key={i} data={node} nonce={nonce} />
      ))}

      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <a
              href={`${getPathname({ locale, href: { pathname: '/' } })}`}
              className="hover:underline"
            >
              {t('breadcrumbHome')}
            </a>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground font-medium" aria-current="page">
            {t('breadcrumbLieux')}
          </li>
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t('rankingIndexTitle', { city })}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">
          {t('rankingIndexIntro', { city })}
        </p>
        {view.totalPages > 1 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            {t('paginationStatus', { page, totalPages: view.totalPages, total: view.total })}
          </p>
        ) : null}
      </header>

      {renderSection(
        view.visit,
        t('rankingTitleVisit', { city }),
        t('rankingIntroVisit', { city }),
        'visit',
      )}
      {renderSection(view.doIt, t('rankingTitleDo', { city }), t('rankingIntroDo', { city }), 'do')}

      {renderPager()}
    </main>
  );
}
