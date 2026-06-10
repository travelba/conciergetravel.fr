'use client';

import { useEffect, useState, type ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import {
  TRAVELPORT_STAY_EVENT,
  type TravelportStayDetail,
} from '@/components/hotel/booking-sandbox-live-aside';
import { fetchTravelportSearch } from '@/lib/travelport/fetch-travelport-search';

export interface TravelportKitLivePricesProps {
  readonly locale: Locale;
  readonly slug: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly priceUnit: string;
}

function formatEur(locale: Locale, minor: number): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(minor) / 100);
}

function patchRoomPrice(roomId: string, amount: string, priceUnit: string): void {
  const article = document.querySelector<HTMLElement>(`.room-v2[data-room-id="${roomId}"]`);
  if (article === null) return;
  const cta = article.querySelector('.rv2-cta');
  if (cta === null) return;
  let priceEl = cta.querySelector('.rv2-price');
  if (priceEl === null) {
    priceEl = document.createElement('span');
    priceEl.className = 'rv2-price rv2-price--live';
    cta.insertBefore(priceEl, cta.firstChild);
  } else {
    priceEl.classList.add('rv2-price--live');
  }
  priceEl.innerHTML = `${amount}<small>${priceUnit}</small>`;
  priceEl.setAttribute('data-live-price', 'travelport');
}

/**
 * Patches kit room cards (static HTML shell) with Travelport live prices after
 * hydration. Never blocks SSR — editorial indicative prices stay until fetch
 * completes.
 */
export function TravelportKitLivePrices(props: TravelportKitLivePricesProps): ReactElement | null {
  const [stay, setStay] = useState({
    checkIn: props.checkIn,
    checkOut: props.checkOut,
    adults: props.adults,
  });

  useEffect(() => {
    const onStay = (event: Event): void => {
      const detail = (event as CustomEvent<TravelportStayDetail>).detail;
      if (detail === undefined) return;
      setStay(detail);
    };
    window.addEventListener(TRAVELPORT_STAY_EVENT, onStay);
    return () => window.removeEventListener(TRAVELPORT_STAY_EVENT, onStay);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTravelportSearch({
      slug: props.slug,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      matchRooms: true,
    })
      .then((body) => {
        if (cancelled || body.ok !== true || body.available !== true) return;
        const fromByRoomId = body.fromByRoomId;
        if (fromByRoomId === undefined) return;
        for (const [roomId, minor] of Object.entries(fromByRoomId)) {
          patchRoomPrice(roomId, formatEur(props.locale, minor), props.priceUnit);
        }
      })
      .catch(() => {
        /* editorial fallback — no-op */
      });

    return () => {
      cancelled = true;
    };
  }, [props.locale, props.priceUnit, props.slug, stay.adults, stay.checkIn, stay.checkOut]);

  return null;
}
