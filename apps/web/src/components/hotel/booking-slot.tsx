import type { SupportedLocale } from '@/i18n/supported-locale';

import { BookingComingSoon } from './booking-coming-soon';

/**
 * Surfaces where a booking affordance can render on the hotel fiche:
 *  - `rail`     — the sticky right rail on desktop (prime conversion slot).
 *  - `mobilebar` — the fixed bottom bar on mobile.
 */
export type BookingSurface = 'rail' | 'mobilebar';

interface BookingSlotProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly surface: BookingSurface;
}

/**
 * Single seam between the editorial site (Phase 1) and the booking funnel
 * (Phase 6 — ADR-0024). The fiche always renders `<BookingSlot>` in two
 * positions (rail + mobilebar); only this component decides what fills
 * them.
 *
 * Phase 1 (current): the rail shows a passive `<BookingComingSoon>`
 * placeholder; the mobile bar renders nothing (no live CTA to surface
 * yet — a permanent "bientôt disponible" sticky bar would be UX clutter
 * and borderline dark-pattern).
 *
 * Phase 6 (booking APIs wired): swap the `rail` branch for the live
 * `<BookingWidget>` and the `mobilebar` branch for `<BookingWidgetMobileBar>`.
 * The page layout, anchors (`#booking`) and table-of-contents entry stay
 * untouched — the funnel re-lands in the exact same slot.
 */
export function BookingSlot({
  locale,
  hotelName,
  surface,
}: BookingSlotProps): React.ReactElement | null {
  if (surface === 'mobilebar') {
    // Reserved for the Phase 6 fixed bottom bar. Inert until then.
    return null;
  }

  return <BookingComingSoon locale={locale} hotelName={hotelName} />;
}
