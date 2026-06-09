import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale, type SupportedLocale } from '@/i18n/supported-locale';
import {
  formatIndicativePriceParts,
  type IndicativePriceMinor,
} from '@/lib/format-indicative-price';

import { BookingWidgetSubmitTracker } from './booking-widget-tracker';

export type BookingMode = 'amadeus' | 'little' | 'travelport' | 'email' | 'display_only';

/**
 * Live "starting at" price emitted by the server-side best-offer fetch
 * (A4). Source is recorded for analytics differentiation between live
 * Amadeus offers, editorial indicative prices, and the on-request
 * fallback.
 */
export interface BookingWidgetPriceFrom {
  readonly amount: IndicativePriceMinor;
  readonly source: 'amadeus_live' | 'editorial_indicative' | 'on_request';
}

/**
 * DSA-safe limited availability marker — only ever populated when the
 * source is a real Amadeus `availability: 'LimitedAvailability'`
 * payload with a verifiable `remainingCount` (C3 / `seo-geo.mdc`).
 *
 * The reading helper (`server/booking/best-offer.ts`) is the single
 * source of truth for whether this prop is set; the widget renders
 * the chip verbatim and never fabricates urgency.
 */
export interface BookingWidgetLimitedAvailability {
  readonly remainingCount: number;
}

interface BookingWidgetProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly bookingMode: BookingMode;
  readonly defaultStay: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
    readonly children: number;
  };
  /** Pre-computed lock action URL (paid tunnel) or `null` for concierge modes. */
  readonly lockActionUrl: string | null;
  readonly fakeEnabled: boolean;
  readonly priceFrom: BookingWidgetPriceFrom | null;
  readonly limitedAvailability: BookingWidgetLimitedAvailability | null;
  /**
   * DSA-safe availability verdict from Amadeus ARI (C3).
   * Drives the optional "complet pour ces dates" chip. Never
   * fabricated — see `deriveLimitedAvailability` JSDoc in
   * `server/hotels/get-best-offer.ts`.
   */
  readonly availabilityState?: 'available' | 'sold_out' | 'unknown';
  /**
   * Which surface this widget is rendered into. Drives the analytics
   * payload (`start_booking.surface`) and a couple of visual tweaks
   * (e.g. the sticky variant omits the duplicate intro paragraph).
   */
  readonly surface: 'sticky_widget' | 'inline_section' | 'room_widget';
  /**
   * Room-level pre-fill — surfaces a hidden `roomTypeCode` form field
   * so the search-results page (or the concierge request page) can
   * deep-link the user to the right inventory. Used by the room
   * sub-page widget (B5) to keep the room context across the funnel.
   */
  readonly roomTypeCode?: string;
}

/**
 * Reusable booking widget — CDC §2 bloc 8 + ADR-0013 §Decision Layer.
 *
 * Replaces the previously-inlined `#booking` section in
 * `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` with a single
 * Server Component the page composes once for the inline surface and
 * (future) sticky right column.
 *
 * Variants
 * --------
 *  - `amadeus` / `little` → native POST form to `lockActionUrl`
 *    (offer lock → /reservation/invite). The form keeps full server-
 *    side semantics (no-JS fallback) and a tiny client island fires
 *    the `submit_lock` analytics event on submit.
 *  - `email` / `display_only` → GET form to `/reservation/start` so the
 *    user lands on the concierge request page with dates pre-filled.
 *    Copy revalorised (A6) to "Réserver via votre concierge personnel"
 *    instead of "Demander un devis".
 *
 * Trust signals (A5)
 * ------------------
 * Inline chips: IATA accreditation, secure payment (Amadeus 3DS2),
 * cancellation hint. The full reassurance block remains at the bottom
 * of the fiche — these chips are the ATF distillation.
 *
 * No client state in the wrapper itself: the form posts natively,
 * the analytics island is a small `'use client'` shell.
 *
 * Skill: booking-engine, security-engineering (server-action CSRF
 * inherited from native POST + Next.js).
 */
