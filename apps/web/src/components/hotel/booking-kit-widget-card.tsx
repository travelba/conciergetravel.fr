'use client';

import type { ReactElement } from 'react';

import { SubmitButton } from '@/components/booking/submit-button';
import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';
import type { SupportedLocale } from '@/i18n/supported-locale';

import { BookingKitStayDates } from './booking-kit-stay-dates';
import type { BookingKitRailLabels } from './booking-kit-rail-client';

export interface BookingKitWidgetCardProps {
  readonly locale: SupportedLocale;
  readonly variant: 'concierge' | 'travelport' | 'paid' | 'coming_soon';
  readonly formAction: string;
  readonly formMethod: 'get' | 'post';
  readonly hotelId?: string;
  readonly fake?: boolean;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly today: string;
  readonly onStayDatesChange: (checkIn: string, checkOut: string) => void;
  readonly defaultStay: {
    readonly rooms: number;
    readonly adults: number;
    readonly childAges: readonly number[];
  };
  readonly priceFrom: string | null;
  readonly labels: BookingKitRailLabels & {
    readonly submitChooseRooms: string;
    readonly comingSoonCta: string;
  };
  readonly showTrust?: boolean;
}

function CheckIcon(): ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Shared kit booking widget body — same `resa-card` / `resa-form` stack as the
 * desktop aside rail, reused in the mobile sticky dock sheet.
 */
export function BookingKitWidgetCard({
  locale,
  variant,
  formAction,
  formMethod,
  hotelId,
  fake = false,
  checkIn,
  checkOut,
  today,
  onStayDatesChange,
  defaultStay,
  priceFrom,
  labels,
  showTrust = true,
}: BookingKitWidgetCardProps): ReactElement {
  const editorialPrice =
    priceFrom !== null && priceFrom !== undefined && priceFrom !== '' ? priceFrom : null;
  const showPriceBand = variant !== 'coming_soon' && editorialPrice !== null;

  const submitLabel =
    variant === 'coming_soon'
      ? labels.comingSoonCta
      : variant === 'travelport'
        ? labels.submitTravelport
        : labels.submitChooseRooms;

  return (
    <div className="resa-card resa-mobile-widget__card-inner">
      {showPriceBand ? (
        <div className="resa-price">
          <span className="rp-from">{labels.priceFromLabel}</span>
          <span className="rp-amount">{editorialPrice}</span>
          <span className="rp-unit">{labels.priceFromUnit}</span>
        </div>
      ) : variant === 'coming_soon' ? (
        <p className="rp-from">{labels.headlineFallback}</p>
      ) : null}

      {variant === 'coming_soon' ? (
        <div className="resa-form" aria-hidden="true">
          <span className="rf-field">
            <span>{labels.checkIn}</span>
            <span className="rf-val text-[color:var(--texte-doux)]">—</span>
          </span>
        </div>
      ) : (
        <form
          method={formMethod}
          action={formAction}
          className="resa-form"
          data-testid="booking-widget-form"
        >
          {variant !== 'travelport' && hotelId !== undefined ? (
            <input type="hidden" name="hotelId" value={hotelId} />
          ) : null}
          {variant === 'paid' && fake ? <input type="hidden" name="fake" value="1" /> : null}
          <BookingKitStayDates
            locale={locale}
            checkIn={checkIn}
            checkOut={checkOut}
            today={today}
            onChange={onStayDatesChange}
          />
          <StayOccupancyFields
            defaults={{
              rooms: defaultStay.rooms,
              adults: defaultStay.adults,
              childAges: defaultStay.childAges,
            }}
          />
          <SubmitButton className="btn btn-or resa-go" pendingLabel={labels.submitPending}>
            {submitLabel}
          </SubmitButton>
        </form>
      )}

      {variant === 'coming_soon' ? (
        <button
          type="button"
          className="btn btn-or resa-go cursor-not-allowed opacity-60"
          disabled
          aria-disabled="true"
        >
          {labels.comingSoonCta}
        </button>
      ) : null}

      {showTrust && variant !== 'coming_soon' ? (
        <ul className="resa-trust resa-mobile-widget__trust" aria-label={labels.trustListAria}>
          <li>
            <CheckIcon />
            {labels.trustBestRate}
          </li>
          <li>
            <CheckIcon />
            {labels.trustChip}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
