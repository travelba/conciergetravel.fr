import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { BookingProgress } from '@/components/booking/booking-progress';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REF_PATTERN = /^CT-[0-9A-Z]{8}-[A-Z0-9]{5}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'reservationConfirmation.meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

interface HotelHead {
  readonly name: string;
  readonly city: string;
  readonly region: string;
}

type ConfirmationView =
  | {
      readonly kind: 'paid';
      readonly ref: string;
      readonly guestFirstname: string;
      readonly guestEmail: string;
      readonly checkIn: string;
      readonly checkOut: string;
      readonly totalAmountEur: number;
      readonly currency: string;
      readonly hotel: HotelHead | null;
    }
  | {
      readonly kind: 'email';
      readonly ref: string;
      readonly guestFirstname: string;
      readonly guestEmail: string;
      readonly checkIn: string;
      readonly checkOut: string;
      readonly hotel: HotelHead | null;
    };

const fmtPrice = (locale: Locale, amount: number, currency: string): string =>
  new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

const isoDateOnly = (s: string): string => s.slice(0, 10);

async function fetchPaidByRef(ref: string): Promise<ConfirmationView | null> {
  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return null;
  }
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'booking_ref, guest_firstname, guest_email, checkin_date, checkout_date, total_price, currency, hotels:hotel_id ( name, city, region )',
    )
    .eq('booking_ref', ref)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    booking_ref: string;
    guest_firstname: string;
    guest_email: string;
    checkin_date: string;
    checkout_date: string;
    total_price: string | number | null;
    currency: string;
    hotels: HotelHead | null;
  };
  const total =
    typeof row.total_price === 'string'
      ? Number.parseFloat(row.total_price)
      : (row.total_price ?? 0);
  return {
    kind: 'paid',
    ref: row.booking_ref,
    guestFirstname: row.guest_firstname,
    guestEmail: row.guest_email,
    checkIn: isoDateOnly(row.checkin_date),
    checkOut: isoDateOnly(row.checkout_date),
    totalAmountEur: Number.isFinite(total) ? total : 0,
    currency: row.currency,
    hotel: row.hotels,
  };
}

async function fetchEmailByRef(ref: string): Promise<ConfirmationView | null> {
  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return null;
  }
  const { data, error } = await supabase
    .from('booking_requests_email')
    .select(
      'request_ref, guest_firstname, guest_email, requested_checkin, requested_checkout, hotels:hotel_id ( name, city, region )',
    )
    .eq('request_ref', ref)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    request_ref: string;
    guest_firstname: string;
    guest_email: string;
    requested_checkin: string;
    requested_checkout: string;
    hotels: HotelHead | null;
  };
  return {
    kind: 'email',
    ref: row.request_ref,
    guestFirstname: row.guest_firstname,
    guestEmail: row.guest_email,
    checkIn: isoDateOnly(row.requested_checkin),
    checkOut: isoDateOnly(row.requested_checkout),
    hotel: row.hotels,
  };
}

async function fetchView(ref: string): Promise<ConfirmationView | null> {
  const paid = await fetchPaidByRef(ref);
  if (paid !== null) return paid;
  return fetchEmailByRef(ref);
}

export default async function ReservationConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; ref: string }>;
}) {
  const { locale: raw, ref: rawRef } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations('reservationConfirmation');

  const ref = decodeURIComponent(rawRef ?? '');
  if (!REF_PATTERN.test(ref)) notFound();

  const view = await fetchView(ref);
  if (view === null) notFound();

  const isPaid = view.kind === 'paid';

  return (
    <main className="max-w-editorial container mx-auto px-4 py-12 sm:py-16">
      {isPaid ? <BookingProgress locale={locale} current="confirmation" /> : null}

      <div className="mx-auto max-w-2xl text-center">
        <span
          aria-hidden
          className="bg-gold-100 text-gold-800 ring-gold-200 mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ring-8 ring-offset-0"
        >
          ✓
        </span>
        <p className="text-gold-700 mt-6 text-xs font-medium uppercase tracking-[0.2em]">
          {isPaid ? t('paid.eyebrow') : t('eyebrow')}
        </p>
        <h1 className="text-fg mt-3 font-serif text-3xl sm:text-4xl">
          {isPaid ? t('paid.title') : t('title')}
        </h1>
        <p className="text-muted mx-auto mt-4 max-w-prose text-sm">
          {t('greeting', { name: view.guestFirstname })}{' '}
          {isPaid
            ? view.hotel !== null
              ? t('paid.summary.body', {
                  hotel: view.hotel.name,
                  checkIn: view.checkIn,
                  checkOut: view.checkOut,
                })
              : t('paid.summary.bodyNoHotel', { checkIn: view.checkIn, checkOut: view.checkOut })
            : view.hotel !== null
              ? t('summary.body', {
                  hotel: view.hotel.name,
                  checkIn: view.checkIn,
                  checkOut: view.checkOut,
                })
              : t('summary.bodyNoHotel', { checkIn: view.checkIn, checkOut: view.checkOut })}
        </p>
      </div>

      <section className="border-border bg-bg shadow-card mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl border">
        {view.hotel !== null ? (
          <div className="border-border from-gold-50 to-bg border-b bg-gradient-to-b px-6 py-5 text-center">
            <p className="text-fg font-serif text-xl">{view.hotel.name}</p>
            <p className="text-muted text-sm">
              {view.hotel.city} · {view.hotel.region}
            </p>
          </div>
        ) : null}

        <dl className="divide-border divide-y px-6">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="text-muted text-sm">{t('row.stay')}</dt>
            <dd className="text-fg text-right text-sm font-medium">
              {view.checkIn} → {view.checkOut}
            </dd>
          </div>
          {isPaid ? (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <dt className="text-muted text-sm">{t('paid.totalLabel')}</dt>
              <dd className="text-fg text-right font-serif text-xl">
                {fmtPrice(locale, view.totalAmountEur, view.currency)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="text-muted text-sm">
              {isPaid ? t('paid.reference.label') : t('reference.label')}
            </dt>
            <dd className="text-fg text-right font-mono text-sm font-semibold tracking-wider">
              {view.ref}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-muted mx-auto mt-6 max-w-2xl text-center text-sm">
        {t('emailSentTo', { email: view.guestEmail })}
      </p>
    </main>
  );
}
