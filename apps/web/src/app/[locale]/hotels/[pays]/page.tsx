import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { DirectoryCountryView } from '@/components/directory/directory-country-view';
import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { getCountryDirectory } from '@/server/annuaire/get-country-directory';
import { toDirectoryMapPoints } from '@/server/annuaire/directory-shared';
import { env } from '@/lib/env';

/**
 * `/hotels/[pays]` — country directory (annuaire). ADR-0026.
 *
 * `force-dynamic`: the page reads the per-request CSP nonce to sign its
 * JSON-LD scripts (CollectionPage + ItemList + BreadcrumbList). Same
 * contract as `/destination/[citySlug]` and `/hotels`.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pays: string }>;
}): Promise<Metadata> {
  const { locale: raw, pays } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const directory = await getCountryDirectory(pays, locale);
  if (directory === null) return { robots: { index: false, follow: false } };

  const t = await getTranslations({ locale, namespace: 'directoryPage' });
  const title = t('country.metaTitle', { country: directory.name });
  const description = t('country.metaDesc', {
    country: directory.name,
    count: directory.totalCount,
    cities: directory.cityCount,
  });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/hotels/[pays]', params: { pays: directory.slug } },
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

export default async function CountryDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string; pays: string }>;
}) {
  const { locale: raw, pays } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const directory = await getCountryDirectory(pays, locale);
  if (directory === null) notFound();

  const t = await getTranslations('directoryPage');
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const pageUrl = `${origin}${getPathname({
    locale,
    href: { pathname: '/hotels/[pays]', params: { pays: directory.slug } },
  })}`;

  const allHotels = directory.cities.flatMap((c) => c.hotels);
  const hotelItems = allHotels.map((h) => ({
    name: h.name,
    url: `${origin}${getPathname({
      locale,
      href: { pathname: '/hotel/[slug]', params: { slug: h.slug } },
    })}`,
    ...(h.lat !== null && h.lng !== null ? { hotel: { latitude: h.lat, longitude: h.lng } } : {}),
  }));

  const mapPoints = toDirectoryMapPoints(allHotels, (slug) =>
    getPathname({ locale, href: { pathname: '/hotel/[slug]', params: { slug } } }),
  );

  const collectionJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.collectionPageJsonLd({
      name: t('country.metaTitle', { country: directory.name }),
      url: pageUrl,
      description: t('country.metaDesc', {
        country: directory.name,
        count: directory.totalCount,
        cities: directory.cityCount,
      }),
      inLanguage: hreflangKey(locale),
      itemList: { name: t('country.h1', { country: directory.name }), items: hotelItems },
    }),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t('breadcrumb.hotels'), url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
      { name: directory.name, url: pageUrl },
    ]),
  );

  const freshness = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const aeoQuestion = t('country.aeoQuestion', { country: directory.name });
  const aeoAnswer = t('country.aeoAnswer', {
    country: directory.name,
    count: directory.totalCount,
    cities: directory.cityCount,
    date: freshness,
  });

  interface FaqItem {
    readonly q: string;
    readonly a: string;
  }
  const faqRaw = t.raw('country.faqItems') as FaqItem[];
  const faqItems = faqRaw.map((it) => ({
    question: it.q.replace(/\{country\}/g, directory.name),
    answer: it.a.replace(/\{country\}/g, directory.name),
  }));

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={collectionJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <DirectoryCountryView
        directory={directory}
        mapPoints={mapPoints}
        aeoSlot={
          <HubAeoSection
            question={aeoQuestion}
            answer={aeoAnswer}
            headingId="directory-country-aeo"
            emitJsonLd={false}
          />
        }
      />

      <HubFaqSection
        heading={t('country.faqTitle', { country: directory.name })}
        items={faqItems}
      />
    </main>
  );
}
