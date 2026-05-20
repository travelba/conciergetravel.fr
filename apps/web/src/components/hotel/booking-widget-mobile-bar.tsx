'use client';

import { useEffect, useState } from 'react';

import { trackEvent, type BookingMode } from '@/lib/analytics';

interface BookingWidgetMobileBarProps {
  readonly hotelId: string;
  readonly bookingMode: BookingMode;
  readonly priceFromLabel: string | null;
  readonly ctaLabel: string;
  readonly ctaAriaLabel: string;
  readonly trustLabel: string;
}

/**
 * Mobile-only fixed bottom bar with a "Voir les tarifs" CTA that
 * smooth-scrolls to the `#booking` section.
 *
 * Visibility rules:
 *  - `md:hidden` — only shown on mobile (≤ 768 px), where the inline
 *    `<BookingWidget>` is below the fold.
 *  - **Hidden once the user has scrolled the `#booking` section into
 *    view** so it doesn't double-up with the inline widget. We use
 *    `IntersectionObserver` against `#booking`.
 *
 * No native `<dialog>` to keep the JS bundle minimal — the smooth
 * scroll is enough for the v1 of this feature (drawer can be added
 * if conversion metrics show users want in-bar dates).
 */
export function BookingWidgetMobileBar({
  hotelId,
  bookingMode,
  priceFromLabel,
  ctaLabel,
  ctaAriaLabel,
  trustLabel,
}: BookingWidgetMobileBarProps): React.ReactElement | null {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = document.getElementById('booking');
    if (target === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setHidden(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    const target = document.getElementById('booking');
    if (target === null) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    trackEvent({
      name: 'view_pricing',
      hotelId,
      source: 'comparator',
      priceFromMinor: null,
      currency: 'EUR',
    });
    // Defer focusing the first input until the scroll lands.
    window.setTimeout(() => {
      const firstInput = target.querySelector<HTMLInputElement>('input[name="checkIn"]');
      firstInput?.focus({ preventScroll: true });
    }, 320);
    // Suppress unused-var warning while keeping the prop in scope.
    void bookingMode;
  };

  return (
    <div
      className={`border-border bg-bg/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      data-mobile-bar
      aria-hidden={hidden}
      role="region"
      aria-label={ctaAriaLabel}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {priceFromLabel !== null ? (
            <span className="text-fg font-serif text-base">{priceFromLabel}</span>
          ) : null}
          <span className="text-muted truncate text-xs">{trustLabel}</span>
        </div>
        <a
          href="#booking"
          onClick={onClick}
          className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          aria-label={ctaAriaLabel}
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
