import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect as nextRedirect } from 'next/navigation';

import { beginPayment, moveToRecap } from '@mch/domain/booking';

import { BookingProgress } from '@/components/booking/booking-progress';
import { OfferExpiryNotice } from '@/components/booking/offer-expiry-notice';
import { OrderSummary } from '@/components/booking/order-summary';
import { SubmitButton } from '@/components/booking/submit-button';
import { redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getDraftId } from '@/server/booking/draft-cookie';
import { loadDraft, saveDraft } from '@/server/booking/draft-store';
import {
  cancelTravelportSandboxReservation,
  confirmTravelportSandboxReservation,
} from '@/server/booking/travelport-confirm';
import { loadTravelportReservation } from '@/server/booking/travelport-context';

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

const fullName = (firstName: string, lastName: string): string => `${firstName} ${lastName}`.trim();

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

/**
 * Étape B — confirmation **réelle** d'une réservation Travelport (sandbox
 * preprod) depuis le recap. Gated : ne s'exécute que pour une offre dont le
 * provider est `travelport` ; aucune autre offre n'emprunte ce chemin.
 */
async function confirmTravelportSandboxAction(): Promise<void> {
  'use server';

  const draftId = await getDraftId();
  if (draftId === undefined) {
    nextRedirect('/');
  }
  const persisted = await loadDraft(draftId);
  if (persisted === null) {
    redirectExpired('fr');
  }
  if (persisted.draft.offer?.provider !== 'travelport') {
    redirect({ href: '/reservation/recap', locale: persisted.locale });
  }

  const result = await confirmTravelportSandboxReservation(draftId);
  if (!result.ok) {
    redirect({
      href: { pathname: '/reservation/recap', query: { error: result.reason } },
      locale: persisted.locale,
    });
  }
  // Parcours OTA : on emmène le client sur la page de confirmation dédiée dès
  // que la résa est persistée (booking_ref). Le cookie draft est conservé : un
  // retour sur le recap reste possible pour annuler la réservation sandbox.
  const ref = result.reservation.bookingRef;
  if (ref !== undefined) {
    redirect({
      href: { pathname: '/reservation/confirmation/[ref]', params: { ref } },
      locale: persisted.locale,
    });
  }
  redirect({ href: '/reservation/recap', locale: persisted.locale });
}

/** Étape B — annulation de la réservation sandbox depuis le recap. */
async function cancelTravelportSandboxAction(): Promise<void> {
  'use server';

  const draftId = await getDraftId();
  if (draftId === undefined) {
    nextRedirect('/');
  }
  const persisted = await loadDraft(draftId);
  if (persisted === null) {
    redirectExpired('fr');
  }
  await cancelTravelportSandboxReservation(draftId);
  redirect({ href: '/reservation/recap', locale: persisted.locale });
}

