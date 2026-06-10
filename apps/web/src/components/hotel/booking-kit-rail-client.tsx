'use client';

import { useEffect, useState, type ReactElement } from 'react';

import { SubmitButton } from '@/components/booking/submit-button';
import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { intlLocaleTag } from '@/i18n/runtime';
import { fetchTravelportSearch } from '@/lib/travelport/fetch-travelport-search';
import { dispatchTravelportStay } from '@/lib/travelport/stay-event';
import type { BookingMode } from '@mch/domain/hotels';

export interface BookingKitRailLabels {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly priceFromLabel: string;
  readonly priceFromUnit: string;
  readonly onRequestLabel: string;
  readonly submitConcierge: string;
  readonly submitTravelport: string;
  readonly submitPending: string;
  readonly trustListAria: string;
  readonly trustBestRate: string;
  readonly trustChip: string;
  readonly headlineFallback: string;
  readonly conciergeSection: string;
  readonly conciergeExplainer: string;
  readonly sla: string;
}

export interface BookingKitRailClientProps {
  readonly variant: 'concierge' | 'travelport';
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly bookingMode: BookingMode;
  readonly slug?: string;
  readonly priceFrom?: string | null;
  readonly formAction: string;
  readonly embeddedInKitAside: boolean;
  readonly defaultStay: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly rooms: number;
    readonly adults: number;
    readonly childAges: readonly number[];
  };
  readonly today: string;
  readonly labels: BookingKitRailLabels;
}

function addDayIso(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

function formatEur(locale: SupportedLocale, minor: number): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(minor) / 100);
}

function CheckIcon(): ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Unified kit booking rail — Airelles shell (`.resa-card`, `.resa-price`, trust
 * chips) with concierge or Travelport backend.
 */
