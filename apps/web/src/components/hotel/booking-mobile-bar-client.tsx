'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';

import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';

export interface BookingMobileBarLabels {
  readonly datesPlaceholder: string;
  readonly guestsHint: string;
  readonly priceFromLabel: string;
  readonly ctaSeePrices: string;
  readonly ctaBook: string;
  readonly ctaConcierge: string;
  readonly ctaAriaSeePrices: string;
  readonly ctaAriaBook: string;
  readonly ctaAriaConcierge: string;
  readonly sheetTitle: string;
  readonly closeSheet: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: string;
  readonly comingSoonCta: string;
  readonly sandboxSubmit: string;
  readonly conciergeSubmit: string;
  readonly paidSubmit: string;
}

interface BookingMobileBarClientProps {
  readonly priceFrom: string | null;
  readonly labels: BookingMobileBarLabels;
  readonly variant: 'coming_soon' | 'sandbox_live' | 'concierge_live' | 'paid_live';
  readonly sandboxAction?: string | undefined;
  readonly sandboxDefaults?:
    | {
        readonly checkIn: string;
        readonly checkOut: string;
        readonly adults: number;
        readonly today: string;
      }
    | undefined;
  readonly conciergeAction?: string | undefined;
  readonly conciergeDefaults?:
    | {
        readonly hotelId: string;
        readonly checkIn: string;
        readonly checkOut: string;
        readonly rooms: number;
        readonly adults: number;
        readonly children: number;
        readonly childAges: readonly number[];
        readonly today: string;
      }
    | undefined;
  readonly paidAction?: string | undefined;
  readonly paidDefaults?:
    | {
        readonly hotelId: string;
        readonly checkIn: string;
        readonly checkOut: string;
        readonly rooms: number;
        readonly adults: number;
        readonly children: number;
        readonly childAges: readonly number[];
        readonly today: string;
        readonly fake: boolean;
      }
    | undefined;
}

/**
 * Fixed bottom booking bar for mobile viewports (≤680px). Collapsed by
 * default; tap opens a bottom sheet with the full (or placeholder) form.
 */
