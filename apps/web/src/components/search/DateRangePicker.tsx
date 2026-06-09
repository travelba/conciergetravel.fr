'use client';

import 'react-day-picker/style.css';

import { useTranslations } from 'next-intl';
import { DayPicker, type DateRange } from 'react-day-picker';
import { type ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';
import { getDayPickerLocale } from '@/lib/search/day-picker-locale';
import type { DateRangeState } from '@/lib/search/types';

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
  readonly locale: Locale;
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
 * Compact range picker for the hero search bar — one month, small day cells,
 * weeks starting Monday, past days disabled.
 */
export function DateRangePicker({
  locale,
  value,
  onChange,
  onClear,
  onValidate,
}: DateRangePickerProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  const dayPickerLocale = getDayPickerLocale(locale);

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
    <div
      role="group"
      aria-label={t('calendarLabel')}
      className="hotel-search-calendar text-[color:var(--texte)]"
    >
      <DayPicker
        mode="range"
        locale={dayPickerLocale}
        lang={locale}
        numberOfMonths={1}
        weekStartsOn={1}
        disabled={{ before: today }}
        selected={selected}
        onSelect={handleSelect}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(43,39,34,0.1)] pt-2">
        <p aria-live="polite" className="text-xs text-[color:var(--texte)]">
          {nights > 0 ? t('nights', { count: nights }) : t('datesHint')}
        </p>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[color:var(--texte)] underline underline-offset-2 hover:text-[color:var(--or)]"
          >
            {t('clearDates')}
          </button>
          {onValidate !== undefined ? (
            <button
              type="button"
              onClick={onValidate}
              disabled={nights < 1}
              className="rounded-md bg-[color:var(--noir)] px-3 py-1.5 text-xs text-[#f6f1e7] hover:bg-[color:var(--anthracite)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('validateDates')}
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
