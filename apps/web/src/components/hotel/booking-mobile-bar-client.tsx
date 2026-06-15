'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { StayOccupancyFields } from '@/components/booking/stay-occupancy-fields';

export interface BookingMobileBarLabels {
  readonly datesLabel: string;
  readonly checkInDateValue: string;
  readonly checkOutDateValue: string;
  readonly priceFromLabel: string;
  readonly ctaSeePrices: string;
  readonly ctaChooseRooms: string;
  readonly ctaAriaSeePrices: string;
  readonly ctaAriaChooseRooms: string;
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
  readonly chooseRoomsHref?: string | undefined;
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

const MOBILE_BAR_MAX_WIDTH_PX = 680;
const SCROLL_REVEAL_OFFSET_PX = 120;
const MOBILE_REVEAL_ANCHOR_SELECTOR = '[data-booking-mobile-reveal-anchor]';

function isMobileBarViewport(): boolean {
  return window.matchMedia(`(max-width: ${MOBILE_BAR_MAX_WIDTH_PX}px)`).matches;
}

function shouldRevealMobileBar(): boolean {
  const anchor = document.querySelector(MOBILE_REVEAL_ANCHOR_SELECTOR);
  if (anchor !== null) {
    const rect = anchor.getBoundingClientRect();
    return rect.bottom < window.innerHeight * 0.62;
  }
  return window.scrollY > SCROLL_REVEAL_OFFSET_PX;
}

/**
 * Fixed bottom booking bar for mobile (≤680px). Hidden until the user scrolls
 * past the gallery; collapsed state shows dates only — tap opens occupancy sheet.
 */
export function BookingMobileBarClient({
  priceFrom,
  labels,
  variant,
  chooseRoomsHref,
  sandboxAction,
  sandboxDefaults,
  conciergeAction,
  conciergeDefaults,
  paidAction,
  paidDefaults,
}: BookingMobileBarClientProps): ReactElement | null {
  const sheetId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpandedState] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [portaled, setPortaled] = useState(false);

  useEffect(() => {
    setPortaled(true);
  }, []);

  useEffect(() => {
    const syncRevealed = (): void => {
      setRevealed(shouldRevealMobileBar());
    };

    syncRevealed();

    const anchor = document.querySelector(MOBILE_REVEAL_ANCHOR_SELECTOR);
    let observer: IntersectionObserver | null = null;

    if (anchor !== null) {
      observer = new IntersectionObserver(
        () => {
          syncRevealed();
        },
        { threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] },
      );
      observer.observe(anchor);
    }

    window.addEventListener('scroll', syncRevealed, { passive: true });
    window.addEventListener('resize', syncRevealed, { passive: true });

    return () => {
      if (observer !== null) observer.disconnect();
      window.removeEventListener('scroll', syncRevealed);
      window.removeEventListener('resize', syncRevealed);
    };
  }, []);

  useEffect(() => {
    const showDock = revealed && isMobileBarViewport();
    document.body.classList.toggle('has-mobile-booking-bar', showDock);
    return () => {
      document.body.classList.remove('has-mobile-booking-bar');
    };
  }, [revealed]);

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
  const hasChooseRoomsLink =
    chooseRoomsHref !== undefined &&
    chooseRoomsHref !== '' &&
    (variant === 'sandbox_live' || variant === 'concierge_live');
  const ctaLabel = hasChooseRoomsLink ? labels.ctaChooseRooms : labels.ctaSeePrices;
  const ctaAria = hasChooseRoomsLink ? labels.ctaAriaChooseRooms : labels.ctaAriaSeePrices;

  const bar = (
    <div
      className={`resa-mobile-bar-wrap mch-kit${revealed ? 'is-revealed' : ''}`}
      data-revealed={revealed ? 'true' : 'false'}
      data-mobile-booking-bar="true"
    >
      <div
        className="resa-mobile-bar"
        data-booking-widget="mobile_bar"
        data-expanded={expanded ? 'true' : 'false'}
        role="region"
        aria-label={labels.sheetTitle}
      >
        <div className="resa-mobile-bar__card">
          <button
            type="button"
            className="resa-mobile-bar__summary"
            aria-expanded={expanded}
            aria-controls={sheetId}
            aria-label={labels.datesLabel}
            onClick={toggleExpanded}
          >
            <div className="resa-mobile-bar__dates-grid">
              <span className="resa-mobile-bar__date-cell">
                <span className="resa-mobile-bar__date-label">{labels.checkIn}</span>
                <span className="resa-mobile-bar__date-value">{labels.checkInDateValue}</span>
              </span>
              <span className="resa-mobile-bar__date-cell">
                <span className="resa-mobile-bar__date-label">{labels.checkOut}</span>
                <span className="resa-mobile-bar__date-value">{labels.checkOutDateValue}</span>
              </span>
            </div>
            {hasPrice ? (
              <div className="resa-price resa-mobile-bar__price">
                <span className="rp-from">{labels.priceFromLabel}</span>
                <span className="rp-amount">{priceFrom}</span>
              </div>
            ) : null}
            <span className="resa-mobile-bar__chevron" aria-hidden="true">
              ›
            </span>
          </button>

          {hasChooseRoomsLink ? (
            <a
              href={chooseRoomsHref}
              className="btn btn-or resa-go resa-mobile-bar__cta"
              aria-label={ctaAria}
            >
              {ctaLabel}
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-or resa-go resa-mobile-bar__cta"
              aria-label={ctaAria}
              aria-expanded={expanded}
              aria-controls={sheetId}
              onClick={toggleExpanded}
            >
              {ctaLabel}
            </button>
          )}
        </div>
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

        <div className="resa-mobile-sheet__panel resa-card resa-mobile-sheet__panel--kit">
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

  if (!portaled) {
    return null;
  }

  return createPortal(bar, document.body) as ReactElement;
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