export async function BookingWidget({
  locale,
  hotelId,
  hotelName,
  bookingMode,
  defaultStay,
  lockActionUrl,
  fakeEnabled,
  priceFrom,
  limitedAvailability,
  availabilityState,
  surface,
  roomTypeCode,
}: BookingWidgetProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget' });

  const isPaidTunnel = bookingMode === 'amadeus' || bookingMode === 'little';
  const conciergeAction = getPathname({ locale, href: '/reservation/start' });

  const sectionId = surface === 'inline_section' ? 'booking' : undefined;
  const titleId = `booking-title-${surface}`;
  const intro = isPaidTunnel ? t('booking.intro') : tw('conciergeExplainer', { name: hotelName });

  return (
    <section
      {...(sectionId !== undefined ? { id: sectionId } : {})}
      aria-labelledby={titleId}
      className="border-border bg-bg mb-12 rounded-lg border p-5 sm:p-6"
      data-booking-widget={surface}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-fg font-serif text-xl sm:text-2xl">
          {isPaidTunnel ? t('sections.booking') : tw('conciergeTitle')}
        </h2>
        {priceFrom !== null ? <PriceFromBadge price={priceFrom} locale={locale} /> : null}
      </header>

      {surface !== 'sticky_widget' && intro !== '' ? (
        <p className="text-muted mb-4 text-sm">{intro}</p>
      ) : null}

      {limitedAvailability !== null ? (
        <p
          className="border-gold-300 bg-gold-50 text-gold-900 mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium"
          role="status"
          data-limited-availability
        >
          <span aria-hidden>●</span>
          {tw('limitedAvailability', { count: limitedAvailability.remainingCount })}
        </p>
      ) : availabilityState === 'sold_out' ? (
        // C3 — DSA-safe: only rendered when Amadeus explicitly returned
        // `bucket.available === false`. We display vendor-grounded fact,
        // not a manufactured scarcity signal.
        <p
          className="mb-4 inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-900"
          role="status"
          data-availability="sold_out"
        >
          <span aria-hidden>●</span>
          {tw('soldOutForDates')}
        </p>
      ) : null}

      <BookingWidgetForm
        bookingMode={bookingMode}
        hotelId={hotelId}
        roomTypeCode={roomTypeCode ?? null}
        defaultStay={defaultStay}
        formAction={isPaidTunnel && lockActionUrl !== null ? lockActionUrl : conciergeAction}
        method={isPaidTunnel ? 'post' : 'get'}
        fakeEnabled={fakeEnabled}
        labels={{
          checkIn: t('booking.checkIn'),
          checkOut: t('booking.checkOut'),
          adults: t('booking.adults'),
          children: t('booking.children'),
          submit: isPaidTunnel
            ? fakeEnabled
              ? t('booking.submitTest')
              : t('booking.submit')
            : tw('conciergeSubmit'),
          submitHint: fakeEnabled && isPaidTunnel ? t('booking.submitTestHint') : null,
        }}
      />

      <TrustChips locale={locale} />

      <BookingWidgetSubmitTracker hotelId={hotelId} bookingMode={bookingMode} surface={surface} />
    </section>
  );
}

function PriceFromBadge({
  price,
  locale,
}: {
  readonly price: BookingWidgetPriceFrom;
  readonly locale: SupportedLocale;
}): ReactElement {
  // `formatIndicativePriceParts` accepts the routing Locale (V1 = fr/en).
  // V2 locales (de/es/it) fall back to the FR formatter — currency symbol
  // positioning differs but Intl.NumberFormat handles fr-FR cleanly across
  // V2 markets until the V2 routing migration adds them to `routing.locales`.
  const fmtLocale: Locale = pickByLocale(locale, 'fr', 'en');
  const parts = formatIndicativePriceParts(price.amount, fmtLocale);
  return (
    <p
      className="text-fg inline-flex items-baseline gap-1 text-sm"
      data-price-from
      data-price-source={price.source}
    >
      <span className="text-muted text-xs">from</span>
      <span className="font-serif text-lg">{parts.from}</span>
      <span className="text-muted text-xs">/ night</span>
    </p>
  );
}

interface BookingFormProps {
  readonly bookingMode: BookingMode;
  readonly hotelId: string;
  readonly roomTypeCode: string | null;
  readonly defaultStay: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
    readonly children: number;
  };
  readonly formAction: string;
  readonly method: 'get' | 'post';
  readonly fakeEnabled: boolean;
  readonly labels: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: string;
    readonly children: string;
    readonly submit: string;
    readonly submitHint: string | null;
  };
}

function BookingWidgetForm({
  bookingMode,
  hotelId,
  roomTypeCode,
  defaultStay,
  formAction,
  method,
  fakeEnabled,
  labels,
}: BookingFormProps): ReactElement {
  const isPaidTunnel = bookingMode === 'amadeus' || bookingMode === 'little';
  return (
    <form
      method={method}
      action={formAction}
      className="mt-2 flex flex-col gap-4"
      data-testid="booking-widget-form"
    >
      <input type="hidden" name="hotelId" value={hotelId} />
      {roomTypeCode !== null && roomTypeCode.length > 0 ? (
        <input type="hidden" name="roomTypeCode" value={roomTypeCode} />
      ) : null}
      {isPaidTunnel && fakeEnabled ? <input type="hidden" name="fake" value="1" /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{labels.checkIn}</span>
          <input
            type="date"
            name="checkIn"
            defaultValue={defaultStay.checkIn}
            required
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{labels.checkOut}</span>
          <input
            type="date"
            name="checkOut"
            defaultValue={defaultStay.checkOut}
            required
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{labels.adults}</span>
          <input
            type="number"
            name="adults"
            min={1}
            max={9}
            defaultValue={defaultStay.adults}
            required
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{labels.children}</span>
          <input
            type="number"
            name="children"
            min={0}
            max={9}
            defaultValue={defaultStay.children}
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={
            fakeEnabled && isPaidTunnel
              ? 'border-gold-300 bg-gold-50 text-gold-900 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2'
              : 'bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2'
          }
        >
          {labels.submit}
        </button>
        {labels.submitHint !== null ? (
          <span className="text-muted text-xs">{labels.submitHint}</span>
        ) : null}
      </div>
    </form>
  );
}

async function TrustChips({ locale }: { readonly locale: SupportedLocale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage.widget.trust' });
  return (
    <ul
      className="text-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs"
      aria-label={t('listAria')}
    >
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden>✓</span>
        {t('bestRate')}
      </li>
      <li aria-hidden>·</li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden>✓</span>
        {t('freeCancellation')}
      </li>
    </ul>
  );
}
