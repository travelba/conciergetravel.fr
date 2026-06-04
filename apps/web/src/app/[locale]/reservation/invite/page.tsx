import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect as nextRedirect } from 'next/navigation';

import { attachGuest, parseGuest } from '@mch/domain/booking';

import { BookingProgress } from '@/components/booking/booking-progress';
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

  const guestParsed = parseGuest({
    firstName: pickString(formData.get('firstName')) ?? '',
    lastName: pickString(formData.get('lastName')) ?? '',
    email: pickString(formData.get('email')) ?? '',
    phone: pickString(formData.get('phone')) ?? '',
  });

  const locale: Locale = persisted.locale;

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

          <form action={submitAction} className="flex flex-col gap-5" noValidate>
            <fieldset className="flex flex-col gap-4">
              <legend className="text-fg font-serif text-lg">{t('form.legend')}</legend>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-fg font-medium">{t('form.firstName')}</span>
                  <input
                    type="text"
                    name="firstName"
                    required
                    autoComplete="given-name"
                    maxLength={60}
                    className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-fg font-medium">{t('form.lastName')}</span>
                  <input
                    type="text"
                    name="lastName"
                    required
                    autoComplete="family-name"
                    maxLength={60}
                    className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-fg font-medium">{t('form.email')}</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-fg font-medium">{t('form.phone')}</span>
                  <input
                    type="tel"
                    name="phone"
                    required
                    autoComplete="tel"
                    maxLength={30}
                    className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
                  />
                </label>
              </div>
            </fieldset>

            {errorKind !== undefined ? (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              >
                {errorKind === 'validation'
                  ? t('errors.validation')
                  : errorKind === 'invalid_state'
                    ? t('errors.invalidState')
                    : t('errors.unknown')}
              </p>
            ) : null}

            <button
              type="submit"
              className="bg-fg text-bg focus-visible:ring-ring self-start rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {t('form.submit')}
            </button>
          </form>
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
