import { Suspense, type ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

import { PriceComparatorClient } from './price-comparator-client';

export interface PriceComparatorProps {
  readonly locale: Locale;
  readonly hotelId: string;
  /**
   * Default party size used when the URL carries no `adults` param. The
   * live stay dates are read **client-side** from the URL search params
   * (`?checkIn=…&checkOut=…`) so the host page stays static / ISR.
   */
  readonly adultsDefault?: number;
  /**
   * Live MyConciergeHotel price (EUR cents, TTC). When `null` the widget
   * still renders the competitor list but skips the scenario verdict
   * (CDC v3.2 §"informational" tone).
   */
  readonly priceConciergeMinor: number | null;
}

/**
 * Server component shell for the price comparator (skill:
 * competitive-pricing-comparison).
 *
 * Responsibilities:
 *  - never block LCP: data is fetched **client-side** after hydration.
 *  - never link out to a competitor (CDC v3.2).
 *  - never display competitor logos (CDC v3.2).
 *  - never fabricate competitor prices — without selected stay dates the
 *    island shows a sober "select your dates" prompt instead of figures.
 *
 * The shell always renders (so the aside keeps the kit `.resa-compare`
 * card) but the client island reads the stay dates from the URL and only
 * contacts `/api/price-comparison` once a check-in / check-out range is
 * present. The island is wrapped in `<Suspense>` because `useSearchParams`
 * would otherwise opt the whole route out of static rendering.
 */
export async function PriceComparator(props: PriceComparatorProps): Promise<ReactElement> {
  const t = await getTranslations('priceComparator');

  const labels = {
    title: t('title'),
    subtitle: t('subtitle'),
    loading: t('loading'),
    selectDates: t('selectDates'),
    legal: t('legal'),
    cachedNotice: t('cachedNotice'),
    providerLabel: {
      booking_com: t('providerLabel.booking_com'),
      expedia: t('providerLabel.expedia'),
      hotels_com: t('providerLabel.hotels_com'),
      official_site: t('providerLabel.official_site'),
    },
    scenario: {
      cheaper: t('scenario.cheaper'),
      equalWithBenefits: t('scenario.equalWithBenefits'),
      moreExpensive: t('scenario.moreExpensive'),
      unavailable: t('scenario.unavailable'),
    },
    tableHeader: {
      provider: t('tableHeader.provider'),
      price: t('tableHeader.price'),
    },
  } as const;

  return (
    <section
      aria-labelledby="price-comparator-title"
      className="border-border bg-bg rounded-lg border p-5"
    >
      <header className="mb-3">
        <h2 id="price-comparator-title" className="text-fg font-serif text-lg">
          {labels.title}
        </h2>
        <p className="text-muted mt-1 text-xs">{labels.subtitle}</p>
      </header>

      <Suspense fallback={<p className="text-muted text-sm">{labels.loading}</p>}>
        <PriceComparatorClient
          locale={props.locale}
          hotelId={props.hotelId}
          adultsDefault={props.adultsDefault ?? 2}
          priceConciergeMinor={props.priceConciergeMinor}
          labels={labels}
        />
      </Suspense>
    </section>
  );
}
