import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { mobileDefaultHotelStay, todayIso } from '@/lib/booking/default-hotel-stay';
import {
  isConciergeBookingMode,
  isPaidBookingMode,
  isSupplierBookableRail,
} from '@/lib/booking/booking-mode-helpers';
import { isTravelportSandboxEnabled } from '@/lib/travelport';
import type { HotelBookingRailContext } from '@/server/booking/prepare-hotel-booking-rail';
import type { BookingMode } from '@mch/domain/hotels';

import type { BookingKitRailLabels } from './booking-kit-rail-client';
import { BookingMobileBarClient } from './booking-mobile-bar-client';
import { BookingWidgetSubmitTracker } from './booking-widget-tracker';

interface BookingMobileBarProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly slug?: string;
  readonly hotelId?: string;
  readonly bookingMode?: BookingMode;
  readonly priceFrom?: string | null;
  readonly railContext?: HotelBookingRailContext;
}

async function loadKitRailLabels(
  locale: SupportedLocale,
  hotelName: string,
): Promise<BookingKitRailLabels> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });

  return {
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
  };
}

export async function BookingMobileBar({
  locale,
  hotelName,
  slug,
  hotelId,
  bookingMode,
  priceFrom = null,
  railContext,
}: BookingMobileBarProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });

  const isSandboxLive =
    slug !== undefined &&
    bookingMode === 'travelport' &&
    (locale === 'fr' || locale === 'en') &&
    isTravelportSandboxEnabled();

  const isSupplierLive = isSupplierBookableRail(railContext, hotelId);

  const isPaidLive =
    isSupplierLive ||
    (hotelId !== undefined &&
      isPaidBookingMode(bookingMode) &&
      railContext !== undefined &&
      railContext.lockActionUrl !== null);

  const isConciergeLive = hotelId !== undefined && isConciergeBookingMode(bookingMode);

  const variant: 'concierge' | 'travelport' | 'paid' | 'coming_soon' = isSandboxLive
    ? 'travelport'
    : isPaidLive
      ? 'paid'
      : isConciergeLive
        ? 'concierge'
        : 'coming_soon';

  const stay = mobileDefaultHotelStay();
  const today = todayIso();
  const kitLabels = await loadKitRailLabels(locale, hotelName);

  const sandboxAction =
    isSandboxLive && slug !== undefined
      ? getPathname({
          locale: locale === 'en' ? 'en' : 'fr',
          href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
        })
      : undefined;

  const conciergeAction = isConciergeLive
    ? getPathname({ locale, href: '/reservation/start' })
    : undefined;

  const paidAction =
    isPaidLive && railContext !== undefined && railContext.lockActionUrl !== null
      ? railContext.lockActionUrl
      : undefined;

  const formAction =
    variant === 'travelport' && sandboxAction !== undefined
      ? sandboxAction
      : variant === 'paid' && paidAction !== undefined
        ? paidAction
        : variant === 'concierge' && conciergeAction !== undefined
          ? conciergeAction
          : '#';

  const formMethod: 'get' | 'post' = variant === 'paid' ? 'post' : 'get';

  const labels = {
    ...kitLabels,
    editStay: tw('mobileBar.editStay'),
    ctaChooseRooms: tw('mobileBar.ctaChooseRooms'),
    comingSoonCta: t('bookingComingSoon.cta'),
    closeSheet: tw('mobileBar.closeSheet'),
    occupancyRooms: tw('mobileBar.occupancyRooms', { count: stay.rooms }),
    occupancyAdults: tw('mobileBar.occupancyAdults', { count: stay.adults }),
    occupancyChildren: tw('mobileBar.occupancyChildren', { count: stay.childAges.length }),
  };

  const tracker =
    hotelId !== undefined && bookingMode !== undefined ? (
      <BookingWidgetSubmitTracker
        hotelId={hotelId}
        bookingMode={bookingMode}
        surface="mobile_bar"
      />
    ) : null;

  return (
    <>
      <BookingMobileBarClient
        locale={locale}
        variant={variant}
        formAction={formAction}
        formMethod={formMethod}
        {...(hotelId !== undefined ? { hotelId } : {})}
        {...(variant === 'paid' && railContext?.fakeEnabled === true ? { fake: true } : {})}
        defaultStay={{
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          rooms: stay.rooms,
          adults: stay.adults,
          childAges: stay.childAges,
        }}
        today={today}
        priceFrom={priceFrom}
        labels={labels}
      />
      {tracker}
    </>
  );
}
