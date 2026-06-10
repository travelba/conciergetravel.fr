'use client';

import { useEffect } from 'react';

import { STAY_URL_SYNC_EVENT } from '@/lib/booking/push-stay-to-url';

/**
 * Keeps stay query params in the URL in sync with the fiche booking form so
 * `<PriceComparator>` can fetch competitor rates without opting the route out
 * of ISR.
 */
export function BookingStayUrlSync(): null {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(
      '[data-booking-widget="rail"] [data-testid="booking-widget-form"], [data-booking-widget="kit_rail"] [data-testid="booking-widget-form"], aside#resa [data-testid="booking-widget-form"]',
    );
    if (form === null) return;

    const sync = (): void => {
      const params = new URLSearchParams(window.location.search);
      const fields = ['checkIn', 'checkOut', 'rooms', 'adults', 'children', 'childAges'] as const;
      let changed = false;
      for (const name of fields) {
        const value = form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value;
        if (value !== undefined && value.length > 0) {
          if (params.get(name) !== value) {
            params.set(name, value);
            changed = true;
          }
        } else if (params.has(name)) {
          params.delete(name);
          changed = true;
        }
      }

      const next = `${window.location.pathname}?${params.toString()}`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (next !== current) {
        window.history.replaceState(null, '', next);
      }
      if (changed || params.get('checkIn') !== null) {
        window.dispatchEvent(new Event(STAY_URL_SYNC_EVENT));
      }
    };

    form.addEventListener('change', sync);
    form.addEventListener('input', sync);
    sync();
    return () => {
      form.removeEventListener('change', sync);
      form.removeEventListener('input', sync);
    };
  }, []);

  return null;
}
