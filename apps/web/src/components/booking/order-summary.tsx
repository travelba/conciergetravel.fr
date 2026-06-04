import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

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
}

interface OrderSummaryOffer {
  readonly stay: { readonly checkIn: string; readonly checkOut: string };
  readonly guests: { readonly adults: number; readonly children: number };
  readonly totalPrice: { readonly amountMinor: number };
}

interface OrderSummaryProps {
  readonly locale: Locale;
  readonly hotel: OrderSummaryHotel;
  readonly offer: OrderSummaryOffer;
  /** ISO expiry → drives the live hold countdown when provided. */
  readonly expiresAt?: string;
  readonly slug?: string;
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

  return (
    <aside
      aria-label={t('title')}
      className="border-border bg-bg rounded-2xl border p-5 lg:sticky lg:top-24"
    >
      <h2 className="text-fg font-serif text-lg">{t('title')}</h2>

      <div className="mt-3">
        <p className="text-fg text-sm font-medium">{hotel.name}</p>
        <p className="text-muted text-xs">
          {hotel.city} · {hotel.region}
        </p>
      </div>

      {hotel.roomLabel !== undefined || hotel.rateLabel !== undefined ? (
        <div className="border-border mt-4 border-t pt-4">
          {hotel.roomLabel !== undefined ? (
            <p className="text-fg text-sm">{hotel.roomLabel}</p>
          ) : null}
          {hotel.rateLabel !== undefined ? (
            <p className="text-muted mt-0.5 text-xs">{hotel.rateLabel}</p>
          ) : null}
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {hotel.breakfastIncluded === true ? (
              <li className="text-gold-800">✓ {t('breakfastIncluded')}</li>
            ) : null}
            {hotel.refundable === true ? (
              <li className="text-gold-800">✓ {t('refundable')}</li>
            ) : hotel.refundable === false ? (
              <li className="text-muted">{t('nonRefundable')}</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <dl className="border-border mt-4 grid grid-cols-2 gap-y-2 border-t pt-4 text-sm">
        <dt className="text-muted">{t('stay')}</dt>
        <dd className="text-fg text-right">
          {offer.stay.checkIn} → {offer.stay.checkOut}
        </dd>
        <dt className="text-muted" />
        <dd className="text-muted text-right text-xs">{t('nights', { nights })}</dd>
        <dt className="text-muted">{t('guestsLabel')}</dt>
        <dd className="text-fg text-right">
          {t('guests', { adults: offer.guests.adults, children: offer.guests.children })}
        </dd>
      </dl>

      <div className="border-border mt-4 border-t pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-muted text-sm">{t('total')}</span>
          <span className="text-fg font-serif text-2xl">{nf.format(total / 100)}</span>
        </div>
        <p className="text-muted mt-1 text-right text-xs">
          {t('perNight', { price: nf.format(perNight / 100) })}
        </p>
        <p className="text-muted mt-1 text-xs">{t('taxesNote')}</p>
      </div>

      {expiresAt !== undefined ? (
        <OfferExpiryNotice expiresAt={expiresAt} {...(slug !== undefined ? { slug } : {})} />
      ) : null}
    </aside>
  );
}
