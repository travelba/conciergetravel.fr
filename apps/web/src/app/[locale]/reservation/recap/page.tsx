import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect as nextRedirect } from 'next/navigation';

import { beginPayment, moveToRecap } from '@mch/domain/booking';

import { redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import { getDraftId } from '@/server/booking/draft-cookie';
import { loadDraft, saveDraft } from '@/server/booking/draft-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'reservationRecap.meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

function redirectToPayment(locale: Locale): never {
  redirect({ href: '/reservation/payment', locale });
}

/**
 * Mirror of `invite/page.tsx#redirectExpired` — the expired-draft path
 * sends the user back to the localised search page with the expired
 * flag set so the UI can show the dedicated banner.
 */
function redirectExpired(locale: Locale): never {
  redirect({
    href: { pathname: '/recherche', query: { expired: '1' } },
    locale,
  });
}

const fmtPrice = (locale: Locale, amountMinor: number): string =>
  new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);

async function continueToPaymentAction(): Promise<void> {
  'use server';

  const draftId = await getDraftId();
  if (draftId === undefined) {
    nextRedirect('/');
  }

  const persisted = await loadDraft(draftId);
  if (persisted === null) {
    redirectExpired('fr');
  }

  let draft = persisted.draft;
  // Garde sandbox (Étape A) : une offre Travelport ne passe jamais au paiement,
  // même via un POST forgé. On renvoie au recap (lecture seule).
  if (draft.offer?.provider === 'travelport') {
    redirect({ href: '/reservation/recap', locale: persisted.locale });
  }
  if (draft.state === 'guest_collected') {
    const r = moveToRecap(draft);
    if (!r.ok) {
      redirectExpired(persisted.locale);
    }
    draft = r.value;
  }
  if (draft.state !== 'recap') {
    redirectExpired(persisted.locale);
  }

  const beg = beginPayment(draft);
  if (!beg.ok) {
    redirectExpired(persisted.locale);
  }

  await saveDraft({
    draft: beg.value,
    hotel: persisted.hotel,
    locale: persisted.locale,
  });

  redirectToPayment(persisted.locale);
}

export default async function ReservationRecapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations('reservationRecap');

  const draftId = await getDraftId();
  if (draftId === undefined) {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('expired.title')}</h1>
        <p className="text-muted mt-3 max-w-prose">{t('expired.description')}</p>
      </main>
    );
  }

  const persisted = await loadDraft(draftId);
  if (
    persisted === null ||
    !['guest_collected', 'recap'].includes(persisted.draft.state) ||
    persisted.draft.offer === undefined ||
    persisted.draft.guest === undefined
  ) {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('expired.title')}</h1>
        <p className="text-muted mt-3 max-w-prose">{t('expired.description')}</p>
      </main>
    );
  }

  const { offer, guest } = persisted.draft;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg mt-2 font-serif text-3xl sm:text-4xl">{t('title')}</h1>
      </header>

      <section className="border-border bg-bg mb-6 rounded-lg border p-4 sm:p-5">
        <h2 className="text-fg font-serif text-lg">{persisted.hotel.name}</h2>
        <p className="text-muted mt-1 text-sm">
          {persisted.hotel.city} · {persisted.hotel.region}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide">{t('summary.stay')}</dt>
            <dd className="text-fg text-sm">
              {offer.stay.checkIn} → {offer.stay.checkOut}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide">{t('summary.guests')}</dt>
            <dd className="text-fg text-sm">
              {t('summary.guestsValue', {
                adults: offer.guests.adults,
                children: offer.guests.children,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide">{t('summary.lead')}</dt>
            <dd className="text-fg text-sm">
              {guest.firstName} {guest.lastName}
              <br />
              <span className="text-muted">{guest.email}</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wide">{t('summary.total')}</dt>
            <dd className="text-fg font-serif text-2xl">
              {fmtPrice(locale, offer.totalPrice.amountMinor)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-border bg-bg mb-8 rounded-lg border p-4 sm:p-5">
        <h2 className="text-fg font-serif text-lg">{t('cancellation.title')}</h2>
        <p className="text-fg mt-2 whitespace-pre-line text-sm">{offer.cancellationPolicyText}</p>
        <p className="text-muted mt-2 text-xs">{t('cancellation.verbatimNote')}</p>
      </section>

      {offer.provider === 'travelport' ? (
        <section
          className="border-border bg-bg rounded-lg border border-dashed p-4 sm:p-5"
          aria-label={locale === 'en' ? 'Travelport sandbox notice' : 'Note sandbox Travelport'}
        >
          <p className="text-fg text-sm font-medium">
            {locale === 'en'
              ? 'Travelport sandbox — booking disabled at this step'
              : 'Sandbox Travelport — réservation désactivée à cette étape'}
          </p>
          <p className="text-muted mt-2 text-xs">
            {locale === 'en'
              ? 'This recap shows a live preprod offer (price + cancellation policy). Payment and reservation are intentionally not wired in this iteration.'
              : 'Ce récapitulatif affiche une offre preprod réelle (prix + conditions d’annulation). Le paiement et la réservation ne sont volontairement pas câblés dans cette itération.'}
          </p>
        </section>
      ) : (
        <form action={continueToPaymentAction}>
          <button
            type="submit"
            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          >
            {t('continueToPayment')}
          </button>
          <p className="text-muted mt-3 text-xs">{t('paymentDisclaimer')}</p>
        </form>
      )}
    </main>
  );
}
