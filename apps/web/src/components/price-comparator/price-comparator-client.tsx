'use client';

import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react';

import {
  computeScenario,
  type ComparisonScenario,
  type CompetitorPrice,
  type CompetitorProvider,
  type NormalizedComparison,
} from '@mch/domain/price-comparison';

import type { Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import { STAY_URL_SYNC_EVENT } from '@/lib/booking/push-stay-to-url';

export interface PriceComparatorLabels {
  readonly title: string;
  readonly subtitle: string;
  readonly loading: string;
  readonly selectDates: string;
  readonly legal: string;
  readonly cachedNotice: string;
  readonly conciergeLabel: string;
  readonly bestRateBadge: string;
  readonly providerLabel: Record<CompetitorProvider, string>;
  readonly scenario: {
    readonly cheaper: string;
    readonly equalWithBenefits: string;
    readonly moreExpensive: string;
    readonly unavailable: string;
  };
  readonly tableHeader: {
    readonly provider: string;
    readonly price: string;
  };
}

interface ApiResponseAvailable {
  readonly ok: true;
  readonly available: true;
  readonly cached: boolean;
  readonly competitors: readonly CompetitorPrice[];
  readonly benefitsValueMinor: number;
  readonly priceConciergeMinor: number | null;
  readonly stay: NormalizedComparison['stay'];
}

interface ApiResponseUnavailable {
  readonly ok: true;
  readonly available: false;
  readonly reason: string;
}

type ApiResponse = ApiResponseAvailable | ApiResponseUnavailable;

export interface PriceComparatorClientProps {
  readonly locale: Locale;
  readonly hotelId: string;
  /** Party size used when the URL carries no `adults` param. */
  readonly adultsDefault: number;
  readonly defaultCheckIn?: string;
  readonly defaultCheckOut?: string;
  readonly priceConciergeMinor: number | null;
  readonly labels: PriceComparatorLabels;
  readonly surface?: 'default' | 'kit';
}

function formatEuroAmount(locale: Locale, amountMinor: number): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(amountMinor) / 100);
}

function scenarioHeadline(scenario: ComparisonScenario, labels: PriceComparatorLabels): string {
  const map: Record<ComparisonScenario['kind'], string> = {
    cheaper: labels.scenario.cheaper,
    equal_with_benefits: labels.scenario.equalWithBenefits,
    more_expensive: labels.scenario.moreExpensive,
    unavailable: labels.scenario.unavailable,
  };
  return map[scenario.kind];
}

function readStayParamsKey(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';
  const adults = params.get('adults') ?? '';
  return `${checkIn}|${checkOut}|${adults}`;
}

function parseStayParamsKey(key: string): {
  readonly checkIn: string | null;
  readonly checkOut: string | null;
  readonly adults: string | null;
} {
  if (key.length === 0) {
    return { checkIn: null, checkOut: null, adults: null };
  }
  const [checkIn = '', checkOut = '', adults = ''] = key.split('|');
  return {
    checkIn: checkIn.length > 0 ? checkIn : null,
    checkOut: checkOut.length > 0 ? checkOut : null,
    adults: adults.length > 0 ? adults : null,
  };
}

function subscribeStayParams(onStoreChange: () => void): () => void {
  const handler = (): void => onStoreChange();
  window.addEventListener('popstate', handler);
  window.addEventListener(STAY_URL_SYNC_EVENT, handler);
  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener(STAY_URL_SYNC_EVENT, handler);
  };
}

function resolveStayDates(
  mounted: boolean,
  stayKey: string,
  defaultCheckIn: string | undefined,
  defaultCheckOut: string | undefined,
): { readonly checkIn: string | null; readonly checkOut: string | null } {
  // SSR + hydration: never read `window.location` — use server-provided defaults
  // so the first client paint matches the cached ISR HTML byte-for-byte.
  if (!mounted) {
    return {
      checkIn: defaultCheckIn ?? null,
      checkOut: defaultCheckOut ?? null,
    };
  }
  const parsed = parseStayParamsKey(stayKey);
  return {
    checkIn: parsed.checkIn ?? defaultCheckIn ?? null,
    checkOut: parsed.checkOut ?? defaultCheckOut ?? null,
  };
}

