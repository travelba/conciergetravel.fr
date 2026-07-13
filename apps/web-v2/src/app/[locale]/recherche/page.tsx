import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HotelCardListing } from '@/components/hotel-card-listing';
import { SearchFilterPanel } from '@/components/search/filter-panel';
import { listHotelsV2 } from '@/server/hotels/list-hotels-v2';

export const dynamic = 'force-dynamic';

export default async function SearchResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; city?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('search');

  const resolvedLocale = locale === 'en' ? 'en' : 'fr';
  const { hotels } = await listHotelsV2({
    locale: resolvedLocale,
    ...(query.q !== undefined ? { query: query.q } : {}),
    ...(query.city !== undefined ? { city: query.city } : {}),
    limit: 50,
  });

  return (
    <div className="ui-v2-container py-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{t('title')}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t('resultsCount', { count: hotels.length })}
          </p>
        </div>
        <p className="text-sm text-[var(--color-muted)]">{t('sortLabel')}</p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[280px]">
          <h2 className="mb-3 text-sm font-semibold lg:sr-only">{t('filtersTitle')}</h2>
          <SearchFilterPanel />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {hotels.map((hotel) => (
            <HotelCardListing key={hotel.slug} hotel={hotel} />
          ))}
        </div>
      </div>
    </div>
  );
}
