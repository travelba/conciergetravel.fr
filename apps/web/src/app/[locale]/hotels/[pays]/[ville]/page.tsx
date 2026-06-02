import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { DirectoryCityView } from '@/components/directory/directory-city-view';
import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { getCityDirectory } from '@/server/annuaire/get-city-directory';
import { toDirectoryMapPoints } from '@/server/annuaire/directory-shared';
import { env } from '@/lib/env';

/**
 * `/hotels/[pays]/[ville]` — city directory (annuaire). ADR-0026.
 *
 * Exhaustive, factual list of every published hotel in one city, scoped
 * by country to resolve homonym collisions (two cities sharing a name in
 * different countries get distinct URLs). `force-dynamic` for the CSP
 * nonce on the JSON-LD scripts. Canonical points to itself; the page
 * 404s when the (country, city) pair has no published hotel.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pays: string; ville: string }>;
}): Promise<Metadata> {
  const { locale: raw, pays, ville } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const directory = await getCityDirectory(pays, ville, locale);
  if (directory === null) return { robots: { index: false, follow: false } };

  const t = await getTranslations({ locale, namespace: 'directoryPage' });
  const title = t('city.metaTitle', { city: directory.cityName });
  const description = t('city.metaDesc', {
    city: directory.cityName,
    country: directory.countryName,
    count: directory.totalCount,
  });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: {
        pathname: '/hotels/[pays]/[ville]',
        params: { pays: directory.countrySlug, ville: directory.citySlug },
      },
    });

  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalPath(locale),
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

export default async function CityDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string; pays: string; ville: string }>;
}) {
  const { locale: raw, pays, ville } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const directory = await getCityDirectory(pays, ville, locale);
  if (directory === null) notFound();

  const t = await getTranslations('directoryPage');
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const pageUrl = `${origin}${getPathname({
    locale,
    href: {
      pathname: '/hotels/[pays]/[ville]',
      params: { pays: directory.countrySlug, ville: directory.citySlug },
    },
  })}`;

  const hotelItems = directory.hotels.map((h) => ({
    name: h.name,
    url: `${origin}${getPathname({
      locale,
      href: { pathname: '/hotel/[slug]', params: { slug: h.slug } },
    })}`,
    ...(h.lat !== null && h.lng !== null ? { hotel: { latitude: h.lat, longitude: h.lng } } : {}),
  }));

  const mapPoints = toDirectoryMapPoints(directory.hotels, (slug) =>
    getPathname({ locale, href: { pathname: '/hotel/[slug]', params: { slug } } }),
  );

  const collectionJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.collectionPageJsonLd({
      name: t('city.metaTitle', { city: directory.cityName }),
      url: pageUrl,
      description: t('city.metaDesc', {
        city: directory.cityName,
        country: directory.countryName,
        count: directory.totalCount,
      }),
      inLanguage: hreflangKey(locale),
      itemList: { name: t('city.h1', { city: directory.cityName }), items: hotelItems },
    }),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t('breadcrumb.hotels'), url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
      {
        name: directory.countryName,
        url: `${origin}${getPathname({
          locale,
          href: { pathname: '/hotels/[pays]', params: { pays: directory.countrySlug } },
        })}`,
      },
      { name: directory.cityName, url: pageUrl },
    ]),
  );

  const freshness = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const aeoQuestion = t('city.aeoQuestion', { city: directory.cityName });
  const aeoAnswer = t('city.aeoAnswer', {
    city: directory.cityName,
    country: directory.countryName,
    count: directory.totalCount,
    date: freshness,
  });

  interface FaqItem {
    readonly q: string;
    readonly a: string;
  }
  const faqRaw = t.raw('city.faqItems') as FaqItem[];
  const faqItems = faqRaw.map((it) => ({
    question: it.q
      .replace(/\{city\}/g, directory.cityName)
      .replace(/\{country\}/g, directory.countryName),
    answer: it.a
      .replace(/\{city\}/g, directory.cityName)
      .replace(/\{country\}/g, directory.countryName),
  }));

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={collectionJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <DirectoryCityView
        directory={directory}
        mapPoints={mapPoints}
        aeoSlot={
          <HubAeoSection
            question={aeoQuestion}
            answer={aeoAnswer}
            headingId="directory-city-aeo"
            emitJsonLd={false}
          />
        }
      />

      <HubFaqSection heading={t('city.faqTitle', { city: directory.cityName })} items={faqItems} />
    </main>
  );
}
