import 'server-only';

import { pickGlobalBestRate } from '@mch/domain/booking';
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
import { env } from '@/lib/env';
import { isFakeOffersEnabled } from '@/server/booking/dev-fake-offer';
import { shopRates } from '@/server/booking/rate-shopping';
import { getHotelSupplierConnections } from '@/server/booking/supplier-catalog-repo';
import {
  getBestOfferForHotel,
  type AvailabilityState,
  type BestOfferResult,
} from '@/server/hotels/get-best-offer';

export interface HotelBookingRailContext {
  readonly defaultStay: ReturnType<typeof defaultHotelStay>;
  readonly fakeEnabled: boolean;
  /** True when multi-supplier rate-shopping returned a lockable winning rate. */
  readonly supplierBookable: boolean;
  /** @deprecated Amadeus legacy — removed once tunnel migrates to opaque rate lock. */
  readonly bestOffer: BestOfferResult;
  readonly lockActionUrl: string | null;
  readonly lockRateToken: string | null;
  readonly priceFrom: BookingWidgetPriceFrom | null;
  readonly limitedAvailability: BookingWidgetLimitedAvailability | null;
  readonly availabilityState: AvailabilityState;
}

interface PrepareHotelBookingRailInput {
  readonly locale: Locale;
  readonly hotelId: string;
  readonly bookingMode: BookingMode;
  /** @deprecated Amadeus — legacy fallback only. */
  readonly amadeusHotelId: string | null;
}

function lockActionFor(locale: Locale, rateToken: string): string {
  return getPathname({
    locale,
    href: { pathname: '/reservation/offer/[offerId]/lock', params: { offerId: rateToken } },
  });
}

const EMPTY_BEST_OFFER: BestOfferResult = {
  offerId: null,
  priceFrom: null,
  limitedAvailability: null,
  availabilityState: 'unknown',
};

/**
 * Single server-side prep for the fiche booking seam (`<BookingSlot>`).
 *
 * Phase 6 (ADR-0026): `shopRates` when `MULTI_SUPPLIER_RATESHOPPING_ENABLED` and
 * the hotel has enabled supplier connections. Legacy Amadeus path remains as a
 * fallback until full decommission.
 */
export async function prepareHotelBookingRail(
  input: PrepareHotelBookingRailInput,
): Promise<HotelBookingRailContext> {
  const stay = defaultHotelStay();
  const fakeEnabled = isFakeOffersEnabled();

  // Travelport pilot — sandbox funnel only; skip supplier / Amadeus shop on SSR.
  if (input.bookingMode === 'travelport') {
    return {
      defaultStay: stay,
      fakeEnabled,
      supplierBookable: false,
      bestOffer: EMPTY_BEST_OFFER,
      lockActionUrl: null,
      lockRateToken: null,
      priceFrom: null,
      limitedAvailability: null,
      availabilityState: 'unknown',
    };
  }

  const connections = await getHotelSupplierConnections(input.hotelId);
  const multiSupplierActive =
    env.MULTI_SUPPLIER_RATESHOPPING_ENABLED === true && connections.length > 0;

  if (multiSupplierActive) {
    const shopResult = await shopRates({ hotelId: input.hotelId, stay });
    const globalBest = pickGlobalBestRate(shopResult.rooms);

    if (globalBest !== null) {
      const priceFrom: BookingWidgetPriceFrom = {
        amount: { fromMinor: globalBest.priceMinor, toMinor: null, currency: 'EUR' },
        source: 'supplier_live',
      };
      const lockRateToken = globalBest.rateToken;
      return {
        defaultStay: stay,
        fakeEnabled,
        supplierBookable: true,
        bestOffer: {
          offerId: lockRateToken,
          priceFrom,
          limitedAvailability: null,
          availabilityState: 'available',
        },
        lockActionUrl: lockActionFor(input.locale, lockRateToken),
        lockRateToken,
        priceFrom,
        limitedAvailability: null,
        availabilityState: 'available',
      };
    }

    return {
      defaultStay: stay,
      fakeEnabled,
      supplierBookable: false,
      bestOffer: {
        ...EMPTY_BEST_OFFER,
        availabilityState: shopResult.rooms.length === 0 ? 'sold_out' : 'unknown',
      },
      lockActionUrl: null,
      lockRateToken: null,
      priceFrom: null,
      limitedAvailability: null,
      availabilityState: shopResult.rooms.length === 0 ? 'sold_out' : 'unknown',
    };
  }

  const legacyPaid = isPaidBookingMode(input.bookingMode);
  const bestOffer = legacyPaid
    ? await getBestOfferForHotel({
        hotelId: input.hotelId,
        amadeusHotelId:
          input.amadeusHotelId !== null && input.amadeusHotelId !== ''
            ? input.amadeusHotelId
            : null,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: stay.adults,
        childAges: stay.childAges.length > 0 ? [...stay.childAges] : [],
      })
    : EMPTY_BEST_OFFER;

  const lockRateToken = bestOffer.offerId;
  const lockActionUrl =
    legacyPaid && lockRateToken !== null ? lockActionFor(input.locale, lockRateToken) : null;

  return {
    defaultStay: stay,
    fakeEnabled,
    supplierBookable: false,
    bestOffer,
    lockActionUrl,
    lockRateToken,
    priceFrom: bestOffer.priceFrom,
    limitedAvailability: bestOffer.limitedAvailability,
    availabilityState: bestOffer.availabilityState,
  };
}

const OFFER_VALID_DAYS = 7;

/**
 * Phase 6 seam — `Hotel.makesOffer` when a live multi-supplier or legacy rate
 * exists. Never fabricated (DSA / Hard Rule 5).
 */
export function buildOfferJsonLdInput(
  railContext: HotelBookingRailContext,
  canonicalUrl: string,
): OfferInput | null {
  if (railContext.priceFrom === null) return null;
  if (railContext.lockRateToken === null) return null;

  const availability =
    railContext.limitedAvailability !== null
      ? ('LimitedAvailability' as const)
      : railContext.availabilityState === 'sold_out'
        ? ('OutOfStock' as const)
        : ('InStock' as const);

  return {
    priceFromEUR: railContext.priceFrom.amount.fromMinor / 100,
    url: canonicalUrl,
    priceValidUntil: new Date(Date.now() + OFFER_VALID_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10),
    availability,
  };
}
