'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactElement, type KeyboardEvent } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * `<SearchAutocomplete>` — progressive-enhancement client island that
 * upgrades a plain `<input name="destination">` into an Algolia-backed
 * combobox (skill: search-engineering, accessibility §combobox).
 *
 * Design contract:
 *   - Renders the SAME named input the parent `<form method="get">`
 *     already submitted to `/recherche`. Without JS (or before
 *     hydration) the native form still works — typing + Enter posts
 *     `?destination=…`. The dropdown is pure enhancement.
 *   - Suggestions come from `GET /api/search/suggest` (hotels + cities).
 *     The endpoint computes locale-aware hrefs server-side, so a click /
 *     Enter on a suggestion deep-links straight to the hotel fiche or
 *     the destination hub — bypassing the empty-result round-trip.
 *   - Full keyboard support: ↓/↑ move the active option,
 *     Enter on an active option navigates, Enter on free text submits
 *     the form, Esc closes. ARIA combobox + listbox + aria-activedescendant.
 *   - Degrades silently: any fetch error / empty payload just hides the
 *     dropdown (never throws, never blocks the native submit).
 */

interface HotelSuggestion {
  readonly objectID: string;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly href: string;
  readonly is_palace: boolean;
  readonly stars: number;
}

interface CitySuggestion {
  readonly objectID: string;
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly href: string;
  readonly hotels_count: number;
}

interface CountrySuggestion {
  readonly code: string;
  readonly name: string;
  readonly href: string;
  readonly hotels_count: number;
}

interface FlatOption {
  readonly kind: 'city' | 'country' | 'hotel';
  readonly key: string;
  readonly domId: string;
  readonly href: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseHotels(raw: unknown): HotelSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: HotelSuggestion[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const objectID = asString(item['objectID']);
    const name = asString(item['name']);
    const href = asString(item['href']);
    if (objectID === undefined || name === undefined || href === undefined) continue;
    out.push({
      objectID,
      name,
      city: asString(item['city']) ?? '',
      region: asString(item['region']) ?? '',
      country: asString(item['country']) ?? '',
      href,
      is_palace: item['is_palace'] === true,
      stars: typeof item['stars'] === 'number' ? item['stars'] : 0,
    });
  }
  return out;
}

function parseCities(raw: unknown): CitySuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CitySuggestion[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const objectID = asString(item['objectID']);
    const name = asString(item['name']);
    const href = asString(item['href']);
    if (objectID === undefined || name === undefined || href === undefined) continue;
    out.push({
      objectID,
      name,
      region: asString(item['region']) ?? '',
      country: asString(item['country']) ?? '',
      href,
      hotels_count: typeof item['hotels_count'] === 'number' ? item['hotels_count'] : 0,
    });
  }
  return out;
}

function parseCountries(raw: unknown): CountrySuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CountrySuggestion[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const code = asString(item['code']);
    const name = asString(item['name']);
    const href = asString(item['href']);
    if (code === undefined || name === undefined || href === undefined) continue;
    out.push({
      code,
      name,
      href,
      hotels_count: typeof item['hotels_count'] === 'number' ? item['hotels_count'] : 0,
    });
  }
  return out;
}

