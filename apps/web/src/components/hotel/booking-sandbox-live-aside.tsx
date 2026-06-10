'use client';

import { useEffect, useState, type ReactElement } from 'react';

import type { CompetitorPrice, CompetitorProvider } from '@mch/domain/price-comparison';

import type { Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';

import { SubmitButton } from '@/components/booking/submit-button';

function addDayIso(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

const FIELD_CLASS =
  'border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2 w-full';

export interface BookingSandboxLiveAsideLabels {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: string;
  readonly submit: string;
  readonly submitting: string;
  readonly compareTitle: string;
  readonly compareLoading: string;
  readonly compareLegal: string;
  readonly conciergeLabel: string;
  readonly bestRateBadge: string;
  readonly providerLabel: Record<CompetitorProvider, string>;
}

interface ComparePayload {
  readonly priceConciergeMinor: number | null;
  readonly competitors: readonly CompetitorPrice[];
}

export interface BookingSandboxLiveAsideProps {
  readonly locale: Locale;
  readonly hotelId: string;
  readonly formAction: string;
  readonly labels: BookingSandboxLiveAsideLabels;
  readonly defaults: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
    readonly today: string;
  };
  readonly headline: string;
  readonly intro: string;
  readonly footnote: string;
  readonly embeddedInKitAside: boolean;
  /** When false, skips `/api/price-comparison` and hides the compare block. */
  readonly compareEnabled?: boolean;
}

function formatEuroAmount(locale: Locale, amountMinor: number): string {
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(amountMinor) / 100);
}

/**
 * Pilote Travelport + comparateur live (Prince de Galles) — un seul bloc :
 * dates → un appel `/api/price-comparison` → MyConciergeHotel + OTA ensemble.
 */
