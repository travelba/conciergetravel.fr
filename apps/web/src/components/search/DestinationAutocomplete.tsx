'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState, type KeyboardEvent, type ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';
import { fetchSearchSuggestions, type Suggestions } from '@/lib/search/suggest-client';
import type { Destination, HotelResult } from '@/lib/search/types';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/** Signature of the suggestion source (live endpoint by default; injectable
 * for tests / Storybook / the local mock stubs). */
export type SuggestionsFetcher = (
  query: string,
  locale: Locale,
  signal?: AbortSignal,
) => Promise<Suggestions>;

export interface DestinationAutocompleteProps {
  readonly inputId: string;
  readonly locale: Locale;
  readonly query: string;
  readonly isOpen: boolean;
  readonly onQueryChange: (value: string) => void;
  readonly onOpen: () => void;
  readonly onSelectDestination: (destination: Destination) => void;
  readonly onSelectHotel: (hotel: HotelResult) => void;
  /** "Voir tous les résultats" — run the search with the current text. */
  readonly onSeeAllResults: (text: string) => void;
  /** Override the suggestion source (defaults to the live endpoint). */
  readonly fetchSuggestions?: SuggestionsFetcher;
}

type FlatOption =
  | { readonly kind: 'destination'; readonly destination: Destination }
  | { readonly kind: 'hotel'; readonly hotel: HotelResult }
  | { readonly kind: 'all' };

const OPTION_BASE =
  'flex cursor-pointer items-center gap-2 px-4 py-2 text-sm text-[color:var(--texte)]';

/**
 * Destination autocomplete: debounced (250 ms, ≥ 2 chars) lookup against the
 * live `/api/search/suggest` endpoint with stale-request cancellation.
 * Selecting a destination sets it; selecting a hotel sets the destination to
 * the hotel's city (handled by the parent). The footer action runs a
 * free-text search.
 */
export function DestinationAutocomplete({
  inputId,
  locale,
  query,
  isOpen,
  onQueryChange,
  onOpen,
  onSelectDestination,
  onSelectHotel,
  onSeeAllResults,
  fetchSuggestions = fetchSearchSuggestions,
}: DestinationAutocompleteProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  const [destinations, setDestinations] = useState<readonly Destination[]>([]);
  const [hotels, setHotels] = useState<readonly HotelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const term = query.trim();
  const hasTerm = term.length >= MIN_CHARS;

  // Debounced fetch against the live endpoint. All state writes live inside
  // async callbacks (never the synchronous effect body) and a per-run
  // AbortController drops stale responses (react-hooks/set-state-in-effect
  // compliant).
  useEffect(() => {
    if (term.length < MIN_CHARS) {
      return undefined;
    }
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoading(true);
      fetchSuggestions(term, locale, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setDestinations(result.destinations);
          setHotels(result.hotels);
          setActiveIndex(-1);
        })
        .catch(() => {
          // Aborted (stale) or error — keep the last good results.
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [term, locale, fetchSuggestions]);

  const options: FlatOption[] = hasTerm
    ? [
        ...destinations.map((destination): FlatOption => ({ kind: 'destination', destination })),
        ...hotels.map((hotel): FlatOption => ({ kind: 'hotel', hotel })),
        { kind: 'all' },
      ]
    : [];

  const showNoResults = hasTerm && !loading && destinations.length === 0 && hotels.length === 0;

  function commitOption(option: FlatOption): void {
    switch (option.kind) {
      case 'destination':
        onSelectDestination(option.destination);
        break;
      case 'hotel':
        onSelectHotel(option.hotel);
        break;
      case 'all':
        onSeeAllResults(query);
        break;
      default: {
        const exhaustive: never = option;
        return exhaustive;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen || options.length === 0) {
      if (event.key === 'Enter' && hasTerm) {
        event.preventDefault();
        onSeeAllResults(query);
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const target = activeIndex >= 0 ? options[activeIndex] : undefined;
        commitOption(target ?? { kind: 'all' });
        break;
      }
      default:
        break;
    }
  }

  const dropdownOpen = isOpen && hasTerm;

  return (
    <div className="sb-field" style={{ position: 'relative' }}>
      <svg className="icon" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 21s-7-5.3-7-11a7 7 0 0 1 14 0c0 5.7-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
      <span className="sb-text">
        <label htmlFor={inputId}>{t('destinationLabel')}</label>
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={t('comboboxLabel')}
          autoComplete="off"
          className="sb-val"
          value={query}
          placeholder={t('destinationPlaceholder')}
          onChange={(event) => {
            onQueryChange(event.target.value);
            onOpen();
          }}
          onFocus={onOpen}
          onKeyDown={onKeyDown}
        />
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {loading ? t('loading') : ''}
      </span>

      {dropdownOpen ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('listboxLabel')}
          className="absolute left-0 top-full z-50 mt-2 max-h-[min(60vh,22rem)] w-[min(92vw,24rem)] overflow-y-auto rounded-lg border border-[rgba(43,39,34,0.12)] bg-white py-1 shadow-[var(--shadow)]"
        >
          {loading && destinations.length === 0 && hotels.length === 0 ? (
            <li role="presentation" className="px-4 py-2 text-sm text-[#9a9384]">
              {t('loading')}
            </li>
          ) : null}

          {showNoResults ? (
            <li role="presentation" className="px-4 py-2 text-sm text-[#9a9384]">
              {t('noResults')}
            </li>
          ) : null}

          {destinations.map((destination, index) => {
            const optionIndex = index;
            const active = activeIndex === optionIndex;
            return (
              <li
                key={`destination-${destination.id}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onClick={() => onSelectDestination(destination)}
                className={active ? `${OPTION_BASE} bg-[rgba(43,39,34,0.06)]` : OPTION_BASE}
              >
                <span className="font-medium">{destination.label}</span>
                <span className="text-xs text-[#9a9384]">{destination.type}</span>
              </li>
            );
          })}

          {hotels.map((hotel, index) => {
            const optionIndex = destinations.length + index;
            const active = activeIndex === optionIndex;
            const place = [hotel.city, hotel.country].filter((s) => s.length > 0).join(', ');
            return (
              <li
                key={`hotel-${hotel.id}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                onClick={() => onSelectHotel(hotel)}
                className={active ? `${OPTION_BASE} bg-[rgba(43,39,34,0.06)]` : OPTION_BASE}
              >
                <span className="min-w-0 truncate font-medium">{hotel.name}</span>
                {place.length > 0 ? (
                  <span className="truncate text-xs text-[#9a9384]">{place}</span>
                ) : null}
              </li>
            );
          })}

          <li
            role="option"
            aria-selected={activeIndex === options.length - 1}
            onMouseEnter={() => setActiveIndex(options.length - 1)}
            onClick={() => onSeeAllResults(query)}
            className={
              activeIndex === options.length - 1
                ? `${OPTION_BASE} border-t border-[rgba(43,39,34,0.1)] bg-[rgba(43,39,34,0.06)] text-[color:var(--or)]`
                : `${OPTION_BASE} border-t border-[rgba(43,39,34,0.1)] text-[color:var(--or)]`
            }
          >
            {t('seeAll', { query: term })}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
