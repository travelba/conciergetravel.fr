import { HotelImage } from '@mch/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { env } from '@/lib/env';
import { intlLocaleTag } from '@/i18n/runtime';
import type { Locale } from '@/i18n/routing';

import { OfferExpiryNotice } from './offer-expiry-notice';

interface OrderSummaryHotel {
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly roomLabel?: string | undefined;
  readonly rateLabel?: string | undefined;
  readonly refundable?: boolean | null | undefined;
  readonly breakfastIncluded?: boolean | null | undefined;
  readonly heroPublicId?: string | undefined;
}

interface OrderSummaryOffer {
  readonly stay: { readonly checkIn: string; readonly checkOut: string };
  readonly guests: { readonly adults: number; readonly children: number };
  readonly totalPrice: { readonly amountMinor: number };
}

interface OrderSummaryLead {
  readonly name: string;
  readonly email: string;
}

interface OrderSummaryProps {
  readonly locale: Locale;
  readonly hotel: OrderSummaryHotel;
  readonly offer: OrderSummaryOffer;
  /** ISO expiry → drives the live hold countdown when provided. */
  readonly expiresAt?: string;
  readonly slug?: string;
  /** Voyageur principal — affiché sur le récap (absent à la saisie). */
  readonly lead?: OrderSummaryLead;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${checkOut.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Order-summary « niveau OTA » : récap collant de la sélection (chambre, tarif,
 * dates, voyageurs, prix par nuit + total) affiché à côté du formulaire pendant
 * la saisie voyageur et le récap. Server Component pur (le compte à rebours est
 * délégué à `OfferExpiryNotice`, client).
 */
export async function OrderSummary({
  locale,
  hotel,
  offer,
  expiresAt,
  slug,
  lead,
}: OrderSummaryProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'orderSummary' });
  const nf = new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
  const nights = nightsBetween(offer.stay.checkIn, offer.stay.checkOut);
  const total = offer.totalPrice.amountMinor;
  const perNight = Math.round(total / nights);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const showPhoto = hotel.heroPublicId !== undefined && cloudName.length > 0;

  return (
    <aside
      aria-label={t('title')}
      className="border-border bg-bg shadow-card overflow-hidden rounded-2xl border lg:sticky lg:top-24"
    >
      {showPhoto && hotel.heroPublicId !== undefined ? (
        <div className="relative h-32 w-full overflow-hidden">
          <HotelImage
            cloudName={cloudName}
            publicId={hotel.heroPublicId}
            alt={hotel.name}
            variant="card"
            width={352}
            height={128}
            sizes="352px"
            className="h-32 w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
              {t('title')}
            </p>
            <p className="font-serif text-lg leading-snug text-white">{hotel.name}</p>
            <p className="text-xs text-white/85">
              {hotel.city} · {hotel.region}
            </p>
          </div>
        </div>
      ) : (
        <div className="from-gold-50 to-bg border-border border-b bg-gradient-to-b px-5 py-4">
          <p className="text-gold-700 text-[11px] font-medium uppercase tracking-[0.18em]">
            {t('title')}
          </p>
          <p className="text-fg mt-1 font-serif text-lg leading-snug">{hotel.name}</p>
          <p className="text-muted text-xs">
            {hotel.city} · {hotel.region}
          </p>
        </div>
      )}

      <div className="px-5 py-4">
        {hotel.roomLabel !== undefined || hotel.rateLabel !== undefined ? (
          <div className="pb-4">
            {hotel.roomLabel !== undefined ? (
              <p className="text-fg text-sm font-medium">{hotel.roomLabel}</p>
            ) : null}
            {hotel.rateLabel !== undefined ? (
              <p className="text-muted mt-0.5 text-xs">{hotel.rateLabel}</p>
            ) : null}
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {hotel.breakfastIncluded === true ? (
                <li className="bg-gold-50 text-gold-800 border-gold-200 rounded-full border px-2.5 py-1 text-[11px] font-medium">
                  {t('breakfastIncluded')}
                </li>
              ) : null}
              {hotel.refundable === true ? (
                <li className="bg-gold-50 text-gold-800 border-gold-200 rounded-full border px-2.5 py-1 text-[11px] font-medium">
                  {t('refundable')}
                </li>
              ) : hotel.refundable === false ? (
                <li className="text-muted border-border rounded-full border px-2.5 py-1 text-[11px]">
                  {t('nonRefundable')}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <dl className="border-border space-y-2.5 border-t pt-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted">{t('stay')}</dt>
            <dd className="text-fg text-right">
              {offer.stay.checkIn}
              <br />→ {offer.stay.checkOut}
              <span className="text-muted mt-0.5 block text-xs">{t('nights', { nights })}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t('guestsLabel')}</dt>
            <dd className="text-fg text-right">
              {t('guests', { adults: offer.guests.adults, children: offer.guests.children })}
            </dd>
          </div>
          {lead !== undefined ? (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-muted">{t('lead')}</dt>
              <dd className="text-fg text-right">
                {lead.name}
                <span className="text-muted mt-0.5 block text-xs">{lead.email}</span>
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="border-border mt-4 border-t pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-fg text-sm font-medium">{t('total')}</span>
            <span className="text-fg font-serif text-2xl">{nf.format(total / 100)}</span>
          </div>
          <p className="text-muted mt-1 text-right text-xs">
            {t('perNight', { price: nf.format(perNight / 100) })}
          </p>
          <p className="text-muted/80 mt-2 text-xs">{t('taxesNote')}</p>
        </div>

        {expiresAt !== undefined ? (
          <OfferExpiryNotice expiresAt={expiresAt} {...(slug !== undefined ? { slug } : {})} />
        ) : null}
      </div>
    </aside>
  );
}
