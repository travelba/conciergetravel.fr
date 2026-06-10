import 'server-only';

import type { BookingMode } from '@mch/domain/hotels';
import type { OfferInput } from '@mch/seo/jsonld';

import type {
  BookingWidgetLimitedAvailability,
  BookingWidgetPriceFrom,
} from '@/components/hotel/booking-widget';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { defaultHotelStay } from '@/lib/booking/default-hotel-stay';
import { isPaidBookingMode } from '@/lib/booking/booking-mode-helpers';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';
import {
  getBestOfferForHotel,
  type AvailabilityState,
  type BestOfferResult,
} from '@/server/hotels/get-best-offer';

export interface HotelBookingRailContext {
  readonly defaultStay: ReturnType<typeof defaultHotelStay>;
  readonly fakeEnabled: boolean;
  readonly bestOffer: BestOfferResult;
  readonly lockActionUrl: string | null;
  readonly priceFrom: BookingWidgetPriceFrom | null;
  readonly limitedAvailability: BookingWidgetLimitedAvailability | null;
  readonly availabilityState: AvailabilityState;
}

interface PrepareHotelBookingRailInput {
  readonly locale: Locale;
  readonly hotelId: string;
  readonly bookingMode: BookingMode;
  readonly amadeusHotelId: string | null;
}

function lockActionFor(locale: Locale, hotelId: string, offerId: string | null): string {
  const id = offerId ?? `TEST-OFFER-${hotelId}`;
  return getPathname({
    locale,
    href: { pathname: '/reservation/offer/[offerId]/lock', params: { offerId: id } },
  });
}

/**
 * Single server-side prep for the fiche booking seam (`<BookingSlot>`).
 * Phase 6: flip `booking_mode` to `amadeus`/`little` + creds → live offer
 * without touching layout or mobile bar contracts.
 */
export async function prepareHotelBookingRail(
  input: PrepareHotelBookingRailInput,
): Promise<HotelBookingRailContext> {
  const stay = defaultHotelStay();
  const fakeEnabled = isFakeOffersEnabled();
  const bookable = isPaidBookingMode(input.bookingMode);

  const bestOffer = bookable
    ? await getBestOfferForHotel({
        hotelId: input.hotelId,
        amadeusHotelId:
          input.amadeusHotelId !== null && input.amadeusHotelId !== ''
            ? input.amadeusHotelId
            : null,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        childAges: [],
      })
    : {
        offerId: null,
        priceFrom: null,
        limitedAvailability: null,
        availabilityState: 'unknown' as const,
      };

  const lockActionUrl = bookable
    ? lockActionFor(input.locale, input.hotelId, bestOffer.offerId)
    : null;

  return {
    defaultStay: stay,
    fakeEnabled,
    bestOffer,
    lockActionUrl,
    priceFrom: bestOffer.priceFrom,
    limitedAvailability: bestOffer.limitedAvailability,
    availabilityState: bestOffer.availabilityState,
  };
}

const OFFER_VALID_DAYS = 7;

/**
 * Phase 6 seam — `Hotel.makesOffer` on the parent fiche when a live GDS rate
 * exists. Mirrors `chambres/[roomSlug]/page.tsx` (never fabricated).
 */
export function buildOfferJsonLdInput(
  railContext: HotelBookingRailContext,
  canonicalUrl: string,
): OfferInput | null {
  const { bestOffer } = railContext;
  if (bestOffer.priceFrom === null || bestOffer.offerId === null) {
    return null;
  }
  const availability =
    bestOffer.limitedAvailability !== null
      ? ('LimitedAvailability' as const)
      : bestOffer.availabilityState === 'sold_out'
        ? ('OutOfStock' as const)
        : ('InStock' as const);
  return {
    priceFromEUR: bestOffer.priceFrom.amount.fromMinor / 100,
    url: canonicalUrl,
    priceValidUntil: new Date(Date.now() + OFFER_VALID_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10),
    availability,
  };
}
