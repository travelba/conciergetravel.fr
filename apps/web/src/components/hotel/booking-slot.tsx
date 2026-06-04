import type { SupportedLocale } from '@/i18n/supported-locale';
import { isTravelportSampleSlug, isTravelportSandboxEnabled } from '@/lib/travelport';

import { BookingComingSoon } from './booking-coming-soon';
import { BookingSandboxRail } from './booking-sandbox-rail';

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
  /**
   * Slug de la fiche — requis pour router l'hôtel pilote Travelport vers le
   * formulaire live (`<BookingSandboxRail>`). Absent / non allow-listé ⇒
   * placeholder `<BookingComingSoon>` inchangé.
   */
  readonly slug?: string;
}

/**
 * Single seam between the editorial site (Phase 1) and the booking funnel
 * (Phase 6 — ADR-0025). The fiche always renders `<BookingSlot>` in two
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
  slug,
}: BookingSlotProps): React.ReactElement | null {
  if (surface === 'mobilebar') {
    // Reserved for the Phase 6 fixed bottom bar. Inert until then.
    return null;
  }

  // Pilote Travelport (Phase 6) : seul l'hôtel allow-listé, sandbox activé et
  // locale V1 (fr/en) bascule sur le formulaire live ; tout le reste conserve
  // le placeholder éditorial.
  if (
    slug !== undefined &&
    (locale === 'fr' || locale === 'en') &&
    isTravelportSandboxEnabled() &&
    isTravelportSampleSlug(slug)
  ) {
    return <BookingSandboxRail locale={locale} hotelName={hotelName} slug={slug} />;
  }

  return <BookingComingSoon locale={locale} hotelName={hotelName} />;
}