export default async function ReservationRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations('reservationRecap');
  const sandboxError = typeof sp.error === 'string' && sp.error.length > 0 ? sp.error : undefined;

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
  const tpReservation =
    offer.provider === 'travelport' ? await loadTravelportReservation(draftId) : null;
  const progressStep =
    tpReservation !== null && tpReservation.phase === 'confirmed' ? 'confirmation' : 'recap';

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <BookingProgress locale={locale} current={progressStep} />
      <header className="mb-8">
        <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg mt-2 font-serif text-3xl sm:text-4xl">{t('title')}</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="border-border bg-bg shadow-card rounded-2xl border p-5 sm:p-6">
            <h2 className="text-fg font-serif text-lg">{t('cancellation.title')}</h2>
            <p className="text-fg mt-2 whitespace-pre-line text-sm leading-relaxed">
              {offer.cancellationPolicyText}
            </p>
            <p className="text-muted mt-3 text-xs">{t('cancellation.verbatimNote')}</p>
          </section>

          {offer.provider === 'travelport' ? (
            tpReservation !== null ? (
              <section
                className="border-border bg-bg rounded-lg border p-4 sm:p-5"
                aria-label={t('sandbox.label')}
              >
                <p className="text-fg text-sm font-medium">
                  {tpReservation.phase === 'cancelled'
                    ? t('sandbox.cancelledTitle')
                    : t('sandbox.confirmedTitle')}
                </p>
                {tpReservation.phase !== 'cancelled' ? (
                  <p className="text-muted mt-1 text-sm">{t('sandbox.confirmedSummary')}</p>
                ) : null}

                <dl className="mt-3 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                  {tpReservation.bookingRef !== undefined ? (
                    <div>
                      <dt className="text-muted text-xs uppercase tracking-wide">
                        {t('sandbox.bookingRef')}
                      </dt>
                      <dd className="text-fg font-mono text-sm">{tpReservation.bookingRef}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted text-xs uppercase tracking-wide">
                      {t('sandbox.status')}
                    </dt>
                    <dd className="text-fg text-sm">{tpReservation.status}</dd>
                  </div>
                  {tpReservation.supplierConfirmation !== undefined ? (
                    <div>
                      <dt className="text-muted text-xs uppercase tracking-wide">
                        {t('sandbox.hotelConfirmation')}
                      </dt>
                      <dd className="text-fg font-mono text-sm">
                        {tpReservation.supplierConfirmation}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {tpReservation.aggregatorLocator !== undefined ||
                tpReservation.agencyLocator !== undefined ? (
                  <details className="mt-4">
                    <summary className="text-muted cursor-pointer text-xs uppercase tracking-wide">
                      {t('sandbox.technicalDetails')}
                    </summary>
                    <dl className="mt-3 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                      {tpReservation.aggregatorLocator !== undefined ? (
                        <div>
                          <dt className="text-muted text-xs uppercase tracking-wide">
                            {t('sandbox.travelportLocator')}
                          </dt>
                          <dd className="text-fg font-mono text-sm">
                            {tpReservation.aggregatorLocator}
                          </dd>
                        </div>
                      ) : null}
                      {tpReservation.agencyLocator !== undefined ? (
                        <div>
                          <dt className="text-muted text-xs uppercase tracking-wide">
                            {t('sandbox.agencyLocator')}
                          </dt>
                          <dd className="text-fg font-mono text-sm">
                            {tpReservation.agencyLocator}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                ) : null}

                {tpReservation.phase === 'cancelled' ? (
                  <p className="text-muted mt-4 text-xs">{t('sandbox.cancelledNote')}</p>
                ) : (
                  <form action={cancelTravelportSandboxAction} className="mt-4">
                    <SubmitButton
                      pendingLabel={t('sandbox.cancelling')}
                      className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
                    >
                      {t('sandbox.cancelCta')}
                    </SubmitButton>
                  </form>
                )}
              </section>
            ) : (
              <section
                className="border-border bg-bg rounded-lg border border-dashed p-4 sm:p-5"
                aria-label={t('sandbox.label')}
              >
                <p className="text-fg text-sm font-medium">{t('sandbox.preprodTitle')}</p>
                <p className="text-muted mt-2 text-xs">{t('sandbox.intro')}</p>

                <OfferExpiryNotice
                  expiresAt={offer.expiresAt}
                  {...(persisted.hotel.slug !== undefined ? { slug: persisted.hotel.slug } : {})}
                />

                <form action={confirmTravelportSandboxAction} className="mt-4">
                  <SubmitButton
                    pendingLabel={t('sandbox.confirming')}
                    className="bg-fg text-bg focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
                  >
                    {t('sandbox.confirmCta')}
                  </SubmitButton>
                </form>
                {sandboxError !== undefined ? (
                  <p
                    role="alert"
                    className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  >
                    {t('sandbox.error')}
                  </p>
                ) : null}
              </section>
            )
          ) : (
            <form action={continueToPaymentAction}>
              <button
                type="submit"
                className="bg-gold text-charcoal hover:bg-gold-600 focus-visible:ring-ring rounded-md px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                {t('continueToPayment')}
              </button>
              <p className="text-muted mt-3 text-xs">{t('paymentDisclaimer')}</p>
            </form>
          )}
        </div>

        <OrderSummary
          locale={locale}
          hotel={persisted.hotel}
          offer={offer}
          lead={{ name: fullName(guest.firstName, guest.lastName), email: guest.email }}
          {...(progressStep === 'recap' ? { expiresAt: offer.expiresAt } : {})}
          {...(persisted.hotel.slug !== undefined ? { slug: persisted.hotel.slug } : {})}
        />
      </div>
    </main>
  );
}
