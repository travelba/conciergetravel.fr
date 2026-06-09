'use client';

import 'react-day-picker/style.css';

import { useTranslations } from 'next-intl';
import { DayPicker, type DateRange } from 'react-day-picker';
import { useEffect, useState, type ReactElement } from 'react';

import type { DateRangeState } from '@/lib/search/types';

const TWO_MONTH_MIN_WIDTH = '(min-width: 768px)';

const MS_PER_DAY = 86_400_000;

/** Strip the time component, returning local midnight of `date`. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Number of nights between two days (0 when same day or reversed). */
export function nightsBetween(from: Date, to: Date): number {
  const diff = startOfDay(to).getTime() - startOfDay(from).getTime();
  if (diff <= 0) return 0;
  return Math.round(diff / MS_PER_DAY);
}

export interface DateRangePickerProps {
  readonly value: DateRangeState;
  readonly onChange: (range: DateRangeState) => void;
  /** "Annuler les dates" — resets to `{ from: null, to: null }`. */
  readonly onClear: () => void;
  /** Optional explicit confirm (e.g. close the panel). */
  readonly onValidate?: () => void;
}

function toDateRange(state: DateRangeState): DateRange | undefined {
  if (state.from === null) return undefined;
  return state.to === null ? { from: state.from } : { from: state.from, to: state.to };
}

/**
 * Range date picker rendering two months, weeks starting Monday, with past
 * days disabled. `react-day-picker` owns the range-selection logic (1st
 * click = from, 2nd = to, clicking before `from` redefines it); we mirror
 * its result into the parent's `{ from, to }` state and derive the nights
 * count for display.
 */
export function DateRangePicker({
  value,
  onChange,
  onClear,
  onValidate,
}: DateRangePickerProps): ReactElement {
  const t = useTranslations('hotelSearchBar');

  // Responsive month count: 1 on mobile, 2 side-by-side from `md`. The panel
  // only renders after a click, so `window` is always defined for the lazy
  // initial read; the effect just tracks viewport changes afterwards.
  const [months, setMonths] = useState<1 | 2>(() =>
    typeof window !== 'undefined' && window.matchMedia(TWO_MONTH_MIN_WIDTH).matches ? 2 : 1,
  );
  useEffect(() => {
    const mq = window.matchMedia(TWO_MONTH_MIN_WIDTH);
    const onChange = (event: MediaQueryListEvent): void => setMonths(event.matches ? 2 : 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const today = startOfDay(new Date());
  const selected = toDateRange(value);
  const nights = value.from !== null && value.to !== null ? nightsBetween(value.from, value.to) : 0;

  function handleSelect(range: DateRange | undefined): void {
    if (range === undefined) {
      onChange({ from: null, to: null });
      return;
    }
    onChange({ from: range.from ?? null, to: range.to ?? null });
  }

  return (
    <div role="group" aria-label={t('calendarLabel')} className="text-[color:var(--texte)]">
      <DayPicker
        mode="range"
        numberOfMonths={months}
        weekStartsOn={1}
        disabled={{ before: today }}
        selected={selected}
        onSelect={handleSelect}
      />

      <div className="mt-2 flex items-center justify-between gap-4 border-t border-[rgba(43,39,34,0.1)] pt-3">
        <p aria-live="polite" className="text-sm text-[color:var(--texte)]">
          {nights > 0 ? t('nights', { count: nights }) : t('datesHint')}
        </p>
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-[color:var(--texte)] underline underline-offset-2 hover:text-[color:var(--or)]"
          >
            {t('clearDates')}
          </button>
          {onValidate !== undefined ? (
            <button
              type="button"
              onClick={onValidate}
              disabled={nights < 1}
              className="rounded-md bg-[color:var(--noir)] px-4 py-2 text-sm text-[#f6f1e7] hover:bg-[color:var(--anthracite)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('validateDates')}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
