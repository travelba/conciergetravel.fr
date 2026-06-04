import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect as nextRedirect } from 'next/navigation';

import { attachGuest, parseGuest } from '@mch/domain/booking';

import { BookingProgress } from '@/components/booking/booking-progress';
import { GuestForm } from '@/components/booking/guest-form';
import { OrderSummary } from '@/components/booking/order-summary';
import { redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
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
  const t = await getTranslations({ locale, namespace: 'reservationInvite.meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

interface InviteSearchParams {
  readonly error?: string;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// Aligned with `recap/page.tsx#redirectExpired`: both locales point at
// the canonical search page with the expired flag. Phase 1c-α fixed the
// pre-existing FR-branch typo (`/reservation/recherche` 404); Phase 2
// routes the redirect through next-intl typed pathnames so EN goes to
// `/en/search?expired=1` (not the legacy `/en/recherche?expired=1`).
function redirectExpired(locale: Locale): never {
  redirect({
    href: { pathname: '/recherche', query: { expired: '1' } },
    locale,
  });
}

async function submitAction(formData: FormData): Promise<void> {
  'use server';

  const draftId = await getDraftId();
  if (draftId === undefined) {
    nextRedirect('/');
  }

  const persisted = await loadDraft(draftId);
  if (persisted === null) {
    redirectExpired('fr');
  }

  const locale: Locale = persisted.locale;

  // Consentement CGV obligatoire (le client le bloque déjà ; garde-fou serveur).
  if (pickString(formData.get('consent')) === undefined) {
    redirect({
      href: { pathname: '/reservation/invite', query: { error: 'validation' } },
      locale,
    });
  }

  const guestParsed = parseGuest({
    firstName: pickString(formData.get('firstName')) ?? '',
    lastName: pickString(formData.get('lastName')) ?? '',
    email: pickString(formData.get('email')) ?? '',
    phone: pickString(formData.get('phone')) ?? '',
    ...(pickString(formData.get('specialRequests')) !== undefined
      ? { specialRequests: pickString(formData.get('specialRequests')) }
      : {}),
  });

  if (!guestParsed.ok) {
    redirect({
      href: { pathname: '/reservation/invite', query: { error: 'validation' } },
      locale,
    });
  }

  const next = attachGuest(persisted.draft, guestParsed.value);
  if (!next.ok) {
    redirect({
      href: { pathname: '/reservation/invite', query: { error: 'invalid_state' } },
      locale,
    });
  }

  await saveDraft({
    draft: next.value,
    hotel: persisted.hotel,
    locale,
  });

  redirect({ href: '/reservation/recap', locale });
}

export default async function ReservationInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<InviteSearchParams>;
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations('reservationInvite');

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
  if (persisted === null || persisted.draft.state !== 'offer_locked') {
    return (
      <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('expired.title')}</h1>
        <p className="text-muted mt-3 max-w-prose">{t('expired.description')}</p>
      </main>
    );
  }

  const errorKind = pickString(sp.error);
  const offer = persisted.draft.offer;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      <BookingProgress locale={locale} current="guest" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div>
          <header className="mb-8">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
            <h1 className="text-fg mt-2 font-serif text-3xl sm:text-4xl">{persisted.hotel.name}</h1>
            <p className="text-muted mt-2 text-sm">
              {persisted.hotel.city} · {persisted.hotel.region}
            </p>
          </header>

          <GuestForm
            action={submitAction}
            messages={{
              legend: t('form.legend'),
              firstName: t('form.firstName'),
              lastName: t('form.lastName'),
              email: t('form.email'),
              phone: t('form.phone'),
              specialRequests: t('form.specialRequests'),
              specialRequestsHint: t('form.specialRequestsHint'),
              specialRequestsPlaceholder: t('form.specialRequestsPlaceholder'),
              consent: t('form.consent'),
              submit: t('form.submit'),
              vRequired: t('validation.required'),
              vEmail: t('validation.email'),
              vPhone: t('validation.phone'),
              vConsent: t('validation.consent'),
            }}
            {...(errorKind !== undefined
              ? {
                  serverError:
                    errorKind === 'validation'
                      ? t('errors.validation')
                      : errorKind === 'invalid_state'
                        ? t('errors.invalidState')
                        : t('errors.unknown'),
                }
              : {})}
          />
        </div>

        {offer !== undefined ? (
          <OrderSummary
            locale={locale}
            hotel={persisted.hotel}
            offer={offer}
            expiresAt={offer.expiresAt}
            {...(persisted.hotel.slug !== undefined ? { slug: persisted.hotel.slug } : {})}
          />
        ) : null}
      </div>
    </main>
  );
}
