import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { isTravelportSandboxEnabled } from '@/lib/travelport';
import type { BookingMode } from '@mch/domain/hotels';

import { BookingMobileBarClient } from './booking-mobile-bar-client';

interface BookingMobileBarProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly slug?: string;
  readonly bookingMode?: BookingMode;
  readonly priceFrom?: string | null;
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Mobile-only sticky booking bar (≤680px). Renders a compact fixed footer
 * with dates placeholder, indicative price and a CTA; tap expands a bottom
 * sheet. Desktop is hidden via CSS — the rail widget stays unchanged.
 */
export async function BookingMobileBar({
  locale,
  hotelName,
  slug,
  bookingMode,
  priceFrom = null,
}: BookingMobileBarProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });
  const tRail = await getTranslations({ locale, namespace: 'reservationRooms.rail' });

  const isSandboxLive =
    slug !== undefined &&
    bookingMode === 'travelport' &&
    (locale === 'fr' || locale === 'en') &&
    isTravelportSandboxEnabled();

  const labels = {
    datesPlaceholder: t('hero.datesPlaceholder'),
    guestsHint: t('hero.guests'),
    priceFromLabel: tw('priceFromLabel'),
    ctaSeePrices: tw('mobileBar.ctaSeePrices'),
    ctaBook: tw('mobileBar.ctaBook'),
    ctaAriaSeePrices: tw('mobileBar.ctaAriaSeePrices', { name: hotelName }),
    ctaAriaBook: tw('mobileBar.ctaAriaBook', { name: hotelName }),
    sheetTitle: isSandboxLive ? tRail('headline', { hotel: hotelName }) : t('sections.booking'),
    closeSheet: tw('mobileBar.closeSheet'),
    checkIn: isSandboxLive ? tRail('checkIn') : t('displayOnly.checkIn'),
    checkOut: isSandboxLive ? tRail('checkOut') : t('displayOnly.checkOut'),
    adults: isSandboxLive ? tRail('adults') : t('displayOnly.adults'),
    comingSoonCta: t('bookingComingSoon.cta'),
    sandboxSubmit: tRail('submit'),
  };

  return (
    <BookingMobileBarClient
      priceFrom={priceFrom}
      labels={labels}
      variant={isSandboxLive ? 'sandbox_live' : 'coming_soon'}
      {...(isSandboxLive && slug !== undefined
        ? {
            sandboxAction: getPathname({
              locale: locale === 'en' ? 'en' : 'fr',
              href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
            }),
            sandboxDefaults: {
              checkIn: addDaysIso(30),
              checkOut: addDaysIso(31),
              adults: 1,
              today: addDaysIso(0),
            },
          }
        : {})}
    />
  );
}
