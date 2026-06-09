'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import type { SuggestionsFetcher } from '@/components/search/DestinationAutocomplete';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formatIsoDate, parseIsoDate } from '@/lib/search/url';
import type { ActivePanel, DateRangeState, Destination, HotelResult } from '@/lib/search/types';

import { DateRangePicker, nightsBetween, startOfDay } from './DateRangePicker';
import { DestinationAutocomplete } from './DestinationAutocomplete';
import { OccupancySelector } from './OccupancySelector';

const DESTINATION_INPUT_ID = 'hotel-search-destination';

type ErrorKey =
  | 'destinationRequired'
  | 'datesRequired'
  | 'datePast'
  | 'minNights'
  | 'adultsRequired'
  | 'roomsRequired';

export interface HotelSearchBarProps {
  readonly locale: Locale;
  /** Override the suggestion source (defaults to the live endpoint). */
  readonly fetchSuggestions?: SuggestionsFetcher;
}

const TRIGGER_FIELD =
  'sb-field w-full cursor-pointer text-left [font:inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--or)]';
const PANEL_HOST = 'sb-panel-host';
const PANEL =
  'sb-panel absolute left-0 top-full mt-2 rounded-lg border border-[rgba(43,39,34,0.12)] bg-white p-4';

/**
 * Orchestrator for the Lartisien-style hotel search bar, wired to the real
 * site: the autocomplete queries `/api/search/suggest`, and a valid search
 * navigates to the locale-aware `/recherche` results page with its native
 * params (`destination`, `checkIn`, `checkOut`, `adults`, `children`). Opens
 * at most one panel at a time, validates before navigating, and pre-fills
 * itself from the results URL on mount.
 */
