import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SubmitButton } from '@/components/booking/submit-button';
import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';
import type { SupportedLocale } from '@/i18n/supported-locale';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import { formatIndicativePriceParts } from '@/lib/format-indicative-price';
import { todayIso } from '@/lib/booking/default-hotel-stay';
import type { HotelBookingRailContext } from '@/server/booking/prepare-hotel-booking-rail';

import { BookingStayUrlSync } from './booking-stay-url-sync';
import type { BookingWidgetPriceFrom } from './booking-widget';
import { BookingWidgetSubmitTracker } from './booking-widget-tracker';
import { BookingWidgetUrlHydrator } from './booking-widget-url-hydrator';

interface BookingPaidRailProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly bookingMode: 'amadeus' | 'little' | 'multi_supplier';
  readonly railContext: HotelBookingRailContext;
  readonly priceFromLabel?: string | null;
  readonly embeddedInKitAside?: boolean;
}

export async function BookingPaidRail({
  locale,
  hotelId,
  bookingMode,
  railContext,
  priceFromLabel = null,
  embeddedInKitAside = false,
}: BookingPaidRailProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });
  const stay = railContext.defaultStay;
  const today = todayIso();
  const lockActionUrl = railContext.lockActionUrl;
  if (lockActionUrl === null) {
    throw new Error('BookingPaidRail requires lockActionUrl');
  }

  const displayPrice =
    railContext.priceFrom !== null
      ? formatPriceLabel(railContext.priceFrom, locale)
      : priceFromLabel;
  const hasPrice = displayPrice !== null && displayPrice !== '';

  const card = (
    <div className="resa-card">
      {hasPrice ? (
        <div className="resa-price">
          <span className="rp-from">{tw('priceFromLabel')}</span>
          <span className="rp-amount">{displayPrice}</span>
          <span className="rp-unit">{tw('priceFromUnit')}</span>
        </div>
      ) : (
        <p className="rp-from">{t('sections.booking')}</p>
      )}

      {!embeddedInKitAside ? (
        <h2
          id="booking-title"
          className="mt-3 font-serif text-xl leading-tight text-[color:var(--noir)]"
        >
          {t('sections.booking')}
        </h2>
      ) : null}
      {!embeddedInKitAside ? (
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--texte-doux)]">
          {t('booking.intro')}
        </p>
      ) : null}

      {railContext.limitedAvailability !== null ? (
        <p className="mt-3 text-xs font-medium text-[color:var(--or)]" role="status">
          {tw('limitedAvailability', { count: railContext.limitedAvailability.remainingCount })}
        </p>
      ) : railContext.availabilityState === 'sold_out' ? (
        <p className="mt-3 text-xs font-medium text-rose-800" role="status">
          {tw('soldOutForDates')}
        </p>
      ) : null}

      <form
        method="post"
        action={lockActionUrl}
        className="resa-form"
        data-testid="booking-widget-form"
      >
        <input type="hidden" name="hotelId" value={hotelId} />
        {railContext.fakeEnabled ? <input type="hidden" name="fake" value="1" /> : null}
        <label className="rf-field">
          <span>{t('booking.checkIn')}</span>
          <input
            type="date"
            name="checkIn"
            defaultValue={stay.checkIn}
            min={today}
            required
            className="rf-val border-0 bg-transparent p-0"
          />
        </label>
        <label className="rf-field">
          <span>{t('booking.checkOut')}</span>
          <input
            type="date"
            name="checkOut"
            defaultValue={stay.checkOut}
            min={stay.checkOut}
            required
            className="rf-val border-0 bg-transparent p-0"
          />
        </label>
        <StayOccupancyFields
          defaults={{
            rooms: stay.rooms,
            adults: stay.adults,
            childAges: stay.childAges,
          }}
        />
        <SubmitButton className="btn btn-or resa-go" pendingLabel={t('booking.submit')}>
          {railContext.fakeEnabled ? t('booking.submitTest') : t('booking.submit')}
        </SubmitButton>
      </form>

      <ul className="resa-trust" aria-label={tw('trust.listAria')}>
        <li>
          <CheckIcon />
          {tw('trust.bestRate')}
        </li>
        <li>
          <CheckIcon />
          {tw('trust.freeCancellation')}
        </li>
      </ul>

      <BookingWidgetSubmitTracker
        hotelId={hotelId}
        bookingMode={bookingMode}
        surface="sticky_widget"
      />
      <BookingWidgetUrlHydrator />
      <BookingStayUrlSync />
    </div>
  );

  if (embeddedInKitAside) {
    return (
      <div className="mch-kit" data-booking-widget="kit_rail">
        {card}
      </div>
    );
  }

  return (
    <section
      id="booking"
      aria-labelledby="booking-title"
      data-booking-widget="rail"
      className="mch-kit scroll-mt-24"
    >
      {card}
    </section>
  );
}

function formatPriceLabel(price: BookingWidgetPriceFrom, locale: SupportedLocale): string {
  const fmtLocale: Locale = pickByLocale(locale, 'fr', 'en');
  return formatIndicativePriceParts(price.amount, fmtLocale).from;
}

function CheckIcon(): ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
