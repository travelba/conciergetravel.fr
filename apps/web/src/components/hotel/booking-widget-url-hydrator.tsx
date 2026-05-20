'use client';

import { useEffect } from 'react';

/**
 * Booking widget URL hydrator (C1 / ADR-0013).
 *
 * Tiny client island that reads `?checkIn=...&checkOut=...&adults=...`
 * from the URL and hydrates the matching `<input>` fields of the
 * `<BookingWidget>` form when the user lands from a deep-link
 * (`/recherche?hotelId=X&checkIn=...` → fiche hôtel).
 *
 * Rationale
 * ---------
 * The page itself runs in ISR (`revalidate = 3600`), so the server
 * renders the booking form with a default stay window (today + 30
 * days) — every visitor gets the same cached HTML. This island
 * re-hydrates the dates from the URL on the client side so deep-links
 * from search results, e-mails, and external referrers still land
 * with the right dates pre-filled.
 *
 * Why a `useEffect` hydrator (vs `useSearchParams` in the widget)
 * ---------------------------------------------------------------
 * Keeping the parent `<BookingWidget>` as a Server Component is the
 * whole point of the ISR migration. Wrapping the widget in
 * `'use client'` would re-introduce a client-only render of every
 * label, trust chip, and translation lookup — exactly what we tried
 * to avoid. The hydrator is the smallest possible surface that gets
 * us URL-driven dates without de-server-componenting the widget.
 *
 * Idempotent: runs once per mount, never re-fires on re-render.
 *
 * Skill: nextjs-app-router, responsive-ui-architecture.
 */
export function BookingWidgetUrlHydrator(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const form = document.querySelector<HTMLFormElement>('form[data-testid="booking-widget-form"]');
    if (form === null) return;

    const hydrate = (name: string, validate?: (raw: string) => boolean): void => {
      const value = params.get(name);
      if (value === null || value.length === 0) return;
      if (validate !== undefined && !validate(value)) return;
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input === null) return;
      input.value = value;
    };

    const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/u.test(s);
    const isSmallInt = (s: string): boolean => /^\d{1,2}$/u.test(s);

    hydrate('checkIn', isIsoDate);
    hydrate('checkOut', isIsoDate);
    hydrate('adults', isSmallInt);
    hydrate('children', isSmallInt);
  }, []);

  return null;
}
