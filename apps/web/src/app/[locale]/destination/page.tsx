import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { listPublishedCities } from '@/server/destinations/cities';
import { listInternationalDestinations } from '@/server/destinations/list-destination-countries';

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
  // We only surface countries that already have a published country
  // guide — sending traffic to a deep-link without an editorial landing
  // page would dilute the directory's curated promise. The remaining
  // countries are reachable from `/hotels` (the full catalog).
  const guidedCountries = countries.filter((c) => c.guideSlug !== null);
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const totalDestinations = cities.length + guidedCountries.length;

  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: t('directory.title'),
      items: [
        ...cities.map((c) => ({
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

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />

      <header className="mb-10">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {t('directory.title')}
        </h1>
        <p className="text-muted mt-3">{t('directory.subtitle', { count: totalDestinations })}</p>
      </header>

      {totalDestinations === 0 ? (
        <p className="text-muted text-sm">{t('empty')}</p>
      ) : (
        <div className="space-y-12">
          {cities.length > 0 && (
            <section aria-labelledby="destination-france-heading">
              <header className="mb-4 flex items-baseline justify-between gap-4">
                <h2
                  id="destination-france-heading"
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {t('directory.franceSection.title')}
                </h2>
                <p className="text-muted text-xs">
                  {t('directory.franceSection.subtitle', { count: cities.length })}
                </p>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cities.map((c) => (
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
                        <span className="text-muted ml-2 text-xs">{c.region}</span>
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
        </div>
      )}
    </main>
  );
}
