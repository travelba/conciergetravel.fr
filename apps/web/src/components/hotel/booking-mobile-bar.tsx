import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import { intlLocaleTag } from '@/i18n/runtime';
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

function formatMobileBarDateValue(isoDate: string, locale: SupportedLocale): string {
  const formatter = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    day: 'numeric',
    month: 'short',
  });
  const parseIso = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
  return formatter.format(parseIso(isoDate));
}

function formatMobileBarDates(
  checkIn: string,
  checkOut: string,
  checkInLabel: string,
  checkOutLabel: string,
  locale: SupportedLocale,
): string {
  const formatter = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    day: 'numeric',
    month: 'short',
  });
  const parseIso = (iso: string): Date => new Date(`${iso}T12:00:00Z`);
  return `${checkInLabel} ${formatter.format(parseIso(checkIn))} · ${checkOutLabel} ${formatter.format(parseIso(checkOut))}`;
}

function buildConciergeQueryString(
  hotelId: string,
  stay: ReturnType<typeof mobileDefaultHotelStay>,
): string {
  const params = new URLSearchParams({
    hotelId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    rooms: String(stay.rooms),
    adults: String(stay.adults),
    children: String(stay.children),
  });
  for (const age of stay.childAges) {
    params.append('childAge', String(age));
  }
  return params.toString();
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

  const stay = mobileDefaultHotelStay();
  const today = todayIso();

  const checkInLabel = isSandboxLive ? tRail('checkIn') : t('displayOnly.checkIn');
  const checkOutLabel = isSandboxLive ? tRail('checkOut') : t('displayOnly.checkOut');
  const datesLabel = formatMobileBarDates(
    stay.checkIn,
    stay.checkOut,
    checkInLabel,
    checkOutLabel,
    locale,
  );
  const checkInDateValue = formatMobileBarDateValue(stay.checkIn, locale);
  const checkOutDateValue = formatMobileBarDateValue(stay.checkOut, locale);

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

  const chooseRoomsHref =
    sandboxAction !== undefined
      ? `${sandboxAction}?${new URLSearchParams({
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: String(stay.adults),
        }).toString()}`
      : conciergeAction !== undefined && hotelId !== undefined
        ? `${conciergeAction}?${buildConciergeQueryString(hotelId, stay)}`
        : undefined;

  const labels = {
    datesLabel,
    checkInDateValue,
    checkOutDateValue,
    priceFromLabel: tw('priceFromLabel'),
    ctaSeePrices: tw('mobileBar.ctaSeePrices'),
    ctaChooseRooms: tw('mobileBar.ctaChooseRooms'),
    ctaAriaSeePrices: tw('mobileBar.ctaAriaSeePrices', { name: hotelName }),
    ctaAriaChooseRooms: tw('mobileBar.ctaAriaChooseRooms', { name: hotelName }),
    sheetTitle: isSandboxLive
      ? tRail('headline', { hotel: hotelName })
      : isPaidLive
        ? t('sections.booking')
        : isConciergeLive
          ? tw('conciergeTitle')
          : t('sections.booking'),
    closeSheet: tw('mobileBar.closeSheet'),
    checkIn: checkInLabel,
    checkOut: checkOutLabel,
    adults: isSandboxLive ? tRail('adults') : t('displayOnly.adults'),
    comingSoonCta: t('bookingComingSoon.cta'),
    sandboxSubmit: tw('mobileBar.ctaChooseRooms'),
    conciergeSubmit: tw('mobileBar.ctaChooseRooms'),
    paidSubmit:
      railContext?.fakeEnabled === true ? t('booking.submitTest') : tw('mobileBar.ctaChooseRooms'),
  };

  return (
    <BookingMobileBarClient
      priceFrom={priceFrom}
      labels={labels}
      variant={variant}
      {...(chooseRoomsHref !== undefined ? { chooseRoomsHref } : {})}
      {...(isSandboxLive && sandboxAction !== undefined
        ? {
            sandboxAction,
            sandboxDefaults: {
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              adults: stay.adults,
              today,
            },
          }
        : {})}
      {...(isConciergeLive && hotelId !== undefined && conciergeAction !== undefined
        ? {
            conciergeAction,
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
