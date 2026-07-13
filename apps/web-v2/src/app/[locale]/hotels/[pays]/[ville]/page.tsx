import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { HotelCardListing } from '@/components/hotel-card-listing';
import { DEMO_COUNTRIES, getDemoHotelsByCity, resolveDemoZone } from '@/lib/demo-data';
import { directorySeo } from '@/lib/seo/keyword-templates';

export const dynamic = 'force-dynamic';

// Le segment [ville] accepte ville OU région — famille « Hôtel {Zone} » (ADR-0034 §2).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pays: string; ville: string }>;
}): Promise<Metadata> {
  const { locale, pays, ville } = await params;
  const zone = resolveDemoZone(pays, ville);
  if (zone === undefined) return {};

  const seo = directorySeo({
    zoneLabel: zone.label,
    kind: zone.kind,
    hotelCount: zone.hotelCount,
    locale: locale === 'en' ? 'en' : 'fr',
  });
  return { title: seo.title, description: seo.description };
}

export default async function HotelsByZonePage({
  params,
}: {
  params: Promise<{ locale: string; pays: string; ville: string }>;
}) {
  const { locale, pays, ville } = await params;
  setRequestLocale(locale);
  const resolvedLocale = locale === 'en' ? 'en' : 'fr';

  const country = DEMO_COUNTRIES.find((c) => c.slug === pays);
  const zone = resolveDemoZone(pays, ville);
  if (country === undefined || zone === undefined) notFound();

  const displayHotels = zone.kind === 'ville' ? getDemoHotelsByCity(pays, ville) : [];

  const seo = directorySeo({
    zoneLabel: zone.label,
    kind: zone.kind,
    hotelCount: zone.hotelCount,
    locale: resolvedLocale,
  });

  return (
    <div className="ui-v2-container py-8">
      <h1>{seo.h1}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        {country.label} · {zone.hotelCount} hôtels
        {zone.kind === 'region' ? (resolvedLocale === 'fr' ? ' · région' : ' · region') : ''}
      </p>

      {displayHotels.length === 0 ? (
        <p className="mt-8 text-[var(--color-muted)]">
          Aucun hôtel de démonstration pour cette zone — branchez le read-model v2.*
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {displayHotels.map((hotel) => (
            <HotelCardListing key={hotel.slug} hotel={hotel} />
          ))}
        </div>
      )}
    </div>
  );
}
