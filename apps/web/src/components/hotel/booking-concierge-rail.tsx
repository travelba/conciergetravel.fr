import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { defaultHotelStay, todayIso } from '@/lib/booking/default-hotel-stay';

import { BookingKitRailClient, type BookingKitRailLabels } from './booking-kit-rail-client';
import { BookingStayUrlSync } from './booking-stay-url-sync';
import { BookingWidgetSubmitTracker } from './booking-widget-tracker';
import { BookingWidgetUrlHydrator } from './booking-widget-url-hydrator';

interface BookingConciergeRailProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly bookingMode: 'display_only' | 'email';
  readonly priceFrom?: string | null;
  readonly embeddedInKitAside?: boolean;
}

async function loadKitRailLabels(
  locale: SupportedLocale,
  hotelName: string,
): Promise<{ labels: BookingKitRailLabels }> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });

  return {
    labels: {
      checkIn: t('displayOnly.checkIn'),
      checkOut: t('displayOnly.checkOut'),
      priceFromLabel: tw('priceFromLabel'),
      priceFromUnit: tw('priceFromUnit'),
      onRequestLabel: tw('onRequestLabel'),
      submitConcierge: tw('conciergeSubmit'),
      submitTravelport: tw('travelportSubmit'),
      submitPending: tw('submitPending'),
      trustListAria: tw('trust.listAria'),
      trustBestRate: tw('trust.bestRate'),
      trustChip: t('displayOnly.trustChip'),
      headlineFallback: t('displayOnly.headline'),
      conciergeSection: t('sections.concierge'),
      conciergeExplainer: tw('conciergeExplainer', { name: hotelName }),
      sla: t('displayOnly.sla'),
    },
  };
}

/**
 * Live concierge booking rail for `display_only` / `email` hotels.
 */
export async function BookingConciergeRail({
  locale,
  hotelId,
  hotelName,
  bookingMode,
  priceFrom = null,
  embeddedInKitAside = false,
}: BookingConciergeRailProps): Promise<ReactElement> {
  const stay = defaultHotelStay();
  const { labels } = await loadKitRailLabels(locale, hotelName);
  const action = getPathname({ locale, href: '/reservation/start' });

  return (
    <>
      <BookingKitRailClient
        variant="concierge"
        locale={locale}
        hotelId={hotelId}
        hotelName={hotelName}
        bookingMode={bookingMode}
        priceFrom={priceFrom}
        formAction={action}
        embeddedInKitAside={embeddedInKitAside}
        defaultStay={stay}
        today={todayIso()}
        labels={labels}
      />
      <BookingWidgetSubmitTracker
        hotelId={hotelId}
        bookingMode={bookingMode}
        surface="sticky_widget"
      />
      <BookingWidgetUrlHydrator />
      <BookingStayUrlSync />
    </>
  );
}
