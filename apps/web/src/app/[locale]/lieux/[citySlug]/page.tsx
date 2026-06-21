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

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
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
    .map((s) => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s))
    .join(' ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, citySlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const places = await listPublishedPlacesForCity(citySlug);
  if (places.length === 0) return {};
  const t = await getTranslations({ locale, namespace: 'lieux' });
  const city = cityLabel(places, citySlug);

  const title = `${t('rankingIndexTitle', { city })} | MyConciergeHotel`;
  const description = t('rankingIndexIntro', { city });

  const buildPath = (l: Locale): string =>
    getPathname({ locale: l, href: { pathname: '/lieux/[citySlug]', params: { citySlug } } });

  return {
    title,
    description,
    alternates: {
      canonical: buildPath(locale),
      languages: buildHreflangAlternates(buildPath),
    },
    openGraph: { title, description, type: 'website', locale: ogLocale(locale) },
  };
}

export default async function CityPlacesPage({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}) {
  const { locale: raw, citySlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const places = await listPublishedPlacesForCity(citySlug);
  if (places.length === 0) notFound();

  const t = await getTranslations({ locale, namespace: 'lieux' });
  const city = cityLabel(places, citySlug);
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const visit = places.filter((p) => p.bucket === 'visit');
  const doIt = places.filter((p) => p.bucket === 'do');

  const canonical = `${origin}${getPathname({
    locale,
    href: { pathname: '/lieux/[citySlug]', params: { citySlug } },
  })}`;

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
      { name: t('breadcrumbLieux'), url: canonical },
      { name: city, url: canonical },
    ]),
  );

  const buildList = (items: readonly PlaceListItem[], name: string) =>
    items.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name,
            items: items.map((p) => ({ name: pickListName(p, locale), url: placeUrl(p) })),
          }),
        )
      : null;

  const jsonLdNodes = [
    breadcrumbNode,
    buildList(visit, t('rankingTitleVisit', { city })),
    buildList(doIt, t('rankingTitleDo', { city })),
  ].filter((n): n is NonNullable<typeof n> => n !== null);

  const renderSection = (
    items: readonly PlaceListItem[],
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
          {items.map((p, i) => (
            <PlaceRankingCard
              key={`${p.city_key}-${p.slug}`}
              item={p}
              locale={locale}
              position={i + 1}
              viewLabel={t('viewPlace')}
            />
          ))}
        </ul>
      </section>
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
      </header>

      {renderSection(
        visit,
        t('rankingTitleVisit', { city }),
        t('rankingIntroVisit', { city }),
        'visit',
      )}
      {renderSection(doIt, t('rankingTitleDo', { city }), t('rankingIntroDo', { city }), 'do')}
    </main>
  );
}
