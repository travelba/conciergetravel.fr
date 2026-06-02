import { getTranslations } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { CityDirectory } from '@/server/annuaire/get-city-directory';
import type { DirectoryMapPoint } from '@/components/directory/directory-map-layout';

import { DirectoryHotelCard } from './directory-hotel-card';
import { DirectoryMapLayout } from './directory-map-layout';
import { buildDirectoryFacets } from './filter-logic';

/**
 * `<DirectoryCityView>` — body of `/hotels/[pays]/[ville]` (ADR-0026).
 *
 * Exhaustive, factual list of every published hotel in the city. Links
 * back up to the country annuaire and laterally to the editorial city
 * guide (`/destination/[citySlug]`) — the reciprocal of the
 * anti-cannibalisation link the destination page renders.
 */
interface DirectoryCityViewProps {
  readonly directory: CityDirectory;
  /** Geolocated markers (built by the page, locale-aware). */
  readonly mapPoints: readonly DirectoryMapPoint[];
  /** AEO block rendered right after the header (page owns the CSP nonce). */
  readonly aeoSlot?: ReactNode;
}

export async function DirectoryCityView({
  directory,
  mapPoints,
  aeoSlot,
}: DirectoryCityViewProps): Promise<ReactElement> {
  const t = await getTranslations('directoryPage');
  const palaceLabel = t('card.palace');
  const starsSuffix = t('card.starsSuffix');
  const viewLabel = t('card.view');
  const mapLabels = {
    toggleShow: t('map.toggleShow'),
    toggleHide: t('map.toggleHide'),
    ariaLabel: t('map.ariaLabel', { city: directory.cityName }),
    popupView: t('map.popupView'),
    geocodedNote: t('map.geocodedNote', { located: mapPoints.length, total: directory.totalCount }),
  };
  const facets = buildDirectoryFacets(directory.hotels, 'district');

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
          <li>
            <Link
              href={{ pathname: '/hotels/[pays]', params: { pays: directory.countrySlug } }}
              className="hover:underline"
            >
              {directory.countryName}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {directory.cityName}
          </li>
        </ol>
      </nav>

      <header className="mb-8 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {t('city.h1', { city: directory.cityName })}
        </h1>
        <p className="text-muted mt-3 text-sm md:text-base">
          {t('city.subtitle', {
            count: directory.totalCount,
            city: directory.cityName,
            country: directory.countryName,
          })}
        </p>
      </header>

      {aeoSlot}

      <DirectoryMapLayout
        points={mapPoints}
        labels={mapLabels}
        facets={facets}
        totalCount={directory.totalCount}
        placeKey="district"
      >
        <ul className="flex flex-col gap-3">
          {directory.hotels.map((h) => (
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
      </DirectoryMapLayout>

      <nav
        aria-label={t('city.exploreLabel')}
        className="border-border mt-12 flex flex-wrap gap-3 border-t pt-8 text-sm"
      >
        <Link
          href={{ pathname: '/hotels/[pays]', params: { pays: directory.countrySlug } }}
          className="border-border text-fg hover:bg-muted/10 rounded-md border px-4 py-2 font-medium"
        >
          ← {t('city.backToCountry', { country: directory.countryName })}
        </Link>
        <Link
          href={{ pathname: '/destination/[citySlug]', params: { citySlug: directory.citySlug } }}
          className="border-border text-fg hover:bg-muted/10 rounded-md border px-4 py-2 font-medium"
        >
          {t('city.editorialGuide', { city: directory.cityName })} →
        </Link>
      </nav>
    </>
  );
}
