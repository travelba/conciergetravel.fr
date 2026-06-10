import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { defaultHotelStay, todayIso } from '@/lib/booking/default-hotel-stay';

import { BookingKitRailClient } from './booking-kit-rail-client';
import { BookingStayUrlSync } from './booking-stay-url-sync';
import { BookingWidgetSubmitTracker } from './booking-widget-tracker';
import { BookingWidgetUrlHydrator } from './booking-widget-url-hydrator';

interface BookingSandboxRailProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly slug: string;
  readonly priceFrom?: string | null;
  readonly embeddedInKitAside?: boolean;
}

/**
 * Travelport pilot — same kit shell as Airelles (`BookingKitRailClient`), sandbox
 * chambres tunnel on submit, live GDS price in `.resa-price`.
 */
export async function BookingSandboxRail({
  locale,
  hotelId,
  hotelName,
  slug,
  priceFrom = null,
  embeddedInKitAside = false,
}: BookingSandboxRailProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });

  const stay = defaultHotelStay();
  const action = getPathname({
    locale,
    href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
  });

  const labels = {
    checkIn: t('displayOnly.checkIn'),
    checkOut: t('displayOnly.checkOut'),
    priceFromLabel: tw('priceFromLabel'),
    priceFromUnit: tw('priceFromUnit'),
    onRequestLabel: tw('onRequestLabel'),
    submitConcierge: tw('conciergeSubmit'),
    submitTravelport: tw('travelportSubmit'),
    submitPending: tw('travelportSubmitPending'),
    trustListAria: tw('trust.listAria'),
    trustBestRate: tw('trust.bestRate'),
    trustChip: t('displayOnly.trustChip'),
    headlineFallback: t('displayOnly.headline'),
    conciergeSection: t('sections.concierge'),
    conciergeExplainer: tw('conciergeExplainer', { name: hotelName }),
    sla: t('displayOnly.sla'),
  };

  return (
    <>
      <BookingKitRailClient
        variant="travelport"
        locale={locale}
        hotelId={hotelId}
        hotelName={hotelName}
        bookingMode="travelport"
        slug={slug}
        priceFrom={priceFrom}
        formAction={action}
        embeddedInKitAside={embeddedInKitAside}
        defaultStay={stay}
        today={todayIso()}
        labels={labels}
      />
      <BookingWidgetSubmitTracker
        hotelId={hotelId}
        bookingMode="travelport"
        surface="sticky_widget"
      />
      <BookingWidgetUrlHydrator />
      <BookingStayUrlSync />
    </>
  );
}
