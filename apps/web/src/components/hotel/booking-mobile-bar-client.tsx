'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { BookingKitWidgetCard } from '@/components/hotel/booking-kit-widget-card';
import type { BookingKitRailLabels } from '@/components/hotel/booking-kit-rail-client';
import type { SupportedLocale } from '@/i18n/supported-locale';

export interface BookingMobileBarClientProps {
  readonly locale: SupportedLocale;
  readonly variant: 'concierge' | 'travelport' | 'paid' | 'coming_soon';
  readonly formAction: string;
  readonly formMethod: 'get' | 'post';
  readonly hotelId?: string;
  readonly fake?: boolean;
  readonly defaultStay: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly rooms: number;
    readonly adults: number;
    readonly childAges: readonly number[];
  };
  readonly today: string;
  readonly priceFrom: string | null;
  readonly labels: BookingKitRailLabels & {
    readonly editStay: string;
    readonly ctaChooseRooms: string;
    readonly comingSoonCta: string;
    readonly closeSheet: string;
    readonly occupancyRooms: string;
    readonly occupancyAdults: string;
    readonly occupancyChildren: string;
  };
}

function formatDockDates(locale: SupportedLocale, checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${checkIn} – ${checkOut}`;
  }
  const fmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const yearFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    year: 'numeric',
  });
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${fmt.format(start)} – ${fmt.format(end)} ${yearFmt.format(end)}`;
  }
  return `${fmt.format(start)} ${yearFmt.format(start)} – ${fmt.format(end)} ${yearFmt.format(end)}`;
}

function formatOccupancySummary(
  labels: BookingMobileBarClientProps['labels'],
  children: number,
): string {
  const parts = [labels.occupancyRooms, labels.occupancyAdults];
  if (children > 0) {
    parts.push(labels.occupancyChildren);
  }
  return parts.join(' · ');
}

/**
 * Mobile sticky booking dock — compact `resa-card` preview after scroll, full kit
 * widget (calendar + steppers) in a bottom sheet on tap.
 */
export function BookingMobileBarClient({
  locale,
  variant,
  formAction,
  formMethod,
  hotelId,
  fake = false,
  defaultStay,
  today,
  priceFrom,
  labels,
}: BookingMobileBarClientProps): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [checkIn, setCheckIn] = useState(defaultStay.checkIn);
  const [checkOut, setCheckOut] = useState(defaultStay.checkOut);

  const onStayDatesChange = useCallback((nextCheckIn: string, nextCheckOut: string) => {
    setCheckIn(nextCheckIn);
    setCheckOut(nextCheckOut);
  }, []);

  const dockDates = useMemo(
    () => formatDockDates(locale, checkIn, checkOut),
    [locale, checkIn, checkOut],
  );

  const dockOccupancy = useMemo(
    () => formatOccupancySummary(labels, defaultStay.childAges.length),
    [labels, defaultStay.childAges.length],
  );

  const editorialPrice =
    priceFrom !== null && priceFrom !== undefined && priceFrom !== '' ? priceFrom : null;
  const showDockPrice = variant !== 'coming_soon' && editorialPrice !== null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount guard for SSR hydration
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return undefined;

    const anchor = document.querySelector('[data-booking-mobile-reveal-anchor]');
    if (!anchor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fallback reveal when the scroll anchor is absent
      setRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (!entry.isIntersecting) {
          setRevealed(true);
        }
      },
      { root: null, threshold: 0, rootMargin: '0px' },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

  useEffect(() => {
    document.body.classList.toggle('booking-mobile-sheet-open', expanded);
    return () => document.body.classList.remove('booking-mobile-sheet-open');
  }, [expanded]);

  useEffect(() => {
    document.body.classList.toggle('has-mobile-booking-bar', mounted && revealed);
    return () => document.body.classList.remove('has-mobile-booking-bar');
  }, [mounted, revealed]);

  const openSheet = useCallback(() => {
    setExpanded(true);
  }, []);

  const closeSheet = useCallback(() => {
    setExpanded(false);
  }, []);

  const widgetLabels = {
    ...labels,
    submitChooseRooms: labels.ctaChooseRooms,
    comingSoonCta: labels.comingSoonCta,
  };

  if (!mounted) return null;

  const dock = (
    <div
      className="resa-mobile-bar-wrap mch-kit"
      data-booking-widget="mobile_bar"
      data-revealed={revealed ? 'true' : 'false'}
      data-expanded={expanded ? 'true' : 'false'}
      data-testid="booking-mobile-bar"
    >
      <div className="resa-mobile-widget">
        <div className="resa-card resa-mobile-widget__dock-card">
          <button
            type="button"
            className="resa-mobile-widget__dock"
            onClick={openSheet}
            aria-expanded={expanded}
            aria-label={labels.editStay}
            data-testid="booking-mobile-bar-summary"
          >
            {showDockPrice ? (
              <div className="resa-mobile-widget__price">
                <span className="rp-from">{labels.priceFromLabel}</span>
                <span className="rp-amount">{editorialPrice}</span>
              </div>
            ) : null}
            <div className="resa-mobile-widget__meta">
              <span className="resa-mobile-widget__dates">{dockDates}</span>
              <span className="resa-mobile-widget__guests">{dockOccupancy}</span>
            </div>
            <span className="resa-mobile-widget__chevron" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-or resa-mobile-widget__dock-cta"
            onClick={openSheet}
            disabled={variant === 'coming_soon'}
            data-testid="booking-mobile-bar-cta"
          >
            {variant === 'coming_soon' ? labels.comingSoonCta : labels.ctaChooseRooms}
          </button>
        </div>

        {expanded ? (
          <>
            <button
              type="button"
              className="resa-mobile-widget__backdrop"
              aria-label={labels.closeSheet}
              onClick={closeSheet}
            />
            <div
              className="resa-mobile-widget__sheet"
              role="dialog"
              aria-modal="true"
              aria-label={labels.ctaChooseRooms}
              data-testid="booking-mobile-bar-sheet"
            >
              <div className="resa-mobile-widget__sheet-head">
                <p className="resa-mobile-widget__sheet-title">{labels.ctaChooseRooms}</p>
                <button
                  type="button"
                  className="resa-mobile-widget__sheet-close"
                  onClick={closeSheet}
                  aria-label={labels.closeSheet}
                >
                  ×
                </button>
              </div>
              <BookingKitWidgetCard
                locale={locale}
                variant={variant}
                formAction={formAction}
                formMethod={formMethod}
                {...(hotelId !== undefined ? { hotelId } : {})}
                fake={fake}
                checkIn={checkIn}
                checkOut={checkOut}
                today={today}
                onStayDatesChange={onStayDatesChange}
                defaultStay={{
                  rooms: defaultStay.rooms,
                  adults: defaultStay.adults,
                  childAges: defaultStay.childAges,
                }}
                priceFrom={priceFrom}
                labels={widgetLabels}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}