export function HotelSearchBar({ locale, fetchSuggestions }: HotelSearchBarProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeState>({ from: null, to: null });
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  const barRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(barRef, () => setActivePanel(null), activePanel !== null);

  // Pre-fill from the results URL so a shared/reloaded link reopens with the
  // same criteria. State writes are deferred to a timeout to keep the mount
  // effect free of synchronous setState.
  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const dest = params.get('destination') ?? params.get('q');
      if (dest !== null && dest.trim().length > 0) {
        setQuery(dest);
      }
      const from = parseIsoDate(params.get('checkIn') ?? '');
      const to = parseIsoDate(params.get('checkOut') ?? '');
      if (from !== null && to !== null) {
        setDateRange({ from, to });
      }
      const adultsRaw = params.get('adults');
      if (adultsRaw !== null) {
        const parsed = Number.parseInt(adultsRaw, 10);
        if (Number.isFinite(parsed) && parsed >= 1) setAdults(parsed);
      }
      const childrenRaw = params.get('children');
      if (childrenRaw !== null) {
        const parsed = Number.parseInt(childrenRaw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) setChildrenCount(parsed);
      }
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  function openPanel(panel: Exclude<ActivePanel, null>): void {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function handleSelectDestination(next: Destination): void {
    setDestination(next);
    setQuery(next.label);
    setErrorKey(null);
    setActivePanel(null);
  }

  function handleSelectHotel(hotel: HotelResult): void {
    setDestination(hotel.cityDestination);
    setQuery(hotel.name);
    setErrorKey(null);
    setActivePanel(null);
  }

  function runSearch(freeText?: string): void {
    setErrorKey(null);

    const destinationText =
      freeText !== undefined && freeText.trim().length > 0
        ? freeText.trim()
        : query.trim().length > 0
          ? query.trim()
          : (destination?.label ?? '');

    if (destinationText.length === 0) {
      setActivePanel('dest');
      setErrorKey('destinationRequired');
      return;
    }

    const { from, to } = dateRange;
    if (from === null || to === null) {
      setActivePanel('dates');
      setErrorKey('datesRequired');
      return;
    }
    if (startOfDay(from).getTime() < startOfDay(new Date()).getTime()) {
      setActivePanel('dates');
      setErrorKey('datePast');
      return;
    }
    if (nightsBetween(from, to) < 1) {
      setActivePanel('dates');
      setErrorKey('minNights');
      return;
    }

    if (adults < 1) {
      setActivePanel('occ');
      setErrorKey('adultsRequired');
      return;
    }
    if (rooms < 1) {
      setActivePanel('occ');
      setErrorKey('roomsRequired');
      return;
    }

    router.push({
      pathname: '/recherche',
      query: {
        destination: destinationText,
        checkIn: formatIsoDate(from),
        checkOut: formatIsoDate(to),
        adults: String(adults),
        children: String(childrenCount),
      },
    });
  }

  const dateTag = locale === 'en' ? 'en-US' : 'fr-FR';
  const dayMonth = new Intl.DateTimeFormat(dateTag, { day: 'numeric', month: 'short' });
  const dayMonthYear = new Intl.DateTimeFormat(dateTag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const datesValue =
    dateRange.from !== null && dateRange.to !== null
      ? `${dayMonth.format(dateRange.from)} – ${dayMonthYear.format(dateRange.to)}`
      : t('datesPlaceholder');

  const guests =
    childrenCount > 0
      ? `${t('adults', { count: adults })}, ${t('children', { count: childrenCount })}`
      : t('adults', { count: adults });
  const occupancyValue = `${t('rooms', { count: rooms })} · ${guests}`;

  return (
    <div
      ref={barRef}
      role="search"
      aria-label={t('searchAria')}
      className={activePanel !== null ? 'search-bar search-bar--panels-open' : 'search-bar'}
    >
      <DestinationAutocomplete
        inputId={DESTINATION_INPUT_ID}
        locale={locale}
        query={query}
        isOpen={activePanel === 'dest'}
        onQueryChange={setQuery}
        onOpen={() => setActivePanel('dest')}
        onSelectDestination={handleSelectDestination}
        onSelectHotel={handleSelectHotel}
        onSeeAllResults={(text) => {
          setQuery(text);
          runSearch(text);
        }}
        {...(fetchSuggestions !== undefined ? { fetchSuggestions } : {})}
      />

      <div className={PANEL_HOST}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={activePanel === 'dates'}
          onClick={() => openPanel('dates')}
          className={TRIGGER_FIELD}
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v4M16 3v4" />
          </svg>
          <span className="sb-text">
            <span className="mb-0.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--or)]">
              {t('datesLabel')}
            </span>
            <span className="sb-val">{datesValue}</span>
          </span>
        </button>
        {activePanel === 'dates' ? (
          <div className={`${PANEL} hotel-search-calendar-panel w-[min(92vw,17rem)] p-3`}>
            <DateRangePicker
              locale={locale}
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                setErrorKey(null);
              }}
              onClear={() => setDateRange({ from: null, to: null })}
              onValidate={() => setActivePanel(null)}
            />
          </div>
        ) : null}
      </div>

      <div className={PANEL_HOST}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={activePanel === 'occ'}
          onClick={() => openPanel('occ')}
          className={TRIGGER_FIELD}
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 20c0-2.5-1-4.2-2.5-5.2" />
          </svg>
          <span className="sb-text">
            <span className="mb-0.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--or)]">
              {t('guestsLabel')}
            </span>
            <span className="sb-val">{occupancyValue}</span>
          </span>
        </button>
        {activePanel === 'occ' ? (
          <div className={`${PANEL} w-[min(92vw,18rem)]`}>
            <OccupancySelector
              rooms={rooms}
              adults={adults}
              childrenCount={childrenCount}
              onRoomsChange={(value) => setRooms(Math.max(1, value))}
              onAdultsChange={(value) => setAdults(Math.max(1, value))}
              onChildrenChange={(value) => setChildrenCount(Math.max(0, value))}
              onValidate={() => setActivePanel(null)}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => runSearch()}
        aria-label={t('submitAria')}
        className="btn btn-or search-go"
      >
        {t('submit')}
      </button>

      {errorKey !== null ? (
        <p
          role="alert"
          aria-live="assertive"
          className="col-span-full border-t border-[rgba(43,39,34,0.1)] px-5 py-2 text-sm text-[#b3261e]"
        >
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
    </div>
  );
}
