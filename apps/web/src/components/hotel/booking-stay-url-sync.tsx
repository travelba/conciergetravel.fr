'use client';

import { useEffect } from 'react';

/**
 * Keeps `?checkIn=&checkOut=&adults=&children=` in the URL in sync with the
 * fiche booking form so `<PriceComparator>` can fetch competitor rates without
 * opting the route out of ISR.
 */
export function BookingStayUrlSync(): null {
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(
      '[data-booking-widget="rail"] [data-testid="booking-widget-form"], [data-booking-widget="kit_rail"] [data-testid="booking-widget-form"], aside#resa [data-testid="booking-widget-form"]',
    );
    if (form === null) return;

    const sync = (): void => {
      const params = new URLSearchParams(window.location.search);
      const checkIn = form.querySelector<HTMLInputElement>('input[name="checkIn"]')?.value;
      const checkOut = form.querySelector<HTMLInputElement>('input[name="checkOut"]')?.value;
      const adults = form.querySelector<HTMLInputElement>('input[name="adults"]')?.value;
      const children = form.querySelector<HTMLInputElement>('input[name="children"]')?.value;

      if (checkIn !== undefined && checkIn.length > 0) params.set('checkIn', checkIn);
      if (checkOut !== undefined && checkOut.length > 0) params.set('checkOut', checkOut);
      if (adults !== undefined && adults.length > 0) params.set('adults', adults);
      if (children !== undefined && children.length > 0) params.set('children', children);

      const next = `${window.location.pathname}?${params.toString()}`;
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(null, '', next);
      }
    };

    form.addEventListener('change', sync);
    sync();
    return () => form.removeEventListener('change', sync);
  }, []);

  return null;
}