export function BookingSandboxLiveAside(props: BookingSandboxLiveAsideProps): ReactElement {
  const compareEnabled = props.compareEnabled ?? true;
  const [checkIn, setCheckIn] = useState(props.defaults.checkIn);
  const [checkOut, setCheckOut] = useState(props.defaults.checkOut);
  const [adults, setAdults] = useState(props.defaults.adults);
  const minCheckOut = addDayIso(checkIn >= props.defaults.today ? checkIn : props.defaults.today);

  const [compare, setCompare] = useState<
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly data: ComparePayload }
    | { readonly status: 'empty' }
  >({ status: 'loading' });

  useEffect(() => {
    if (!compareEnabled) {
      setCompare({ status: 'empty' });
      return;
    }

    let cancelled = false;
    setCompare({ status: 'loading' });

    const params = new URLSearchParams({
      hotelId: props.hotelId,
      checkIn,
      checkOut,
      adults: String(adults),
    });

    fetch(`/api/price-comparison?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('network');
        const json: unknown = await res.json();
        if (cancelled) return;
        const body = json as {
          ok?: boolean;
          available?: boolean;
          priceConciergeMinor?: number | null;
          competitors?: readonly CompetitorPrice[];
        };
        if (body.ok !== true || body.available !== true) {
          setCompare({ status: 'empty' });
          return;
        }
        const priceConciergeMinor =
          typeof body.priceConciergeMinor === 'number' && body.priceConciergeMinor > 0
            ? body.priceConciergeMinor
            : null;
        const competitors = Array.isArray(body.competitors) ? body.competitors : [];
        if (priceConciergeMinor === null && competitors.length === 0) {
          setCompare({ status: 'empty' });
          return;
        }
        setCompare({
          status: 'ready',
          data: { priceConciergeMinor, competitors },
        });
      })
      .catch(() => {
        if (!cancelled) setCompare({ status: 'empty' });
      });

    return () => {
      cancelled = true;
    };
  }, [adults, checkIn, checkOut, compareEnabled, props.hotelId]);

  const onCheckInChange = (next: string): void => {
    setCheckIn(next);
    if (checkOut <= next) setCheckOut(addDayIso(next));
  };

  const rowClass = props.embeddedInKitAside
    ? 'rc-row'
    : 'text-fg flex items-baseline justify-between gap-3 py-1.5 text-sm';
  const rowBestClass = props.embeddedInKitAside ? 'rc-row rc-best' : `${rowClass} font-medium`;
  const nameClass = props.embeddedInKitAside ? 'rc-name' : undefined;
  const amtClass = props.embeddedInKitAside ? 'rc-amt' : 'tabular-nums';

  const compareBlock = (
    <div
      className={
        props.embeddedInKitAside
          ? 'resa-compare'
          : 'border-border bg-bg-subtle/40 mt-2 rounded-md border p-3'
      }
    >
      <div className={props.embeddedInKitAside ? 'rc-title' : 'text-fg mb-2 text-sm font-medium'}>
        {props.labels.compareTitle}
      </div>
      {compare.status === 'loading' ? (
        <p className={props.embeddedInKitAside ? 'rc-foot' : 'text-muted text-sm'} aria-busy="true">
          {props.labels.compareLoading}
        </p>
      ) : null}
      {compare.status === 'ready' ? (
        <>
          {compare.data.priceConciergeMinor !== null ? (
            <div className={rowBestClass}>
              <span className={nameClass}>
                {props.labels.conciergeLabel}{' '}
                {props.embeddedInKitAside ? (
                  <em>{props.labels.bestRateBadge}</em>
                ) : (
                  <span className="text-muted text-xs font-normal">
                    ({props.labels.bestRateBadge})
                  </span>
                )}
              </span>
              <span className={amtClass}>
                {formatEuroAmount(props.locale, compare.data.priceConciergeMinor)}
              </span>
            </div>
          ) : null}
          {compare.data.competitors.map((c) => (
            <div key={c.provider} className={rowClass}>
              <span className={nameClass}>{props.labels.providerLabel[c.provider]}</span>
              <span className={amtClass}>{formatEuroAmount(props.locale, c.amountMinor)}</span>
            </div>
          ))}
        </>
      ) : null}
      <p className={props.embeddedInKitAside ? 'rc-foot' : 'text-muted mt-2 text-xs'}>
        {props.labels.compareLegal}
      </p>
    </div>
  );

  const form = (
    <form
      method="get"
      action={props.formAction}
      data-testid="booking-widget-form"
      className={props.embeddedInKitAside ? 'resa-form' : 'mt-4 flex flex-col gap-4'}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{props.labels.checkIn}</span>
          <input
            type="date"
            name="checkIn"
            value={checkIn}
            min={props.defaults.today}
            required
            onChange={(e) => onCheckInChange(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{props.labels.checkOut}</span>
          <input
            type="date"
            name="checkOut"
            value={checkOut}
            min={minCheckOut}
            required
            onChange={(e) => setCheckOut(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{props.labels.adults}</span>
          <input
            type="number"
            name="adults"
            min={1}
            max={9}
            value={adults}
            required
            onChange={(e) => setAdults(Number.parseInt(e.target.value, 10) || 1)}
            className={FIELD_CLASS}
          />
        </label>
      </div>

      {compareEnabled ? compareBlock : null}

      <SubmitButton
        pendingLabel={props.labels.submitting}
        className={
          props.embeddedInKitAside
            ? 'btn btn-primary btn-block'
            : 'bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70'
        }
      >
        {props.labels.submit}
      </SubmitButton>
    </form>
  );

  if (props.embeddedInKitAside) {
    return (
      <div className="mch-kit resa-card" data-booking-widget="kit_rail">
        <div className="rc-title">{props.headline}</div>
        <p className="rc-foot">{props.intro}</p>
        {form}
        <p className="rc-foot">{props.footnote}</p>
      </div>
    );
  }

  return (
    <section
      id="booking"
      aria-labelledby="booking-sandbox-title"
      data-booking-widget="rail"
      className="border-border bg-bg scroll-mt-24 rounded-lg border p-6"
    >
      <h2 id="booking-sandbox-title" className="text-fg font-serif text-xl leading-tight">
        {props.headline}
      </h2>
      <p className="text-muted mt-3 text-sm leading-relaxed">{props.intro}</p>
      {form}
      <p className="text-muted/80 mt-4 text-xs">{props.footnote}</p>
    </section>
  );
}
