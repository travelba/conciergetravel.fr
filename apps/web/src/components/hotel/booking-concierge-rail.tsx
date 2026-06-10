import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SubmitButton } from '@/components/booking/submit-button';
import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';
import { getPathname } from '@/i18n/navigation';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { defaultHotelStay, todayIso } from '@/lib/booking/default-hotel-stay';

import { BookingStayUrlSync } from './booking-stay-url-sync';
import { BookingWidgetSubmitTracker } from './booking-widget-tracker';
import { BookingWidgetUrlHydrator } from './booking-widget-url-hydrator';

interface BookingConciergeRailProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly bookingMode: 'display_only' | 'email';
  readonly priceFrom?: string | null;
  /** Kit aside: skip outer `<section>` — parent is already `.htl-aside`. */
  readonly embeddedInKitAside?: boolean;
}

/**
 * Live concierge booking rail for `display_only` / `email` hotels.
 *
 * Occupies the same kit `.resa-card` slot as `<BookingComingSoon>` but ships
 * a working GET form to `/reservation/start` (dates + party pre-filled).
 */
export async function BookingConciergeRail({
  locale,
  hotelId,
  hotelName,
  bookingMode,
  priceFrom = null,
  embeddedInKitAside = false,
}: BookingConciergeRailProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });
  const stay = defaultHotelStay();
  const today = todayIso();
  const action = getPathname({ locale, href: '/reservation/start' });
  const hasPrice = priceFrom !== null && priceFrom !== '';

  const card = (
    <div className="resa-card">
      {hasPrice ? (
        <div className="resa-price">
          <span className="rp-from">{tw('priceFromLabel')}</span>
          <span className="rp-amount">{priceFrom}</span>
          <span className="rp-unit">{tw('priceFromUnit')}</span>
        </div>
      ) : (
        <p className="rp-from">{t('displayOnly.headline')}</p>
      )}

      {!embeddedInKitAside ? (
        <h2
          id="booking-title"
          className="mt-3 font-serif text-xl leading-tight text-[color:var(--noir)]"
        >
          {t('sections.concierge')}
        </h2>
      ) : null}
      {!embeddedInKitAside ? (
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--texte-doux)]">
          {tw('conciergeExplainer', { name: hotelName })}
        </p>
      ) : null}

      <form method="get" action={action} className="resa-form" data-testid="booking-widget-form">
        <input type="hidden" name="hotelId" value={hotelId} />
        <label className="rf-field">
          <span>{t('displayOnly.checkIn')}</span>
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
          <span>{t('displayOnly.checkOut')}</span>
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
        <SubmitButton className="btn btn-or resa-go" pendingLabel={tw('conciergeSubmit')}>
          {tw('conciergeSubmit')}
        </SubmitButton>
      </form>

      <ul className="resa-trust" aria-label={tw('trust.listAria')}>
        <li>
          <CheckIcon />
          {tw('trust.bestRate')}
        </li>
        <li>
          <CheckIcon />
          {t('displayOnly.trustChip')}
        </li>
      </ul>

      {!embeddedInKitAside ? (
        <p className="resa-iata mt-4 text-center">{t('displayOnly.sla')}</p>
      ) : null}

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

function CheckIcon(): ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
