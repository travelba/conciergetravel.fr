import { getTranslations } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { CountryDirectory } from '@/server/annuaire/get-country-directory';
import type { DirectoryMapPoint } from '@/components/directory/directory-map-layout';

import { DirectoryHotelCard } from './directory-hotel-card';
import { DirectoryMapLayout } from './directory-map-layout';
import { buildDirectoryFacets } from './filter-logic';

/**
 * `<DirectoryCountryView>` — body of `/hotels/[pays]` (ADR-0026).
 *
 * Renders the exhaustive country directory grouped by city: a jump-to
 * city strip, one anchored section per city (each linking to the city
 * annuaire), and a sibling-countries cross-link strip. The JSON-LD,
 * AEO and FAQ surfaces are emitted by the page (they own the CSP nonce).
 */
interface DirectoryCountryViewProps {
  readonly directory: CountryDirectory;
  /** Geolocated markers across every city (built by the page, locale-aware). */
  readonly mapPoints: readonly DirectoryMapPoint[];
  /** AEO block rendered right after the header (page owns the CSP nonce). */
  readonly aeoSlot?: ReactNode;
}

const OTHER_COUNTRIES_MAX = 24;

export async function DirectoryCountryView({
  directory,
  mapPoints,
  aeoSlot,
}: DirectoryCountryViewProps): Promise<ReactElement> {
  const t = await getTranslations('directoryPage');
  const palaceLabel = t('card.palace');
  const starsSuffix = t('card.starsSuffix');
  const viewLabel = t('card.view');
  const mapLabels = {
    toggleShow: t('map.toggleShow'),
    toggleHide: t('map.toggleHide'),
    ariaLabel: t('map.ariaLabel', { city: directory.name }),
    popupView: t('map.popupView'),
    geocodedNote: t('map.geocodedNote', { located: mapPoints.length, total: directory.totalCount }),
  };
  const facets = buildDirectoryFacets(
    directory.cities.flatMap((c) => c.hotels),
    'city',
  );

  return (
    <>
      <nav aria-label={t('breadcrumb.label')} className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/hotels" className="hover:underline">
              {t('breadcrumb.hotels')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {directory.name}
          </li>
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {t('country.h1', { country: directory.name })}
        </h1>
        <p className="text-muted mt-3 text-sm md:text-base">
          {t('country.subtitle', {
            count: directory.totalCount,
            cities: directory.cityCount,
            country: directory.name,
          })}
        </p>
      </header>

      {aeoSlot}

      <DirectoryMapLayout
        points={mapPoints}
        cluster
        labels={mapLabels}
        facets={facets}
        totalCount={directory.totalCount}
        placeKey="city"
        grouped
      >
        <div>
          {/* Jump-to city strip — internal maillage. */}
          {directory.cities.length > 1 ? (
            <nav
              aria-label={t('country.byCity')}
              data-directory-jumpstrip
              className="border-border mb-10 flex flex-wrap items-center gap-2 border-y py-3"
            >
              <span className="text-muted text-xs font-semibold uppercase tracking-wide">
                {t('country.byCity')} :
              </span>
              {directory.cities.map((c) => (
                <a
                  key={c.slug}
                  href={`#city-${c.slug}`}
                  className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
                >
                  {c.name}
                  <span className="text-muted ml-1.5">({c.hotels.length})</span>
                </a>
              ))}
            </nav>
          ) : null}

          {directory.cities.map((c) => (
            <section key={c.slug} id={`city-${c.slug}`} className="mb-14 scroll-mt-24">
              <header className="mb-6 flex items-baseline justify-between gap-3">
                <h2 className="text-fg font-serif text-xl md:text-2xl">{c.name}</h2>
                <Link
                  href={{
                    pathname: '/hotels/[pays]/[ville]',
                    params: { pays: directory.slug, ville: c.slug },
                  }}
                  className="text-sm font-medium text-amber-700 underline-offset-2 hover:underline"
                >
                  {t('country.viewCity', { count: c.hotels.length })} →
                </Link>
              </header>
              <ul className="flex flex-col gap-3">
                {c.hotels.map((h) => (
                  <li key={h.id}>
                    <DirectoryHotelCard
                      hotel={h}
                      palaceLabel={palaceLabel}
                      starsSuffix={starsSuffix}
                      viewLabel={viewLabel}
                      showCity={false}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DirectoryMapLayout>

      {/* Sibling-countries cross-link strip. */}
      {directory.otherCountries.length > 0 ? (
        <section
          aria-labelledby="directory-other-countries"
          className="border-border border-t pt-8"
        >
          <h2
            id="directory-other-countries"
            className="text-muted mb-4 text-xs font-semibold uppercase tracking-wide"
          >
            {t('country.otherCountries')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {directory.otherCountries.slice(0, OTHER_COUNTRIES_MAX).map((c) => (
              <li key={c.code}>
                <Link
                  href={{ pathname: '/hotels/[pays]', params: { pays: c.slug } }}
                  className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
                >
                  {c.name}
                  <span className="text-muted ml-1.5">({c.hotelCount})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
