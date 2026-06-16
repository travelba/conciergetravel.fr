import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { listPlaceCities } from '@/server/places/list-places';

// JSON-LD via headers() nonce read forces dynamic — align with the place
// fiche / city ranking precedent.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'lieux' });

  const title = `${t('hubTitle')} | MyConciergeHotel`;
  const description = t('hubIntro');

  const buildPath = (l: Locale): string => getPathname({ locale: l, href: { pathname: '/lieux' } });

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

export default async function PlacesHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'lieux' });
  const cities = await listPlaceCities();
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const canonical = `${origin}${getPathname({ locale, href: { pathname: '/lieux' } })}`;

  const cityUrl = (citySlug: string): string =>
    `${origin}${getPathname({ locale, href: { pathname: '/lieux/[citySlug]', params: { citySlug } } })}`;

  const breadcrumbNode = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: t('breadcrumbHome'),
        url: `${origin}${getPathname({ locale, href: { pathname: '/' } })}`,
      },
      { name: t('hubTitle'), url: canonical },
    ]),
  );

  const itemListNode =
    cities.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('hubTitle'),
            items: cities.map((c) => ({ name: c.cityName, url: cityUrl(c.citySlug) })),
          }),
        )
      : null;

  const jsonLdNodes = [breadcrumbNode, itemListNode].filter(
    (n): n is NonNullable<typeof n> => n !== null,
  );

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
          <li className="text-foreground font-medium">{t('hubTitle')}</li>
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('hubTitle')}</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">
          {t('hubIntro')}
        </p>
      </header>

      {cities.length === 0 ? (
        <p className="text-muted-foreground mt-12">{t('hubEmpty')}</p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <li key={c.citySlug}>
              <Link
                href={{ pathname: '/lieux/[citySlug]', params: { citySlug: c.citySlug } }}
                className="border-border hover:border-foreground group flex h-full flex-col justify-between rounded-2xl border bg-white p-6 transition hover:shadow-sm"
              >
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">{c.cityName}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t('hubCount', { count: c.total })} ·{' '}
                    {t('hubCountVisitDo', { visit: c.visit, doCount: c.doCount })}
                  </p>
                </div>
                <span className="text-foreground mt-5 inline-flex items-center gap-1 text-sm font-medium group-hover:underline">
                  {t('hubCityCta', { city: c.cityName })}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
