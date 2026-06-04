import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { SubmitButton } from '@/components/booking/submit-button';
import { getPathname } from '@/i18n/navigation';

import { BookingSandboxDateFields } from './booking-sandbox-date-fields';

interface BookingSandboxRailProps {
  readonly locale: 'fr' | 'en';
  readonly hotelName: string;
  readonly slug: string;
}

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Pilote Travelport (Phase 6) — variante **live** du seam `<BookingSlot>` pour
 * l'hôtel allow-listé. Rend un vrai formulaire de réservation (dates +
 * occupants) qui pointe vers la page gated
 * `/[locale]/reservation/sandbox/[slug]/chambres` : sélection chambre/tarif →
 * recap → confirmation/annulation de la réservation sandbox.
 *
 * Aucun paiement à ce stade (preprod). Reste strictement opt-in (gating dans
 * `<BookingSlot>`) ; les autres fiches conservent le placeholder
 * `<BookingComingSoon>`.
 */
export async function BookingSandboxRail({
  locale,
  hotelName,
  slug,
}: BookingSandboxRailProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'reservationRooms.rail' });
  const today = addDaysIso(0);
  const checkIn = addDaysIso(30);
  const checkOut = addDaysIso(31);
  const action = getPathname({
    locale,
    href: { pathname: '/reservation/sandbox/[slug]/chambres', params: { slug } },
  });

  return (
    <section
      id="booking"
      aria-labelledby="booking-sandbox-title"
      data-booking-widget="rail"
      className="border-border bg-bg scroll-mt-24 rounded-lg border p-6"
    >
      <p className="text-accent mb-2 text-xs font-medium uppercase tracking-wider">
        {t('eyebrow')}
      </p>
      <h2 id="booking-sandbox-title" className="text-fg font-serif text-xl leading-tight">
        {t('headline', { hotel: hotelName })}
      </h2>
      <p className="text-muted mt-3 text-sm leading-relaxed">{t('intro')}</p>

      <form method="get" action={action} className="mt-4 flex flex-col gap-4">
        <BookingSandboxDateFields
          labels={{ checkIn: t('checkIn'), checkOut: t('checkOut'), adults: t('adults') }}
          defaults={{ checkIn, checkOut, adults: 1 }}
          today={today}
        />
        <SubmitButton
          pendingLabel={t('submitting')}
          className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
        >
          {t('submit')}
        </SubmitButton>
      </form>

      <p className="text-muted/80 mt-4 text-xs">{t('note')}</p>
    </section>
  );
}
