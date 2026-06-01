import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';

interface BookingComingSoonProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
}

/**
 * Passive "booking coming soon" placeholder (Phase 1 — editorial site).
 *
 * The site ships without any reservation funnel until Amadeus / Little
 * are wired in Phase 6 (see ADR-0025 + AGENTS.md §4ter). This component
 * occupies the **prime conversion slot** of the fiche (the sticky right
 * rail on desktop) so the future `<BookingWidget>` lands in the exact
 * same, highest-converting location with zero relayout.
 *
 * Deliberately inert: no CTA, no form, no link — a sober "bientôt
 * disponible" card. The stable `id="booking"` anchor is preserved so the
 * sticky table of contents and deep-links keep resolving. When the funnel
 * returns, `<BookingSlot surface="rail">` swaps this component for the
 * live widget without touching the page layout.
 */
export async function BookingComingSoon({
  locale,
  hotelName,
}: BookingComingSoonProps): Promise<React.ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage.bookingComingSoon' });

  return (
    <section
      id="booking"
      aria-labelledby="booking-coming-soon-title"
      data-booking-placeholder
      className="border-border bg-bg scroll-mt-24 rounded-lg border p-6"
    >
      <p className="text-accent mb-2 text-xs font-medium uppercase tracking-wider">
        {t('eyebrow')}
      </p>
      <h2 id="booking-coming-soon-title" className="text-fg font-serif text-xl leading-tight">
        {t('headline')}
      </h2>
      <p className="text-muted mt-3 text-sm leading-relaxed">{t('body', { name: hotelName })}</p>
      <p className="text-muted/80 mt-4 text-xs">{t('note')}</p>
    </section>
  );
}