export function PriceComparatorClient(props: PriceComparatorClientProps): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const handle = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(handle);
  }, []);

  const stayKey = useSyncExternalStore(subscribeStayParams, readStayParamsKey, () => '');

  const { checkIn, checkOut } = resolveStayDates(
    mounted,
    stayKey,
    props.defaultCheckIn,
    props.defaultCheckOut,
  );

  const adultsRaw = mounted ? parseStayParamsKey(stayKey).adults : null;
  const adultsParam = Number(adultsRaw ?? '');
  const adults =
    Number.isFinite(adultsParam) && adultsParam > 0 ? adultsParam : props.adultsDefault;
  const hasDates = checkIn !== null && checkIn !== '' && checkOut !== null && checkOut !== '';

  const [state, setState] = useState<
    | { readonly status: 'idle' }
    | { readonly status: 'loading' }
    | { readonly status: 'unavailable' }
    | { readonly status: 'available'; readonly data: ApiResponseAvailable }
  >({ status: 'loading' });

  const requestKey = `${props.hotelId}|${checkIn ?? ''}|${checkOut ?? ''}|${adults}`;

  useEffect(() => {
    if (!hasDates || checkIn === null || checkOut === null) {
      setState({ status: 'idle' });
      return;
    }

    setState({ status: 'loading' });
    let cancelled = false;

    const trigger = () => {
      if (cancelled) return;
      const params = new URLSearchParams({
        hotelId: props.hotelId,
        checkIn,
        checkOut,
        adults: String(adults),
      });
      fetch(`/api/price-comparison?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('network');
          const json: unknown = await res.json();
          if (cancelled) return;
          const parsed = json as ApiResponse;
          if (!parsed.ok) {
            setState({ status: 'unavailable' });
            return;
          }
          if (!parsed.available) {
            setState({ status: 'unavailable' });
            return;
          }
          const hasConcierge =
            parsed.priceConciergeMinor !== null && parsed.priceConciergeMinor > 0;
          if (!hasConcierge && parsed.competitors.length === 0) {
            setState({ status: 'unavailable' });
            return;
          }
          setState({ status: 'available', data: parsed });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'unavailable' });
        });
    };

    const rIC = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    const handle = typeof rIC === 'function' ? rIC(trigger) : window.setTimeout(trigger, 200);

    return () => {
      cancelled = true;
      const cIC = (
        globalThis as typeof globalThis & {
          cancelIdleCallback?: (h: number) => void;
        }
      ).cancelIdleCallback;
      if (typeof rIC === 'function' && typeof cIC === 'function') cIC(handle);
      else window.clearTimeout(handle as number);
    };
  }, [adults, checkIn, checkOut, hasDates, props.hotelId, requestKey]);

  const statusClass = props.surface === 'kit' ? 'rc-foot' : 'text-muted text-sm';

  if (state.status === 'idle') {
    return (
      <div>
        <p className={statusClass}>{props.labels.selectDates}</p>
        <p
          className={
            props.surface === 'kit' ? 'rc-foot' : 'text-muted mt-4 text-[11px] leading-snug'
          }
        >
          {props.labels.legal}
        </p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <p className={statusClass} aria-live="polite" aria-busy="true" suppressHydrationWarning>
        {props.labels.loading}
      </p>
    );
  }

  if (state.status === 'unavailable') {
    return <p className={statusClass}>{props.labels.scenario.unavailable}</p>;
  }

  const { data } = state;
  const priceConciergeMinor =
    data.priceConciergeMinor !== null && data.priceConciergeMinor > 0
      ? data.priceConciergeMinor
      : props.priceConciergeMinor;

  const normalized: NormalizedComparison = {
    competitors: data.competitors,
    benefitsValueMinor: data.benefitsValueMinor,
    cheapestCompetitor: data.competitors[0] ?? null,
    stay: data.stay,
  };
  const scenario = computeScenario({
    normalized,
    priceConciergeMinor,
  });

  const conciergeIsCheapest =
    priceConciergeMinor !== null &&
    (normalized.cheapestCompetitor === null ||
      priceConciergeMinor <= normalized.cheapestCompetitor.amountMinor);

  if (props.surface === 'kit') {
    return (
      <div>
        {data.cached ? <p className="rc-foot">{props.labels.cachedNotice}</p> : null}
        {priceConciergeMinor !== null ? (
          <div className={conciergeIsCheapest ? 'rc-row rc-best' : 'rc-row rc-us'}>
            <span className="rc-name">
              {props.labels.conciergeLabel}
              {conciergeIsCheapest ? (
                <>
                  {' '}
                  <em>{props.labels.bestRateBadge}</em>
                </>
              ) : null}
            </span>
            <span className="rc-amt">{formatEuroAmount(props.locale, priceConciergeMinor)}</span>
          </div>
        ) : null}
        {data.competitors.map((c) => (
          <div key={c.provider} className="rc-row">
            <span className="rc-name">{props.labels.providerLabel[c.provider]}</span>
            <span className="rc-amt">{formatEuroAmount(props.locale, c.amountMinor)}</span>
          </div>
        ))}
        <p className="rc-foot">{props.labels.legal}</p>
        <p className="rc-foot" data-scenario={scenario.kind}>
          {scenarioHeadline(scenario, props.labels)}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-fg mb-3 text-sm font-medium" data-scenario={scenario.kind}>
        {scenarioHeadline(scenario, props.labels)}
      </p>

      {data.cached ? <p className="text-muted mb-3 text-xs">{props.labels.cachedNotice}</p> : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border text-muted border-b text-left text-xs uppercase tracking-wider">
            <th scope="col" className="py-2 pr-2 font-normal">
              {props.labels.tableHeader.provider}
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-normal">
              {props.labels.tableHeader.price}
            </th>
          </tr>
        </thead>
        <tbody>
          {priceConciergeMinor !== null ? (
            <tr
              className={
                conciergeIsCheapest
                  ? 'border-border/60 bg-bg-subtle border-b last:border-0'
                  : 'border-border/60 border-b last:border-0'
              }
            >
              <th scope="row" className="text-fg py-2 pr-2 font-medium">
                {props.labels.conciergeLabel}
                {conciergeIsCheapest ? (
                  <span className="text-muted ml-1 text-xs font-normal">
                    ({props.labels.bestRateBadge})
                  </span>
                ) : null}
              </th>
              <td className="text-fg py-2 pl-2 text-right font-medium tabular-nums">
                {formatEuroAmount(props.locale, priceConciergeMinor)}
              </td>
            </tr>
          ) : null}
          {data.competitors.map((c) => (
            <tr key={c.provider} className="border-border/60 border-b last:border-0">
              <th scope="row" className="text-fg py-2 pr-2 font-normal">
                {props.labels.providerLabel[c.provider]}
              </th>
              <td className="text-fg py-2 pl-2 text-right tabular-nums">
                {formatEuroAmount(props.locale, c.amountMinor)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-muted mt-4 text-[11px] leading-snug">{props.labels.legal}</p>
    </div>
  );
}
