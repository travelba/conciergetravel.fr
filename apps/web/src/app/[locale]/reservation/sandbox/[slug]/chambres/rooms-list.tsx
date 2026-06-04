'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { SubmitButton } from '@/components/booking/submit-button';
import { intlLocaleTag } from '@/i18n/runtime';
import type { Locale } from '@/i18n/routing';

/** Mirror of `SandboxRoomOption` (server-only module — kept structural here). */
export interface RoomOption {
  readonly rateKey: string;
  readonly roomLabel: string;
  readonly rateLabel: string;
  readonly maxOccupancy: number | null;
  readonly priceMinor: number;
  readonly breakfastIncluded: boolean | null;
  readonly refundable: boolean | null;
  readonly cancellationText: string;
}

interface RoomsListProps {
  readonly options: readonly RoomOption[];
  readonly offerSetId: string;
  readonly slug: string;
  readonly locale: Locale;
  readonly selectAction: (formData: FormData) => Promise<void>;
}

interface RoomGroup {
  readonly label: string;
  readonly maxOccupancy: number | null;
  readonly rates: readonly RoomOption[];
}

/**
 * Liste de chambres Travelport (sandbox) **groupée par type de chambre**, avec
 * filtres petit-déjeuner / remboursable et tarif le moins cher mis en avant
 * (le reste replié derrière « Voir les N tarifs »). Remplace la liste plate
 * (jusqu'à ~96 lignes) par une vue digeste. Le verrouillage repasse par le
 * server action (`offerSetId` + `rateKey` relus côté serveur — jamais le prix).
 */
export function RoomsList({
  options,
  offerSetId,
  slug,
  locale,
  selectAction,
}: RoomsListProps): ReactElement {
  const t = useTranslations('reservationRooms');
  const [breakfastOnly, setBreakfastOnly] = useState(false);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const fmtPrice = useMemo(() => {
    const nf = new Intl.NumberFormat(intlLocaleTag(locale), {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
    return (minor: number): string => nf.format(minor / 100);
  }, [locale]);

  const groups = useMemo<readonly RoomGroup[]>(() => {
    const filtered = options.filter(
      (o) =>
        (!breakfastOnly || o.breakfastIncluded === true) &&
        (!refundableOnly || o.refundable === true),
    );
    const byLabel = new Map<string, RoomOption[]>();
    for (const o of filtered) {
      const arr = byLabel.get(o.roomLabel);
      if (arr === undefined) byLabel.set(o.roomLabel, [o]);
      else arr.push(o);
    }
    return [...byLabel.entries()]
      .map(([label, rates]) => {
        const sorted = [...rates].sort((a, b) => a.priceMinor - b.priceMinor);
        const maxOcc = sorted.reduce<number | null>(
          (acc, r) =>
            r.maxOccupancy !== null && (acc === null || r.maxOccupancy > acc)
              ? r.maxOccupancy
              : acc,
          null,
        );
        return { label, maxOccupancy: maxOcc, rates: sorted };
      })
      .sort((a, b) => (a.rates[0]?.priceMinor ?? 0) - (b.rates[0]?.priceMinor ?? 0));
  }, [options, breakfastOnly, refundableOnly]);

  const toggleExpand = (label: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div>
      <fieldset className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        <legend className="text-muted mr-2 text-xs uppercase tracking-wide">
          {t('filters.title')}
        </legend>
        <label className="text-fg flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={breakfastOnly}
            onChange={(e) => setBreakfastOnly(e.target.checked)}
            className="accent-fg h-4 w-4"
          />
          {t('filters.breakfast')}
        </label>
        <label className="text-fg flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={refundableOnly}
            onChange={(e) => setRefundableOnly(e.target.checked)}
            className="accent-fg h-4 w-4"
          />
          {t('filters.refundable')}
        </label>
      </fieldset>

      {groups.length === 0 ? (
        <p className="text-muted text-sm" role="status">
          {t('noMatch')}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => {
            const isExpanded = expanded.has(group.label);
            const visibleRates = isExpanded ? group.rates : group.rates.slice(0, 1);
            const cheapest = group.rates[0];
            return (
              <li
                key={group.label}
                className="border-border bg-bg rounded-lg border p-4 sm:p-5"
                data-room-group
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-fg font-serif text-lg leading-snug">{group.label}</h2>
                  <div className="text-right">
                    {cheapest !== undefined ? (
                      <p className="text-muted text-xs">
                        {t('from', { price: fmtPrice(cheapest.priceMinor) })}
                      </p>
                    ) : null}
                    {group.maxOccupancy !== null ? (
                      <p className="text-muted text-xs">
                        {t('upToGuests', { count: group.maxOccupancy })}
                      </p>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-border mt-3 flex flex-col divide-y">
                  {visibleRates.map((opt) => (
                    <li
                      key={opt.rateKey}
                      className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0"
                      data-room-option
                    >
                      <div className="min-w-0">
                        <p className="text-fg text-sm font-medium">{opt.rateLabel}</p>
                        <ul className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {opt.breakfastIncluded === true ? (
                            <li>{t('breakfastIncluded')}</li>
                          ) : null}
                          {opt.refundable === true ? (
                            <li>{t('refundable')}</li>
                          ) : opt.refundable === false ? (
                            <li>{t('nonRefundable')}</li>
                          ) : null}
                        </ul>
                        {opt.cancellationText !== '' ? (
                          <p className="text-muted/80 mt-1 text-xs">{opt.cancellationText}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-fg font-serif text-xl">{fmtPrice(opt.priceMinor)}</p>
                        <p className="text-muted text-xs">{t('totalStay')}</p>
                        <form action={selectAction}>
                          <input type="hidden" name="offerSetId" value={offerSetId} />
                          <input type="hidden" name="rateKey" value={opt.rateKey} />
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="slug" value={slug} />
                          <SubmitButton
                            pendingLabel={t('selecting')}
                            ariaLabel={t('selectAria', {
                              room: group.label,
                              price: fmtPrice(opt.priceMinor),
                            })}
                            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
                          >
                            {t('select')}
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>

                {group.rates.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.label)}
                    aria-expanded={isExpanded}
                    className="text-fg mt-2 text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {isExpanded ? t('hideRates') : t('viewRates', { count: group.rates.length })}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
