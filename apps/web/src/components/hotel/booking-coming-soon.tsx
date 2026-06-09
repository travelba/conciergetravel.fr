import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';

interface BookingComingSoonProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  /**
   * Indicative "from" price (already locale-formatted, e.g. "690 €"). When
   * present it anchors the widget with the kit `.resa-price` block ("À partir
   * de …"); when null the card falls back to the eyebrow + headline only. This
   * is the editorial indicative price (cheapest room), NOT a bookable rate —
   * the rail stays inert until the funnel lands (Phase 6).
   */
  readonly priceFrom?: string | null;
  /** Kit aside: skip outer `<section>` — parent is already `.htl-aside`. */
  readonly embeddedInKitAside?: boolean;
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
 * Visual parity with the kit (`template-hotel.html` `.resa-card`)
 * ---------------------------------------------------------------
 * The card now mirrors the template reservation widget — indicative price
 * anchor, the three date/guest fields and the trust checklist — but every
 * interactive affordance is rendered in a **disabled** state (no form, no
 * link, no live rate). The date fields are decorative (`aria-hidden`) and
 * the CTA is `disabled`, so the card reads as the future widget without
 * faking a working funnel (anti-dark-pattern — AGENTS.md §4ter). The
 * stable `id="booking"` anchor is preserved so the sticky table of contents
 * and deep-links keep resolving. When the funnel returns,
 * `<BookingSlot surface="rail">` swaps this component for the live widget
 * without touching the page layout.
 */
export async function BookingComingSoon({
  locale,
  hotelName,
  priceFrom = null,
  embeddedInKitAside = false,
}: BookingComingSoonProps): Promise<React.ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const hasPrice = priceFrom !== null && priceFrom !== '';

  const card = (
    <div className="resa-card">
      {hasPrice ? (
        <div className="resa-price">
          <span className="rp-from">{t('widget.priceFromLabel')}</span>
          <span className="rp-amount">{priceFrom}</span>
          <span className="rp-unit">{t('widget.priceFromUnit')}</span>
        </div>
      ) : (
        <p className="rp-from">{t('bookingComingSoon.eyebrow')}</p>
      )}

      {!embeddedInKitAside ? (
        <h2
          id="booking-coming-soon-title"
          className="mt-3 font-serif text-xl leading-tight text-[color:var(--noir)]"
        >
          {t('bookingComingSoon.headline')}
        </h2>
      ) : null}
      {!embeddedInKitAside ? (
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--texte-doux)]">
          {t('bookingComingSoon.body', { name: hotelName })}
        </p>
      ) : null}

      <div className="resa-form" aria-hidden="true">
        <span className="rf-field">
          <span>{t('displayOnly.checkIn')}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
        <span className="rf-field">
          <span>{t('displayOnly.checkOut')}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
        <span className="rf-field">
          <span>{t('displayOnly.adults')}</span>
          <span className="rf-val text-[color:var(--texte-doux)]">—</span>
        </span>
      </div>

      <button
        type="button"
        className="btn btn-or resa-go cursor-not-allowed opacity-60"
        disabled
        aria-disabled="true"
      >
        {t('bookingComingSoon.cta')}
      </button>

      <ul className="resa-trust" aria-label={t('widget.trust.listAria')}>
        <li>
          <CheckIcon />
          {t('widget.trust.bestRate')}
        </li>
        <li>
          <CheckIcon />
          {t('widget.trust.freeCancellation')}
        </li>
      </ul>

      {!embeddedInKitAside ? (
        <p className="resa-iata mt-4 text-center">{t('bookingComingSoon.note')}</p>
      ) : null}
    </div>
  );

  if (embeddedInKitAside) {
    return <div className="mch-kit">{card}</div>;
  }

  return (
    <section
      id="booking"
      aria-labelledby="booking-coming-soon-title"
      data-booking-placeholder
      className="mch-kit scroll-mt-24"
    >
      {card}
    </section>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