export function SearchAutocomplete({
  locale,
  inputId,
  placeholder,
  inputClassName,
  wrapperClassName = 'relative w-full',
  inputName = 'destination',
  defaultValue = '',
  ariaLabel,
}: {
  readonly locale: Locale;
  readonly inputId: string;
  readonly placeholder: string;
  readonly inputClassName: string;
  readonly wrapperClassName?: string;
  readonly inputName?: string;
  readonly defaultValue?: string;
  readonly ariaLabel?: string;
}): ReactElement {
  const t = useTranslations('searchAutocomplete');

  const [query, setQuery] = useState(defaultValue);
  // `dismissed` tracks an explicit close (Escape / outside-click / Tab /
  // navigation). The dropdown's open state is *derived* from results +
  // query length + this flag — keeping the fetch effect free of any
  // synchronous setState (react-hooks/set-state-in-effect).
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<readonly HotelSuggestion[]>([]);
  const [cities, setCities] = useState<readonly CitySuggestion[]>([]);
  const [countries, setCountries] = useState<readonly CountrySuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  // Flattened option order: cities → countries → hotels — mirrors the
  // visual order so arrow-key navigation matches what the user sees
  // (broad destination context first, the specific property last).
  const options: FlatOption[] = [
    ...cities.map((c, i) => ({
      kind: 'city' as const,
      key: `city-${c.objectID}`,
      domId: `${reactId}-opt-city-${i}`,
      href: c.href,
    })),
    ...countries.map((c, i) => ({
      kind: 'country' as const,
      key: `country-${c.code}`,
      domId: `${reactId}-opt-country-${i}`,
      href: c.href,
    })),
    ...hotels.map((h, i) => ({
      kind: 'hotel' as const,
      key: `hotel-${h.objectID}`,
      domId: `${reactId}-opt-hotel-${i}`,
      href: h.href,
    })),
  ];
  const hasResults = options.length > 0;
  const isOpen = !dismissed && hasResults && query.trim().length >= MIN_CHARS;

  // Debounced suggest fetch with in-flight cancellation. All state writes
  // happen inside the async setTimeout / promise callbacks (never in the
  // synchronous effect body), so results clear naturally on the next
  // successful fetch and the display gates on `isOpen` in the meantime.
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_CHARS) {
      return undefined;
    }

    const controller = new AbortController();
    const handle = setTimeout(() => {
      setLoading(true);
      const url = `/api/search/suggest?q=${encodeURIComponent(term)}&locale=${locale}&hotels=6&cities=4&countries=3`;
      fetch(url, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: unknown) => {
          if (json === null || !isRecord(json) || json['ok'] !== true) {
            setHotels([]);
            setCities([]);
            setCountries([]);
            return;
          }
          setHotels(parseHotels(json['hotels']));
          setCities(parseCities(json['cities']));
          setCountries(parseCountries(json['countries']));
          setActiveIndex(-1);
        })
        .catch(() => {
          // Aborted or network error — silently keep the native form.
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, locale]);

  // Close on outside click (mousedown fires before input blur, so option
  // clicks are not swallowed).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (ev: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(ev.target as Node)) {
        setDismissed(true);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  // Options are real anchors (`<a href>`): navigation is a normal browser
  // navigation (cmd/ctrl-click opens a new tab, links are crawlable, and
  // the URL updates even if the destination errors). Keyboard selection
  // follows the active anchor's href by triggering its click.
  function followActiveOption(): void {
    const target = options[activeIndex];
    if (target === undefined) return;
    const el = wrapperRef.current?.querySelector<HTMLAnchorElement>(`#${CSS.escape(target.domId)}`);
    el?.click();
  }

  function onKeyDown(ev: KeyboardEvent<HTMLInputElement>): void {
    if (ev.key === 'Escape') {
      setDismissed(true);
      setActiveIndex(-1);
      return;
    }
    if (!isOpen) {
      // Let Enter submit the native form (free-text search).
      return;
    }
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < options.length) {
          ev.preventDefault();
          followActiveOption();
        }
        // Otherwise fall through: the form submits the free-text query.
        break;
      case 'Tab':
        setDismissed(true);
        break;
      default:
        break;
    }
  }

  const activeDescendant =
    isOpen && activeIndex >= 0 && activeIndex < options.length
      ? options[activeIndex]?.domId
      : undefined;

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      <input
        id={inputId}
        type="search"
        name={inputName}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setDismissed(false)}
        className={inputClassName}
      />

      {/* Screen-reader status — announces the result count without
          stealing focus (accessibility §live regions). */}
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? t('loading') : isOpen ? t('resultsCount', { count: options.length }) : ''}
      </span>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t('listboxLabel')}
          className="border-border bg-bg shadow-card absolute left-0 top-full z-50 mt-1 max-h-[min(70vh,28rem)] w-max min-w-full max-w-[min(92vw,30rem)] overflow-y-auto rounded-md border py-1 text-left"
        >
          {cities.length > 0 ? (
            <div role="group" aria-label={t('groupDestinations')}>
              <p
                role="presentation"
                className="text-muted px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider"
              >
                {t('groupDestinations')}
              </p>
              {cities.map((c, i) => {
                const flatIndex = i;
                const isActive = activeIndex === flatIndex;
                const place = [c.region, c.country].filter((s) => s.length > 0).join(' · ');
                return (
                  <a
                    key={`city-${c.objectID}`}
                    id={`${reactId}-opt-city-${i}`}
                    href={c.href}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm no-underline ${
                      isActive ? 'bg-muted/15' : ''
                    }`}
                  >
                    <CityIcon />
                    <span className="text-fg min-w-0 truncate font-medium">{c.name}</span>
                    {place.length > 0 ? (
                      <span className="text-muted truncate text-xs">{place}</span>
                    ) : null}
                    {c.hotels_count > 0 ? (
                      <span className="text-muted ml-auto shrink-0 text-xs">
                        {t('hotelsCount', { count: c.hotels_count })}
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          ) : null}

          {countries.length > 0 ? (
            <div role="group" aria-label={t('groupCountries')}>
              <p
                role="presentation"
                className="text-muted px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider"
              >
                {t('groupCountries')}
              </p>
              {countries.map((c, i) => {
                const flatIndex = cities.length + i;
                const isActive = activeIndex === flatIndex;
                return (
                  <a
                    key={`country-${c.code}`}
                    id={`${reactId}-opt-country-${i}`}
                    href={c.href}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm no-underline ${
                      isActive ? 'bg-muted/15' : ''
                    }`}
                  >
                    <CountryIcon />
                    <span className="text-fg min-w-0 truncate font-medium">{c.name}</span>
                    {c.hotels_count > 0 ? (
                      <span className="text-muted ml-auto shrink-0 text-xs">
                        {t('hotelsCount', { count: c.hotels_count })}
                      </span>
                    ) : null}
                  </a>
                );
              })}
            </div>
          ) : null}

          {hotels.length > 0 ? (
            <div role="group" aria-label={t('groupHotels')}>
              <p
                role="presentation"
                className="text-muted px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider"
              >
                {t('groupHotels')}
              </p>
              {hotels.map((h, i) => {
                const flatIndex = cities.length + countries.length + i;
                const isActive = activeIndex === flatIndex;
                const place = [h.city, h.country].filter((s) => s.length > 0).join(' · ');
                return (
                  <a
                    key={`hotel-${h.objectID}`}
                    id={`${reactId}-opt-hotel-${i}`}
                    href={h.href}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm no-underline ${
                      isActive ? 'bg-muted/15' : ''
                    }`}
                  >
                    <HotelIcon />
                    <span className="text-fg min-w-0 truncate font-medium">{h.name}</span>
                    <span className="text-muted ml-auto shrink-0 text-xs">
                      {h.is_palace ? t('palace') : h.stars > 0 ? `${h.stars}★` : ''}
                      {place.length > 0 ? ` · ${place}` : ''}
                    </span>
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CityIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="text-muted h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 17s5-4.5 5-8.5A5 5 0 0 0 5 8.5C5 12.5 10 17 10 17z" />
      <circle cx="10" cy="8.5" r="1.8" />
    </svg>
  );
}

function CountryIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="text-muted h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.25" />
      <path d="M2.75 10h14.5M10 2.75c2 2.2 2 12.3 0 14.5M10 2.75c-2 2.2-2 12.3 0 14.5" />
    </svg>
  );
}

function HotelIcon(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="text-muted h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="4" width="14" height="13" rx="1" />
      <path d="M7 8h2m2 0h2M7 11h2m2 0h2M9 17v-3h2v3" strokeLinecap="round" />
    </svg>
  );
}
