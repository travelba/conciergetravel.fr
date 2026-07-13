import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchBar } from '@mch/ui-v2';

import { HotelCardListing } from '@/components/hotel-card-listing';
import { Link } from '@/i18n/navigation';
import { DEMO_DESTINATIONS, DEMO_HOTELS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="pb-12">
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-[var(--space-margin-mobile)] py-8 md:px-[var(--space-margin-desktop)] md:py-12">
        <div className="ui-v2-container mx-auto max-w-4xl text-center">
          <h1 className="mb-3">{t('title')}</h1>
          <p className="mb-8 text-[var(--color-muted)]">{t('subtitle')}</p>
          <Link href="/recherche" className="block">
            <SearchBar
              destinationLabel={t('searchDestination')}
              datesLabel={t('searchDates')}
              guestsLabel={t('searchGuests')}
              searchLabel={t('searchCta')}
            />
          </Link>
        </div>
      </section>

      <section className="ui-v2-container py-10">
        <div className="mb-6">
          <h2>{t('destinationsTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t('destinationsSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_DESTINATIONS.map((dest) => (
            <Link
              key={dest.slug}
              href={{
                pathname: '/hotels/[pays]/[ville]',
                params: { pays: dest.countrySlug, ville: dest.slug },
              }}
              className="group overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={dest.image}
                  alt={dest.label}
                  fill
                  sizes="(max-width: 640px) 100vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="font-serif text-lg">{dest.label}</h3>
                <p className="text-xs text-[var(--color-muted)]">{dest.hotelCount} hôtels</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="ui-v2-container border-t border-[var(--color-border)] pt-10">
        <h2 className="mb-6">Sélection du Concierge</h2>
        <div className="flex flex-col gap-4">
          {DEMO_HOTELS.slice(0, 2).map((hotel) => (
            <HotelCardListing key={hotel.slug} hotel={hotel} />
          ))}
        </div>
      </section>
    </div>
  );
}
