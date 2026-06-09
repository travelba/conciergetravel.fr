import type { BookingMode } from '@mch/domain/hotels';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { isTravelportSandboxEnabled } from '@/lib/travelport';

import { BookingComingSoon } from './booking-coming-soon';
import { BookingMobileBar } from './booking-mobile-bar';
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
   * When true, the rail renders as a bare `.resa-card` without the outer
   * `<section id="booking">` wrapper — used inside the kit `.htl-aside`.
   */
  readonly embeddedInKitAside?: boolean;
  /**
   * Slug de la fiche — requis pour router l'hôtel pilote Travelport vers le
   * formulaire live (`<BookingSandboxRail>`).
   */
  readonly slug?: string;
  /**
   * `booking_mode` de l'hôtel : seul `'travelport'` (avec le kill-switch env)
   * bascule sur le formulaire live. Toute autre valeur ⇒ placeholder éditorial.
   */
  readonly bookingMode?: BookingMode;
  /**
   * Prix indicatif « à partir de » (déjà formaté locale, ex. « 690 € »).
   * Affiché par le placeholder éditorial (`<BookingComingSoon>`) pour ancrer
   * le widget kit. Ignoré par le rail live Travelport (qui a son propre prix).
   */
  readonly priceFrom?: string | null;
}

/**
 * Single seam between the editorial site (Phase 1) and the booking funnel
 * (Phase 6 — ADR-0025). The fiche always renders `<BookingSlot>` in two
 * positions (rail + mobilebar); only this component decides what fills
 * them.
 *
 * Phase 1 (current): the rail shows a passive `<BookingComingSoon>`
 * placeholder; the mobile bar shows a compact sticky footer (dates +
 * price hint + CTA) that expands into the same placeholder sheet.
 *
 * Phase 6 (booking APIs wired): the `rail` branch already swaps to the live
 * Travelport funnel (`<BookingSandboxRail>`) for allow-listed pilot hotels;
 * the `mobilebar` branch mirrors it in the fixed bottom bar. The page layout,
 * anchors (`#booking`) and table-of-contents entry stay untouched — the funnel
 * re-lands in the exact same slot.
 */
export function BookingSlot({
  locale,
  hotelName,
  surface,
  slug,
  bookingMode,
  priceFrom = null,
  embeddedInKitAside = false,
}: BookingSlotProps): React.ReactElement | null {
  if (surface === 'mobilebar') {
    return (
      <BookingMobileBar
        locale={locale}
        hotelName={hotelName}
        priceFrom={priceFrom}
        {...(slug !== undefined ? { slug } : {})}
        {...(bookingMode !== undefined ? { bookingMode } : {})}
      />
    );
  }

  // Pilote Travelport (Phase 6) : seul l'hôtel en `booking_mode = 'travelport'`,
  // sandbox activé (kill-switch env) et locale V1 (fr/en) bascule sur le
  // formulaire live ; tout le reste conserve le placeholder éditorial.
  const rail =
    slug !== undefined &&
    bookingMode === 'travelport' &&
    (locale === 'fr' || locale === 'en') &&
    isTravelportSandboxEnabled() ? (
      <BookingSandboxRail locale={locale} hotelName={hotelName} slug={slug} />
    ) : (
      <BookingComingSoon
        locale={locale}
        hotelName={hotelName}
        priceFrom={priceFrom}
        embeddedInKitAside={embeddedInKitAside}
      />
    );

  return <div data-booking-rail>{rail}</div>;
}
