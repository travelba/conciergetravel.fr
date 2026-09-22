import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { DEMO_CITIES, DEMO_COUNTRIES, DEMO_REGIONS } from '@/lib/demo-data';
import { directorySeo } from '@/lib/seo/keyword-templates';

export const dynamic = 'force-dynamic';

// Famille « Hôtel {Pays} » (ADR-0034 §2).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pays: string }>;
}): Promise<Metadata> {
  const { locale, pays } = await params;
  const country = DEMO_COUNTRIES.find((c) => c.slug === pays);
  if (country === undefined) return {};

  const seo = directorySeo({
    zoneLabel: country.label,
    kind: 'pays',
    hotelCount: country.hotelCount,
    locale: locale === 'en' ? 'en' : 'fr',
  });
  return { title: seo.title, description: seo.description };
}

export default async function HotelsByCountryPage({
  params,
}: {
  params: Promise<{ locale: string; pays: string }>;
}) {
  const { locale, pays } = await params;
  setRequestLocale(locale);
  const resolvedLocale = locale === 'en' ? 'en' : 'fr';

  const country = DEMO_COUNTRIES.find((c) => c.slug === pays);
  if (country === undefined) notFound();

  const cities = DEMO_CITIES[pays] ?? [];
  const regions = DEMO_REGIONS[pays] ?? [];

  const seo = directorySeo({
    zoneLabel: country.label,
    kind: 'pays',
    hotelCount: country.hotelCount,
    locale: resolvedLocale,
  });

  const zoneLinkClass =
    'flex items-center justify-between rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-5 py-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]';

  return (
    <div className="ui-v2-container py-8">
      <h1>{seo.h1}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{country.hotelCount} hôtels</p>

      {cities.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">
            {resolvedLocale === 'fr' ? 'Par ville' : 'By city'}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <li key={city.slug}>
                <Link
                  href={{
                    pathname: '/hotels/[pays]/[ville]',
                    params: { pays, ville: city.slug },
                  }}
                  className={zoneLinkClass}
                >
                  <span className="font-medium">{city.label}</span>
                  <span className="text-sm text-[var(--color-muted)]">{city.hotelCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-8 text-[var(--color-muted)]">Aucune ville indexée pour ce pays.</p>
      )}

      {regions.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            {resolvedLocale === 'fr' ? 'Par région' : 'By region'}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((region) => (
              <li key={region.slug}>
                <Link
                  href={{
                    pathname: '/hotels/[pays]/[ville]',
                    params: { pays, ville: region.slug },
                  }}
                  className={zoneLinkClass}
                >
                  <span className="font-medium">{region.label}</span>
                  <span className="text-sm text-[var(--color-muted)]">{region.hotelCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
