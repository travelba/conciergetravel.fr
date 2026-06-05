'use client';

import { HotelImage } from '@mch/ui';
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
  readonly nights: number;
  /** Cloudinary cloud name forwarded by the server page for `<HotelImage>`. */
  readonly cloudName: string;
  /** Photo éditoriale (hero) par libellé de chambre Travelport, si rapprochée. */
  readonly imagesByLabel: Readonly<
    Record<string, { readonly publicId: string; readonly alt: string }>
  >;
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
  nights,
  cloudName,
  imagesByLabel,
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

  const perNight = (minor: number): string => fmtPrice(Math.round(minor / Math.max(1, nights)));

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
      <fieldset className="mb-6 flex flex-wrap items-center gap-2">
        <legend className="text-muted mr-1 inline text-xs uppercase tracking-wide">
          {t('filters.title')}
        </legend>
        <label
          className={[
            'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            breakfastOnly
              ? 'border-gold-400 bg-gold-50 text-gold-900'
              : 'border-border text-fg hover:bg-muted/5',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={breakfastOnly}
            onChange={(e) => setBreakfastOnly(e.target.checked)}
            className="sr-only"
          />
          <span aria-hidden>{breakfastOnly ? '✓' : '+'}</span>
          {t('filters.breakfast')}
        </label>
        <label
          className={[
            'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            refundableOnly
              ? 'border-gold-400 bg-gold-50 text-gold-900'
              : 'border-border text-fg hover:bg-muted/5',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={refundableOnly}
            onChange={(e) => setRefundableOnly(e.target.checked)}
            className="sr-only"
          />
          <span aria-hidden>{refundableOnly ? '✓' : '+'}</span>
          {t('filters.refundable')}
        </label>
      </fieldset>

      {groups.length === 0 ? (
        <p className="text-muted text-sm" role="status">
          {t('noMatch')}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {groups.map((group) => {
            const isExpanded = expanded.has(group.label);
            const visibleRates = isExpanded ? group.rates : group.rates.slice(0, 1);
            const cheapest = group.rates[0];
            const image = imagesByLabel[group.label];
            return (
              <li
                key={group.label}
                className="border-border bg-bg shadow-card overflow-hidden rounded-2xl border"
                data-room-group
              >
                {image !== undefined ? (
                  <div className="relative aspect-[21/9] w-full overflow-hidden">
                    <HotelImage
                      cloudName={cloudName}
                      publicId={image.publicId}
                      alt={image.alt}
                      variant="card"
                      width={768}
                      height={329}
                      sizes="(max-width: 768px) 100vw, 640px"
                      className="h-full w-full"
                    />
                  </div>
                ) : null}
                <div className="border-border from-gold-50/60 to-bg flex flex-wrap items-baseline justify-between gap-2 border-b bg-gradient-to-r px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-fg font-serif text-xl leading-snug">{group.label}</h2>
                    {group.maxOccupancy !== null ? (
                      <p className="text-muted mt-0.5 text-xs">
                        {t('upToGuests', { count: group.maxOccupancy })}
                      </p>
                    ) : null}
                  </div>
                  {cheapest !== undefined ? (
                    <p className="text-gold-700 shrink-0 text-xs font-medium">
                      {t('from', { price: fmtPrice(cheapest.priceMinor) })}
                    </p>
                  ) : null}
                </div>

                <ul className="divide-border flex flex-col divide-y px-5">
                  {visibleRates.map((opt) => (
                    <li
                      key={opt.rateKey}
                      className="flex flex-wrap items-start justify-between gap-4 py-4"
                      data-room-option
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-fg text-sm font-medium">{opt.rateLabel}</p>
                        <ul className="mt-2 flex flex-wrap items-center gap-1.5">
                          {opt.breakfastIncluded === true ? (
                            <li className="bg-gold-50 text-gold-800 border-gold-200 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                              {t('breakfastIncluded')}
                            </li>
                          ) : null}
                          {opt.refundable === true ? (
                            <li className="bg-gold-50 text-gold-800 border-gold-200 rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                              {t('refundable')}
                            </li>
                          ) : opt.refundable === false ? (
                            <li className="text-muted border-border rounded-full border px-2.5 py-0.5 text-[11px]">
                              {t('nonRefundable')}
                            </li>
                          ) : null}
                        </ul>
                        {opt.cancellationText !== '' ? (
                          <p className="text-muted/80 mt-2 max-w-prose text-xs leading-relaxed">
                            {opt.cancellationText}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <p className="text-fg font-serif text-2xl leading-none">
                          {fmtPrice(opt.priceMinor)}
                        </p>
                        <p className="text-muted text-xs">{t('totalStay')}</p>
                        <p className="text-muted/80 text-[11px]">
                          {t('perNightFrom', { price: perNight(opt.priceMinor) })}
                        </p>
                        <form action={selectAction} className="mt-1.5">
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
                            className="bg-gold text-charcoal hover:bg-gold-600 focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70"
                          >
                            {t('select')}
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>

                {group.rates.length > 1 ? (
                  <div className="px-5 pb-4">
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.label)}
                      aria-expanded={isExpanded}
                      className="text-gold-700 hover:text-gold-800 text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {isExpanded ? t('hideRates') : t('viewRates', { count: group.rates.length })}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
