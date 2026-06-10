import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { getPathname } from '@/i18n/navigation';
import type { CompetitorProvider } from '@mch/domain/price-comparison';

import { BookingSandboxLiveAside } from './booking-sandbox-live-aside';

interface BookingSandboxRailProps {
  readonly locale: 'fr' | 'en';
  readonly hotelId: string;
  readonly hotelName: string;
  readonly slug: string;
  readonly embeddedInKitAside?: boolean;
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Pilote Travelport — dates, tarif MyConciergeHotel et comparatif OTA
 * dans le même bloc, mis à jour automatiquement quand les dates changent.
 */
export async function BookingSandboxRail({
  locale,
  hotelId,
  hotelName,
  slug,
  embeddedInKitAside = false,
}: BookingSandboxRailProps): Promise<ReactElement> {
  const [tRail, tCompare] = await Promise.all([
    getTranslations({ locale, namespace: 'reservationRooms.rail' }),
    getTranslations({ locale, namespace: 'priceComparator' }),
  ]);

  const today = addDaysIso(0);
  const checkIn = addDaysIso(30);
  const checkOut = addDaysIso(31);
  const action = getPathname({
    locale,
    href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
  });

  const providerLabel: Record<CompetitorProvider, string> = {
    booking_com: tCompare('providerLabel.booking_com'),
    expedia: tCompare('providerLabel.expedia'),
    hotels_com: tCompare('providerLabel.hotels_com'),
    official_site: tCompare('providerLabel.official_site'),
  };

  return (
    <BookingSandboxLiveAside
      locale={locale}
      hotelId={hotelId}
      slug={slug}
      formAction={action}
      embeddedInKitAside={embeddedInKitAside}
      compareEnabled={false}
      liveRatesEnabled
      headline={tRail('headline', { hotel: hotelName })}
      intro={tRail('intro')}
      footnote={tRail('note')}
      defaults={{ checkIn, checkOut, adults: 2, today }}
      labels={{
        checkIn: tRail('checkIn'),
        checkOut: tRail('checkOut'),
        adults: tRail('adults'),
        submit: tRail('submit'),
        submitting: tRail('submitting'),
        compareTitle: tCompare('title'),
        compareLoading: tCompare('loading'),
        compareLegal: tCompare('legal'),
        conciergeLabel: 'MyConciergeHotel',
        bestRateBadge: tRail('liveRateBest'),
        providerLabel,
        liveRateTitle: tRail('liveRateTitle'),
        liveRateLoading: tRail('liveRateLoading'),
        liveRateLegal: tRail('liveRateLegal'),
        liveRateCached: tRail('liveRateCached'),
      }}
    />
  );
}
