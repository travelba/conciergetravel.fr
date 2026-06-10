import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { defaultHotelStay, todayIso } from '@/lib/booking/default-hotel-stay';
import {
  isConciergeBookingMode,
  isPaidBookingMode,
  isSupplierBookableRail,
} from '@/lib/booking/booking-mode-helpers';
import { isTravelportSandboxEnabled } from '@/lib/travelport';
import type { HotelBookingRailContext } from '@/server/booking/prepare-hotel-booking-rail';
import type { BookingMode } from '@mch/domain/hotels';

import { BookingMobileBarClient } from './booking-mobile-bar-client';

interface BookingMobileBarProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly slug?: string;
  readonly hotelId?: string;
  readonly bookingMode?: BookingMode;
  readonly priceFrom?: string | null;
  readonly railContext?: HotelBookingRailContext;
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
  const tRail = await getTranslations({ locale, namespace: 'reservationRooms.rail' });

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

  const variant = isSandboxLive
    ? ('sandbox_live' as const)
    : isPaidLive
      ? ('paid_live' as const)
      : isConciergeLive
        ? ('concierge_live' as const)
        : ('coming_soon' as const);

  const stay = railContext?.defaultStay ?? defaultHotelStay();
  const today = todayIso();

  const labels = {
    datesPlaceholder: t('hero.datesPlaceholder'),
    guestsHint: t('hero.guests'),
    priceFromLabel: tw('priceFromLabel'),
    ctaSeePrices: tw('mobileBar.ctaSeePrices'),
    ctaBook: tw('mobileBar.ctaBook'),
    ctaConcierge: tw('conciergeSubmit'),
    ctaAriaSeePrices: tw('mobileBar.ctaAriaSeePrices', { name: hotelName }),
    ctaAriaBook: tw('mobileBar.ctaAriaBook', { name: hotelName }),
    ctaAriaConcierge: tw('mobileBar.ctaAriaBook', { name: hotelName }),
    sheetTitle: isSandboxLive
      ? tRail('headline', { hotel: hotelName })
      : isPaidLive
        ? t('sections.booking')
        : isConciergeLive
          ? tw('conciergeTitle')
          : t('sections.booking'),
    closeSheet: tw('mobileBar.closeSheet'),
    checkIn: isSandboxLive ? tRail('checkIn') : t('displayOnly.checkIn'),
    checkOut: isSandboxLive ? tRail('checkOut') : t('displayOnly.checkOut'),
    adults: isSandboxLive ? tRail('adults') : t('displayOnly.adults'),
    comingSoonCta: t('bookingComingSoon.cta'),
    sandboxSubmit: tRail('submit'),
    conciergeSubmit: tw('conciergeSubmit'),
    paidSubmit: railContext?.fakeEnabled === true ? t('booking.submitTest') : t('booking.submit'),
  };

  return (
    <BookingMobileBarClient
      priceFrom={priceFrom}
      labels={labels}
      variant={variant}
      {...(isSandboxLive && slug !== undefined
        ? {
            sandboxAction: getPathname({
              locale: locale === 'en' ? 'en' : 'fr',
              href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
            }),
            sandboxDefaults: {
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              adults: stay.adults,
              today,
            },
          }
        : {})}
      {...(isConciergeLive && hotelId !== undefined
        ? {
            conciergeAction: getPathname({ locale, href: '/reservation/start' }),
            conciergeDefaults: {
              hotelId,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              rooms: stay.rooms,
              adults: stay.adults,
              children: stay.children,
              childAges: stay.childAges,
              today,
            },
          }
        : {})}
      {...(isPaidLive &&
      hotelId !== undefined &&
      railContext !== undefined &&
      railContext.lockActionUrl !== null
        ? {
            paidAction: railContext.lockActionUrl,
            paidDefaults: {
              hotelId,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              rooms: stay.rooms,
              adults: stay.adults,
              children: stay.children,
              childAges: stay.childAges,
              today,
              fake: railContext.fakeEnabled,
            },
          }
        : {})}
    />
  );
}
