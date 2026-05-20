'use client';

import { useEffect } from 'react';

import { trackEvent, type BookingMode } from '@/lib/analytics';

interface BookingWidgetSubmitTrackerProps {
  readonly hotelId: string;
  readonly bookingMode: BookingMode;
  readonly surface: 'sticky_widget' | 'inline_section' | 'mobile_bar' | 'room_widget';
}

/**
 * Tiny client island — wires the BookingWidget's native form submit
 * to the analytics funnel without forcing the whole widget into a
 * client component.
 *
 * Pattern: find the sibling form (closest `<section data-booking-widget>`
 * descendant `[data-testid="booking-widget-form"]`) and intercept its
 * submit event. We do **not** preventDefault — the native POST/GET still
 * fires; analytics is fire-and-forget.
 */
export function BookingWidgetSubmitTracker({
  hotelId,
  bookingMode,
  surface,
}: BookingWidgetSubmitTrackerProps): null {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Locate the parent `<section data-booking-widget>` via the tracker's
    // closest ancestor. We can't rely on a portal since this island
    // renders inline next to the form.
    const root = document.querySelector(`[data-booking-widget="${surface}"]`);
    const form = root?.querySelector<HTMLFormElement>('[data-testid="booking-widget-form"]');
    if (form === null || form === undefined) return;

    const handler = (event: SubmitEvent): void => {
      const fd = new FormData(event.currentTarget as HTMLFormElement);
      const checkIn = typeof fd.get('checkIn') === 'string' ? String(fd.get('checkIn')) : '';
      const checkOut = typeof fd.get('checkOut') === 'string' ? String(fd.get('checkOut')) : '';
      const adultsRaw = fd.get('adults');
      const childrenRaw = fd.get('children');
      const adults =
        typeof adultsRaw === 'string' ? Math.max(1, Number.parseInt(adultsRaw, 10) || 2) : 2;
      const children =
        typeof childrenRaw === 'string' ? Math.max(0, Number.parseInt(childrenRaw, 10) || 0) : 0;
      const analyticsSurface =
        surface === 'mobile_bar'
          ? 'mobile_bar'
          : surface === 'sticky_widget'
            ? 'sticky_widget'
            : surface === 'room_widget'
              ? 'room_widget'
              : 'inline_section';
      trackEvent({
        name: 'start_booking',
        hotelId,
        bookingMode,
        checkIn,
        checkOut,
        adults,
        children,
        surface: analyticsSurface,
      });
    };

    form.addEventListener('submit', handler);
    return () => form.removeEventListener('submit', handler);
  }, [hotelId, bookingMode, surface]);

  return null;
}
