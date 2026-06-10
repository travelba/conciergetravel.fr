'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type ReactElement } from 'react';

import { DateRangePicker, nightsBetween, startOfDay } from '@/components/search/DateRangePicker';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { Locale } from '@/i18n/routing';
import type { SupportedLocale } from '@/i18n/supported-locale';
import { formatIsoDate, parseIsoDate } from '@/lib/search/url';
import type { DateRangeState } from '@/lib/search/types';

function addDayIso(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

export interface BookingKitStayDatesProps {
  readonly locale: SupportedLocale;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly today: string;
  readonly onChange: (checkIn: string, checkOut: string) => void;
}

function CalendarIcon(): ReactElement {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  );
}

function dayPickerLocale(locale: SupportedLocale): Locale {
  if (locale === 'fr' || locale === 'en') return locale;
  return 'en';
}

/**
 * Kit booking rail date range — same react-day-picker popover as the homepage
 * hero (`HotelSearchBar`), styled for `.resa-form`.
 */
export function BookingKitStayDates({
  locale,
  checkIn,
  checkOut,
  today,
  onChange,
}: BookingKitStayDatesProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(hostRef, () => setOpen(false), open);

  const from = parseIsoDate(checkIn);
  const to = parseIsoDate(checkOut);
  const dateRange: DateRangeState = { from, to };

  const dateTag = dayPickerLocale(locale) === 'en' ? 'en-US' : 'fr-FR';
  const dayMonth = new Intl.DateTimeFormat(dateTag, { day: 'numeric', month: 'short' });
  const dayMonthYear = new Intl.DateTimeFormat(dateTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const datesValue =
    from !== null && to !== null
      ? `${dayMonth.format(from)} – ${dayMonthYear.format(to)}`
      : t('datesPlaceholder');

  const handleRangeChange = (range: DateRangeState): void => {
    if (range.from === null) return;
    const nextIn = formatIsoDate(range.from);
    let nextOut: string;
    if (range.to !== null && nightsBetween(range.from, range.to) >= 1) {
      nextOut = formatIsoDate(range.to);
    } else {
      nextOut = checkOut > nextIn ? checkOut : addDayIso(nextIn);
    }
    onChange(nextIn, nextOut);
  };

  const handleClear = (): void => {
    const minIn = today;
    onChange(minIn, addDayIso(minIn));
  };

  const handleValidate = (): void => {
    if (from === null || to === null) return;
    if (nightsBetween(from, to) < 1) return;
    if (startOfDay(from).getTime() < startOfDay(new Date()).getTime()) return;
    setOpen(false);
  };

  return (
    <>
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <div ref={hostRef} className="rf-field-host">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="rf-field rf-field--trigger"
        >
          <CalendarIcon />
          <span className="rf-field-body">
            <span>{t('datesLabel')}</span>
            <span className="rf-val">{datesValue}</span>
          </span>
        </button>
        {open ? (
          <div className="sb-panel hotel-search-calendar-panel">
            <DateRangePicker
              locale={dayPickerLocale(locale)}
              value={dateRange}
              onChange={handleRangeChange}
              onClear={handleClear}
              onValidate={handleValidate}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
