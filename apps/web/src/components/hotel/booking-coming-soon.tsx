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
      className="mch-kit scroll-mt-24"
    >
      <div className="resa-card">
        <p className="rp-from">{t('eyebrow')}</p>
        <h2
          id="booking-coming-soon-title"
          className="mt-1 font-serif text-xl leading-tight text-[color:var(--noir)]"
        >
          {t('headline')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--texte-doux)]">
          {t('body', { name: hotelName })}
        </p>
        <p className="resa-iata mt-4 text-left">{t('note')}</p>
      </div>
    </section>
  );
}
