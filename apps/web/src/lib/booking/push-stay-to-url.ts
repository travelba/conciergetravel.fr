'use client';

import { isIsoDate } from '@/lib/booking/stay-url-params';

export const STAY_URL_SYNC_EVENT = 'mch-stay-sync';

export interface StayUrlParams {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly rooms?: number;
  readonly adults?: number;
  readonly children?: number;
  readonly childAges?: readonly number[];
}

/**
 * Writes stay params into the fiche URL without a navigation (ISR-safe) and
 * notifies `<PriceComparatorClient>` via `STAY_URL_SYNC_EVENT`.
 */
export function pushStayToUrl(stay: StayUrlParams): void {
  if (typeof window === 'undefined') return;
  if (!isIsoDate(stay.checkIn) || !isIsoDate(stay.checkOut)) return;

  const params = new URLSearchParams(window.location.search);
  params.set('checkIn', stay.checkIn);
  params.set('checkOut', stay.checkOut);

  if (stay.rooms !== undefined && stay.rooms > 0) {
    params.set('rooms', String(stay.rooms));
  }
  if (stay.adults !== undefined && stay.adults > 0) {
    params.set('adults', String(stay.adults));
  }
  if (stay.children !== undefined && stay.children >= 0) {
    params.set('children', String(stay.children));
  }
  if (stay.childAges !== undefined && stay.childAges.length > 0) {
    params.set('childAges', stay.childAges.join(','));
  }

  const next = `${window.location.pathname}?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;

  if (next !== current) {
    window.history.replaceState(null, '', next);
    window.dispatchEvent(new Event(STAY_URL_SYNC_EVENT));
  }
}