export function BookingMobileBarClient({
  priceFrom,
  labels,
  variant,
  sandboxAction,
  sandboxDefaults,
  conciergeAction,
  conciergeDefaults,
  paidAction,
  paidDefaults,
}: BookingMobileBarClientProps): ReactElement {
  const sheetId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpandedState] = useState(false);

  const toggleExpanded = useCallback((): void => {
    setExpandedState((prev) => {
      const next = !prev;
      document.body.classList.toggle('booking-mobile-sheet-open', next);
      if (next) {
        requestAnimationFrame(() => {
          const sheet = sheetRef.current;
          const focusTarget = sheet?.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          focusTarget?.focus();
        });
      }
      return next;
    });
  }, []);

  const closeExpanded = useCallback((): void => {
    setExpandedState(false);
    document.body.classList.remove('booking-mobile-sheet-open');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        closeExpanded();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('booking-mobile-sheet-open');
    };
  }, [closeExpanded, expanded]);

  const hasPrice = priceFrom !== null && priceFrom !== '';
  const ctaLabel =
    variant === 'sandbox_live' || variant === 'paid_live'
      ? labels.ctaBook
      : variant === 'concierge_live'
        ? labels.ctaConcierge
        : labels.ctaSeePrices;
  const ctaAria =
    variant === 'sandbox_live' || variant === 'paid_live'
      ? labels.ctaAriaBook
      : variant === 'concierge_live'
        ? labels.ctaAriaConcierge
        : labels.ctaAriaSeePrices;

  return (
    <div className="resa-mobile-bar-wrap mch-kit">
      <div className="resa-mobile-bar-spacer" aria-hidden />

      <div
        className="resa-mobile-bar"
        data-booking-widget="mobile_bar"
        data-expanded={expanded ? 'true' : 'false'}
        role="region"
        aria-label={labels.sheetTitle}
      >
        <button
          type="button"
          className="resa-mobile-bar__summary"
          aria-expanded={expanded}
          aria-controls={sheetId}
          onClick={toggleExpanded}
        >
          <span className="resa-mobile-bar__meta">
            <span className="resa-mobile-bar__dates">{labels.datesPlaceholder}</span>
            <span className="resa-mobile-bar__guests">{labels.guestsHint}</span>
          </span>
          {hasPrice ? (
            <span className="resa-mobile-bar__price">
              <span className="resa-mobile-bar__from">{labels.priceFromLabel}</span>
              <strong>{priceFrom}</strong>
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="btn btn-or resa-mobile-bar__cta"
          aria-label={ctaAria}
          aria-expanded={expanded}
          aria-controls={sheetId}
          onClick={toggleExpanded}
        >
          {ctaLabel}
        </button>
      </div>

      <div
        ref={sheetRef}
        id={sheetId}
        className="resa-mobile-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        hidden={!expanded}
      >
        <button
          type="button"
          className="resa-mobile-sheet__backdrop"
          aria-label={labels.closeSheet}
          onClick={closeExpanded}
        />

        <div className="resa-mobile-sheet__panel">
          <header className="resa-mobile-sheet__head">
            <h2 id={titleId} className="resa-mobile-sheet__title">
              {labels.sheetTitle}
            </h2>
            <button
              type="button"
              className="resa-mobile-sheet__close"
              aria-label={labels.closeSheet}
              onClick={closeExpanded}
            >
              ×
            </button>
          </header>

          {variant === 'sandbox_live' &&
          sandboxAction !== undefined &&
          sandboxDefaults !== undefined ? (
            <SandboxSheetForm
              action={sandboxAction}
              defaults={sandboxDefaults}
              labels={{
                checkIn: labels.checkIn,
                checkOut: labels.checkOut,
                adults: labels.adults,
                submit: labels.sandboxSubmit,
              }}
            />
          ) : variant === 'paid_live' && paidAction !== undefined && paidDefaults !== undefined ? (
            <PaidSheetForm
              action={paidAction}
              defaults={paidDefaults}
              labels={{
                checkIn: labels.checkIn,
                checkOut: labels.checkOut,
                submit: labels.paidSubmit,
              }}
            />
          ) : variant === 'concierge_live' &&
            conciergeAction !== undefined &&
            conciergeDefaults !== undefined ? (
            <ConciergeSheetForm
              action={conciergeAction}
              defaults={conciergeDefaults}
              labels={{
                checkIn: labels.checkIn,
                checkOut: labels.checkOut,
                submit: labels.conciergeSubmit,
              }}
            />
          ) : (
            <ComingSoonSheetContent labels={labels} hasPrice={hasPrice} priceFrom={priceFrom} />
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoonSheetContent({
  labels,
  hasPrice,
  priceFrom,
}: {
  readonly labels: BookingMobileBarLabels;
  readonly hasPrice: boolean;
  readonly priceFrom: string | null;
}): ReactElement {
  return (
    <>
      {hasPrice && priceFrom !== null ? (
        <div className="resa-price resa-mobile-sheet__price">
          <span className="rp-from">{labels.priceFromLabel}</span>
          <span className="rp-amount">{priceFrom}</span>
        </div>
      ) : null}

      <div className="resa-form" aria-hidden="true">
        <span className="rf-field">
          <span>{labels.checkIn}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
        <span className="rf-field">
          <span>{labels.checkOut}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
        <span className="rf-field">
          <span>{labels.adults}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
      </div>

      <button
        type="button"
        className="btn btn-or resa-go cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
      >
        {labels.comingSoonCta}
      </button>
    </>
  );
}

function PaidSheetForm({
  action,
  defaults,
  labels,
}: {
  readonly action: string;
  readonly defaults: {
    readonly hotelId: string;
    readonly checkIn: string;
    readonly checkOut: string;
    readonly rooms: number;
    readonly adults: number;
    readonly children: number;
    readonly childAges: readonly number[];
    readonly today: string;
    readonly fake: boolean;
  };
  readonly labels: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly submit: string;
  };
}): ReactElement {
  return (
    <form
      method="post"
      action={action}
      className="resa-mobile-sheet__form"
      data-testid="booking-widget-form"
    >
      <input type="hidden" name="hotelId" value={defaults.hotelId} />
      {defaults.fake ? <input type="hidden" name="fake" value="1" /> : null}
      <label className="rf-field">
        <span>{labels.checkIn}</span>
        <input
          type="date"
          name="checkIn"
          defaultValue={defaults.checkIn}
          min={defaults.today}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <label className="rf-field">
        <span>{labels.checkOut}</span>
        <input
          type="date"
          name="checkOut"
          defaultValue={defaults.checkOut}
          min={defaults.checkOut}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <StayOccupancyFields
        defaults={{
          rooms: defaults.rooms,
          adults: defaults.adults,
          childAges: defaults.childAges,
        }}
      />
      <button type="submit" className="btn btn-or resa-go">
        {labels.submit}
      </button>
    </form>
  );
}

function ConciergeSheetForm({
  action,
  defaults,
  labels,
}: {
  readonly action: string;
  readonly defaults: {
    readonly hotelId: string;
    readonly checkIn: string;
    readonly checkOut: string;
    readonly rooms: number;
    readonly adults: number;
    readonly children: number;
    readonly childAges: readonly number[];
    readonly today: string;
  };
  readonly labels: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly submit: string;
  };
}): ReactElement {
  return (
    <form
      method="get"
      action={action}
      className="resa-mobile-sheet__form"
      data-testid="booking-widget-form"
    >
      <input type="hidden" name="hotelId" value={defaults.hotelId} />
      <label className="rf-field">
        <span>{labels.checkIn}</span>
        <input
          type="date"
          name="checkIn"
          defaultValue={defaults.checkIn}
          min={defaults.today}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <label className="rf-field">
        <span>{labels.checkOut}</span>
        <input
          type="date"
          name="checkOut"
          defaultValue={defaults.checkOut}
          min={defaults.checkOut}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <StayOccupancyFields
        defaults={{
          rooms: defaults.rooms,
          adults: defaults.adults,
          childAges: defaults.childAges,
        }}
      />
      <button type="submit" className="btn btn-or resa-go">
        {labels.submit}
      </button>
    </form>
  );
}

function SandboxSheetForm({
  action,
  defaults,
  labels,
}: {
  readonly action: string;
  readonly defaults: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
    readonly today: string;
  };
  readonly labels: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: string;
    readonly submit: string;
  };
}): ReactElement {
  return (
    <form
      method="get"
      action={action}
      className="resa-mobile-sheet__form"
      data-testid="booking-widget-form"
    >
      <label className="rf-field">
        <span>{labels.checkIn}</span>
        <input
          type="date"
          name="checkIn"
          defaultValue={defaults.checkIn}
          min={defaults.today}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <label className="rf-field">
        <span>{labels.checkOut}</span>
        <input
          type="date"
          name="checkOut"
          defaultValue={defaults.checkOut}
          min={defaults.checkOut}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <label className="rf-field">
        <span>{labels.adults}</span>
        <input
          type="number"
          name="adults"
          min={1}
          max={9}
          defaultValue={defaults.adults}
          required
          className="rf-val border-0 bg-transparent p-0"
        />
      </label>
      <button type="submit" className="btn btn-or resa-go">
        {labels.submit}
      </button>
    </form>
  );
}