export function BookingKitRailClient(props: BookingKitRailClientProps): ReactElement {
  const isTravelport = props.variant === 'travelport';
  const editorialPrice =
    props.priceFrom !== null && props.priceFrom !== undefined && props.priceFrom !== ''
      ? props.priceFrom
      : null;

  const [checkIn, setCheckIn] = useState(props.defaultStay.checkIn);
  const [checkOut, setCheckOut] = useState(props.defaultStay.checkOut);
  const [adults, setAdults] = useState(props.defaultStay.adults);
  const minCheckOut = addDayIso(checkIn >= props.today ? checkIn : props.today);

  const [liveRate, setLiveRate] = useState<
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly amountMinor: number }
    | { readonly status: 'empty' }
  >({ status: isTravelport ? 'loading' : 'idle' });

  useEffect(() => {
    if (!isTravelport || props.slug === undefined) {
      setLiveRate({ status: 'idle' });
      return;
    }

    dispatchTravelportStay({ checkIn, checkOut, adults });

    let cancelled = false;
    setLiveRate({ status: 'loading' });

    fetchTravelportSearch({
      slug: props.slug,
      checkIn,
      checkOut,
      adults,
      matchRooms: false,
    })
      .then((body) => {
        if (cancelled) return;
        if (
          body.ok === true &&
          body.available === true &&
          typeof body.cheapestMinor === 'number' &&
          body.cheapestMinor > 0
        ) {
          setLiveRate({ status: 'ready', amountMinor: body.cheapestMinor });
          return;
        }
        setLiveRate({ status: 'empty' });
      })
      .catch(() => {
        if (!cancelled) setLiveRate({ status: 'empty' });
      });

    return () => {
      cancelled = true;
    };
  }, [adults, checkIn, checkOut, isTravelport, props.slug]);

  useEffect(() => {
    if (!isTravelport) return;
    const form = document.querySelector<HTMLFormElement>('form[data-testid="booking-widget-form"]');
    if (form === null) return;

    const syncAdults = (): void => {
      const adultsInput = form.querySelector<HTMLInputElement>('input[name="adults"]');
      if (adultsInput === null) return;
      const n = Number.parseInt(adultsInput.value, 10);
      if (Number.isInteger(n) && n >= 1) setAdults(n);
    };

    form.addEventListener('change', syncAdults);
    syncAdults();
    return () => form.removeEventListener('change', syncAdults);
  }, [isTravelport]);

  const onCheckInChange = (next: string): void => {
    setCheckIn(next);
    if (checkOut <= next) setCheckOut(addDayIso(next));
  };

  let priceAmount: string;
  if (isTravelport) {
    if (liveRate.status === 'ready') {
      priceAmount = formatEur(props.locale, liveRate.amountMinor);
    } else if (liveRate.status === 'loading') {
      priceAmount = '…';
    } else if (editorialPrice !== null) {
      priceAmount = editorialPrice;
    } else {
      priceAmount = props.labels.onRequestLabel;
    }
  } else if (editorialPrice !== null) {
    priceAmount = editorialPrice;
  } else {
    priceAmount = '';
  }

  const showPriceBand = isTravelport || editorialPrice !== null;

  const card = (
    <div className="resa-card">
      {showPriceBand ? (
        <div className="resa-price" aria-busy={isTravelport && liveRate.status === 'loading'}>
          <span className="rp-from">{props.labels.priceFromLabel}</span>
          <span className="rp-amount">{priceAmount}</span>
          <span className="rp-unit">{props.labels.priceFromUnit}</span>
        </div>
      ) : (
        <p className="rp-from">{props.labels.headlineFallback}</p>
      )}

      {!props.embeddedInKitAside ? (
        <>
          <h2
            id="booking-title"
            className="mt-3 font-serif text-xl leading-tight text-[color:var(--noir)]"
          >
            {props.labels.conciergeSection}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--texte-doux)]">
            {props.labels.conciergeExplainer}
          </p>
        </>
      ) : null}

      <form
        method="get"
        action={props.formAction}
        className="resa-form"
        data-testid="booking-widget-form"
      >
        {!isTravelport ? <input type="hidden" name="hotelId" value={props.hotelId} /> : null}
        <label className="rf-field">
          <span>{props.labels.checkIn}</span>
          {isTravelport ? (
            <input
              type="date"
              name="checkIn"
              value={checkIn}
              min={props.today}
              required
              onChange={(e) => onCheckInChange(e.target.value)}
              className="rf-val border-0 bg-transparent p-0"
            />
          ) : (
            <input
              type="date"
              name="checkIn"
              defaultValue={props.defaultStay.checkIn}
              min={props.today}
              required
              className="rf-val border-0 bg-transparent p-0"
            />
          )}
        </label>
        <label className="rf-field">
          <span>{props.labels.checkOut}</span>
          {isTravelport ? (
            <input
              type="date"
              name="checkOut"
              value={checkOut}
              min={minCheckOut}
              required
              onChange={(e) => setCheckOut(e.target.value)}
              className="rf-val border-0 bg-transparent p-0"
            />
          ) : (
            <input
              type="date"
              name="checkOut"
              defaultValue={props.defaultStay.checkOut}
              min={props.defaultStay.checkOut}
              required
              className="rf-val border-0 bg-transparent p-0"
            />
          )}
        </label>
        <StayOccupancyFields
          defaults={{
            rooms: props.defaultStay.rooms,
            adults: props.defaultStay.adults,
            childAges: props.defaultStay.childAges,
          }}
        />
        <SubmitButton className="btn btn-or resa-go" pendingLabel={props.labels.submitPending}>
          {isTravelport ? props.labels.submitTravelport : props.labels.submitConcierge}
        </SubmitButton>
      </form>

      <ul className="resa-trust" aria-label={props.labels.trustListAria}>
        <li>
          <CheckIcon />
          {props.labels.trustBestRate}
        </li>
        <li>
          <CheckIcon />
          {props.labels.trustChip}
        </li>
      </ul>

      {!props.embeddedInKitAside ? (
        <p className="resa-iata mt-4 text-center">{props.labels.sla}</p>
      ) : null}
    </div>
  );

  if (props.embeddedInKitAside) {
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
