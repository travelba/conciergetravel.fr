import type { BookingMode } from '@mch/domain/hotels';

import type { SupportedLocale } from '@/i18n/supported-locale';
import {
  isConciergeBookingMode,
  isPaidBookingMode,
  isSupplierBookableRail,
} from '@/lib/booking/booking-mode-helpers';
import { isTravelportSandboxEnabled } from '@/lib/travelport';
import type { HotelBookingRailContext } from '@/server/booking/prepare-hotel-booking-rail';

import { BookingComingSoon } from './booking-coming-soon';
import { BookingConciergeRail } from './booking-concierge-rail';
import { BookingMobileBar } from './booking-mobile-bar';
import { BookingPaidRail } from './booking-paid-rail';
import { BookingSandboxRail } from './booking-sandbox-rail';

/**
 * Surfaces where a booking affordance can render on the hotel fiche:
 *  - `rail`     — the sticky right rail on desktop (prime conversion slot).
 *  - `mobilebar` — the fixed bottom bar on mobile.
 */
export type BookingSurface = 'rail' | 'mobilebar';

interface BookingSlotProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly surface: BookingSurface;
  readonly embeddedInKitAside?: boolean;
  readonly slug?: string;
  readonly hotelId?: string;
  readonly bookingMode?: BookingMode;
  readonly priceFrom?: string | null;
  /** Pre-computed booking context (offer lock, stay defaults). Required for paid modes. */
  readonly railContext?: HotelBookingRailContext;
}

/**
 * Single seam between editorial, concierge, Travelport pilot and GDS (Phase 6).
 * The fiche always renders `<BookingSlot>` twice (rail + mobilebar); only this
 * component decides the variant — layout and anchors stay stable across flips.
 */
export function BookingSlot({
  locale,
  hotelName,
  surface,
  slug,
  hotelId,
  bookingMode,
  priceFrom = null,
  embeddedInKitAside = false,
  railContext,
}: BookingSlotProps): React.ReactElement | null {
  if (surface === 'mobilebar') {
    return (
      <BookingMobileBar
        locale={locale}
        hotelName={hotelName}
        priceFrom={priceFrom}
        {...(slug !== undefined ? { slug } : {})}
        {...(hotelId !== undefined ? { hotelId } : {})}
        {...(bookingMode !== undefined ? { bookingMode } : {})}
        {...(railContext !== undefined ? { railContext } : {})}
      />
    );
  }

  const isTravelportLive =
    slug !== undefined &&
    bookingMode === 'travelport' &&
    (locale === 'fr' || locale === 'en') &&
    isTravelportSandboxEnabled();

  const isConciergeLive = hotelId !== undefined && isConciergeBookingMode(bookingMode);

  const isSupplierLive = isSupplierBookableRail(railContext, hotelId);

  const isPaidLive =
    isSupplierLive ||
    (hotelId !== undefined &&
      isPaidBookingMode(bookingMode) &&
      railContext !== undefined &&
      railContext.lockActionUrl !== null);

  const rail = isTravelportLive ? (
    <BookingSandboxRail locale={locale} hotelName={hotelName} slug={slug} />
  ) : isPaidLive && hotelId !== undefined && railContext !== undefined ? (
    <BookingPaidRail
      locale={locale}
      hotelId={hotelId}
      bookingMode={resolvePaidRailBookingMode(isSupplierLive, bookingMode)}
      railContext={railContext}
      priceFromLabel={priceFrom}
      embeddedInKitAside={embeddedInKitAside}
    />
  ) : isConciergeLive ? (
    <BookingConciergeRail
      locale={locale}
      hotelId={hotelId}
      hotelName={hotelName}
      bookingMode={bookingMode}
      priceFrom={priceFrom}
      embeddedInKitAside={embeddedInKitAside}
    />
  ) : (
    <BookingComingSoon
      locale={locale}
      hotelName={hotelName}
      priceFrom={priceFrom}
      embeddedInKitAside={embeddedInKitAside}
    />
  );

  return <div data-booking-rail>{rail}</div>;
}

function resolvePaidRailBookingMode(
  isSupplierLive: boolean,
  bookingMode: BookingMode | undefined,
): 'amadeus' | 'little' | 'multi_supplier' {
  if (isSupplierLive) return 'multi_supplier';
  if (bookingMode === 'amadeus' || bookingMode === 'little') return bookingMode;
  return 'amadeus';
}
