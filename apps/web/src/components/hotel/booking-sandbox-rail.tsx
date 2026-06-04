import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';

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
 * l'hôtel allow-listé. Rend un vrai formulaire de réservation (dates + occupants
 * choisis par le client) qui pointe vers la route gated
 * `/[locale]/reservation/sandbox/[slug]` : recherche Travelport temps réel →
 * draft `recap` → confirmation/annulation de la réservation sandbox.
 *
 * Aucun paiement à ce stade (preprod) : le récap confirme/annule directement la
 * réservation sandbox. Reste strictement opt-in (gating dans `<BookingSlot>`) ;
 * les autres fiches conservent le placeholder `<BookingComingSoon>`.
 *
 * Copie inline FR/EN (comme le recap Travelport) pour ne pas dépendre de
 * nouvelles clés i18n sur un parcours encore en pilote.
 */
export function BookingSandboxRail({
  locale,
  hotelName,
  slug,
}: BookingSandboxRailProps): ReactElement {
  const en = locale === 'en';
  const today = addDaysIso(0);
  const checkIn = addDaysIso(30);
  const checkOut = addDaysIso(31);
  const action = getPathname({
    locale,
    href: { pathname: '/reservation/sandbox/[slug]', params: { slug } },
  });

  const labels = {
    eyebrow: en ? 'Real-time availability' : 'Disponibilité en temps réel',
    headline: en ? `Book ${hotelName}` : `Réserver ${hotelName}`,
    intro: en
      ? 'Choose your dates to check live availability and rates.'
      : 'Choisissez vos dates pour voir les disponibilités et tarifs en direct.',
    checkIn: en ? 'Check-in' : 'Arrivée',
    checkOut: en ? 'Check-out' : 'Départ',
    adults: en ? 'Adults' : 'Adultes',
    children: en ? 'Children' : 'Enfants',
    submit: en ? 'Check availability' : 'Voir les disponibilités',
    note: en
      ? 'Preprod pilot — no payment is taken at this stage.'
      : 'Pilote preprod — aucun paiement n’est prélevé à ce stade.',
  };

  const fieldClass =
    'border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2';

  return (
    <section
      id="booking"
      aria-labelledby="booking-sandbox-title"
      data-booking-widget="rail"
      className="border-border bg-bg scroll-mt-24 rounded-lg border p-6"
    >
      <p className="text-accent mb-2 text-xs font-medium uppercase tracking-wider">
        {labels.eyebrow}
      </p>
      <h2 id="booking-sandbox-title" className="text-fg font-serif text-xl leading-tight">
        {labels.headline}
      </h2>
      <p className="text-muted mt-3 text-sm leading-relaxed">{labels.intro}</p>

      <form method="get" action={action} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{labels.checkIn}</span>
            <input
              type="date"
              name="checkIn"
              defaultValue={checkIn}
              min={today}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{labels.checkOut}</span>
            <input
              type="date"
              name="checkOut"
              defaultValue={checkOut}
              min={today}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{labels.adults}</span>
            <input
              type="number"
              name="adults"
              min={1}
              max={9}
              defaultValue={1}
              required
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{labels.children}</span>
            <input
              type="number"
              name="children"
              min={0}
              max={9}
              defaultValue={0}
              className={fieldClass}
            />
          </label>
        </div>

        <button
          type="submit"
          className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
        >
          {labels.submit}
        </button>
      </form>

      <p className="text-muted/80 mt-4 text-xs">{labels.note}</p>
    </section>
  );
}
