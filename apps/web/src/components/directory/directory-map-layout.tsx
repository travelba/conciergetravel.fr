'use client';

import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  emptyDirectorySelection,
  isEmptySelection,
  matchesDirectoryFilters,
  type DirectoryFacets,
  type DirectorySelection,
} from './filter-logic';
import { DirectoryMapboxCanvas, type DirectoryMapboxApi } from './directory-mapbox-canvas';

/**
 * A single geolocated hotel to plot on the directory map. Built on the
 * server (the `url` is the locale-aware fiche path) and passed down to
 * this client island. Only hotels with non-null coordinates are sent.
 */
export interface DirectoryMapPoint {
  readonly id: string;
  readonly name: string;
  /** Locale-aware path to the hotel fiche (`/fr/hotel/<slug>`). */
  readonly url: string;
  readonly lat: number;
  readonly lng: number;
  readonly isPalace: boolean;
}

export interface DirectoryMapLabels {
  /** Mobile button: reveal the map. */
  readonly toggleShow: string;
  /** Mobile button: back to the list. */
  readonly toggleHide: string;
  /** Accessible name for the map region. */
  readonly ariaLabel: string;
  /** "Voir la fiche" link inside a marker popup. */
  readonly popupView: string;
  /** Pre-formatted "N sur M hôtels localisés" note. */
  readonly geocodedNote: string;
}

export type DirectorySortKey = 'recommended' | 'name-asc' | 'name-desc';

interface DirectoryMapLayoutProps {
  /** Geolocated hotels only (lat/lng guaranteed non-null). */
  readonly points: readonly DirectoryMapPoint[];
  /** Enable marker clustering — used on country views (hundreds of pins). */
  readonly cluster?: boolean;
  readonly labels: DirectoryMapLabels;
  /** Filter facets computed server-side from the rendered hotel set. */
  readonly facets: DirectoryFacets;
  /** Total hotels rendered (drives the initial result count). */
  readonly totalCount: number;
  /** Which place facet the rail exposes — `district` (city) / `city` (country). */
  readonly placeKey: 'district' | 'city';
  /**
   * Grouped layout (country page = one `<section>` per city). Disables the
   * name sort (the grouping is the order) and hides sections whose hotels
   * are all filtered out.
   */
  readonly grouped?: boolean;
  /** The server-rendered, fully indexable hotel list. */
  readonly children: ReactNode;
}

const ACTIVE_CARD_CLASS = 'mch-directory-card--active';

/** Read the filter subject from a card's `data-*` attributes. */
function subjectFromCard(
  card: HTMLElement,
  placeKey: 'district' | 'city',
): {
  stars: number;
  isPalace: boolean;
  brandSlug: string | null;
  place: string | null;
} {
  const ds = card.dataset;
  const placeRaw = placeKey === 'district' ? (ds['district'] ?? '') : (ds['city'] ?? '');
  const brand = ds['brand'] ?? '';
  return {
    stars: Number.parseInt(ds['stars'] ?? '0', 10),
    isPalace: ds['palace'] === '1',
    brandSlug: brand.length > 0 ? brand : null,
    place: placeRaw.length > 0 ? placeRaw : null,
  };
}

/**
 * `<DirectoryMapLayout>` — Booking-style filter rail + result list +
 * interactive map for the hotel directory (ADR-0026).
 *
 * SEO contract: the hotel list (`children`) is a Server Component
 * rendered into the SSR HTML, so crawlers and LLMs see the full,
 * indexable directory regardless of JS. Filtering and sorting operate
 * **on that SSR DOM** (toggling `hidden` / reordering `<li>`) so no
 * content is client-rendered — the canonical state is "all hotels
 * visible". The Mapbox GL map is a pure client enhancement (own chunk,
 * off the critical path) with pins tinted to the editorial kit palette.
 *
 * Bidirectional sync: hovering / focusing a list card highlights its
 * pin; clicking a pin opens a popup and scrolls the matching card into
 * view. Selecting filters hides non-matching cards, updates the live
 * result count and re-plots / re-fits the map to the visible subset.
 */
export function DirectoryMapLayout({
  points,
  cluster = false,
  labels,
  facets,
  totalCount,
  placeKey,
  grouped = false,
  children,
}: DirectoryMapLayoutProps): ReactElement {
  const t = useTranslations('directoryPage');
  const listRef = useRef<HTMLDivElement | null>(null);
  const mapApiRef = useRef<DirectoryMapboxApi | null>(null);
  const originalOrderRef = useRef<HTMLElement[] | null>(null);
  const applyRef = useRef<() => void>(() => {});

  const [showMap, setShowMap] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selection, setSelection] = useState<DirectorySelection>(emptyDirectorySelection());
  const [sort, setSort] = useState<DirectorySortKey>('recommended');
  const [visibleCount, setVisibleCount] = useState(totalCount);
  const regionId = useId();

  const hasPoints = points.length > 0;
  const canSort = !grouped;

  // ── Filter + sort the SSR DOM, then re-plot the visible markers ──────────
  const applyFiltersAndSort = useCallback((): void => {
    const list = listRef.current;
    if (list === null) return;

    const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-hotel-id]'));
    const visibleIds = new Set<string>();
    let count = 0;

    for (const card of cards) {
      const match = matchesDirectoryFilters(subjectFromCard(card, placeKey), selection);
      const li = card.closest<HTMLElement>('li') ?? card;
      li.hidden = !match;
      if (match) {
        count += 1;
        const id = card.getAttribute('data-hotel-id');
        if (id !== null) visibleIds.add(id);
      }
    }
    setVisibleCount(count);

    // Grouped (country) — hide a city section once all its cards are out,
    // and collapse the "jump to city" strip while a filter is active (its
    // anchors would otherwise point at now-hidden sections).
    if (grouped) {
      for (const section of Array.from(
        list.querySelectorAll<HTMLElement>('section[id^="city-"]'),
      )) {
        const anyVisible = section.querySelector('li:not([hidden])') !== null;
        section.hidden = !anyVisible;
      }
      const strip = list.querySelector<HTMLElement>('[data-directory-jumpstrip]');
      if (strip !== null) strip.hidden = !isEmptySelection(selection);
    }

    // Reorder (city only — grouped pages keep their editorial order).
    if (canSort) {
      const ul = list.querySelector('ul');
      if (ul !== null) {
        if (originalOrderRef.current === null) {
          originalOrderRef.current = Array.from(ul.querySelectorAll(':scope > li'));
        }
        const items = originalOrderRef.current;
        const ordered =
          sort === 'recommended'
            ? items
            : [...items].sort((a, b) => {
                const an = a.querySelector('[data-name]')?.getAttribute('data-name') ?? '';
                const bn = b.querySelector('[data-name]')?.getAttribute('data-name') ?? '';
                const cmp = an.localeCompare(bn);
                return sort === 'name-asc' ? cmp : -cmp;
              });
        for (const li of ordered) ul.appendChild(li);
      }
    }

    mapApiRef.current?.replot(visibleIds);
  }, [selection, sort, placeKey, grouped, canSort]);

  // Keep a stable ref so the (point-keyed) map-build effect can re-apply
  // the current selection right after it (re)creates the markers. Updated
  // in an effect (never during render) and declared before the build
  // effect so it is fresh by the time that effect first runs.
  useEffect(() => {
    applyRef.current = applyFiltersAndSort;
  }, [applyFiltersAndSort]);

  // Re-run filtering/sorting whenever the selection or sort changes.
  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const focusCard = useCallback((id: string, scroll: boolean): void => {
    const list = listRef.current;
    if (list === null) return;
    const card = list.querySelector<HTMLElement>(`[data-hotel-id="${CSS.escape(id)}"]`);
    if (card === null) return;
    card.classList.add(ACTIVE_CARD_CLASS);
    document
      .querySelector(`.mch-directory-pin[data-hotel-id="${CSS.escape(id)}"]`)
      ?.classList.add('mch-directory-pin--active');
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const blurCard = useCallback((id: string): void => {
    const list = listRef.current;
    if (list === null) return;
    const card = list.querySelector<HTMLElement>(`[data-hotel-id="${CSS.escape(id)}"]`);
    card?.classList.remove(ACTIVE_CARD_CLASS);
    document
      .querySelector(`.mch-directory-pin[data-hotel-id="${CSS.escape(id)}"]`)
      ?.classList.remove('mch-directory-pin--active');
  }, []);

  const handleMapReady = useCallback((api: DirectoryMapboxApi): void => {
    mapApiRef.current = api;
    applyRef.current();
    requestAnimationFrame(() => api.invalidateSize());
  }, []);

  // List → map sync: hovering / focusing a card highlights its pin (markers mode).
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const onEnter = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest<HTMLElement>('[data-hotel-id]');
      if (card === null) return;
      const id = card.getAttribute('data-hotel-id');
      if (id === null) return;
      card.classList.add(ACTIVE_CARD_CLASS);
      document
        .querySelector(`.mch-directory-pin[data-hotel-id="${CSS.escape(id)}"]`)
        ?.classList.add('mch-directory-pin--active');
    };
    const onLeave = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest<HTMLElement>('[data-hotel-id]');
      if (card === null) return;
      const id = card.getAttribute('data-hotel-id');
      if (id === null) return;
      card.classList.remove(ACTIVE_CARD_CLASS);
      if (id !== null) {
        document
          .querySelector(`.mch-directory-pin[data-hotel-id="${CSS.escape(id)}"]`)
          ?.classList.remove('mch-directory-pin--active');
      }
    };
    list.addEventListener('mouseover', onEnter);
    list.addEventListener('mouseout', onLeave);
    list.addEventListener('focusin', onEnter);
    list.addEventListener('focusout', onLeave);
    return () => {
      list.removeEventListener('mouseover', onEnter);
      list.removeEventListener('mouseout', onLeave);
      list.removeEventListener('focusin', onEnter);
      list.removeEventListener('focusout', onLeave);
    };
  }, []);

  useEffect(() => {
    if (showMap) {
      requestAnimationFrame(() => mapApiRef.current?.invalidateSize());
    }
  }, [showMap]);

  // ── Filter handlers ──────────────────────────────────────────────────────
  const toggleStar = (n: number): void =>
    setSelection((s) => ({
      ...s,
      stars: s.stars.includes(n) ? s.stars.filter((x) => x !== n) : [...s.stars, n],
    }));
  const togglePalace = (): void => setSelection((s) => ({ ...s, palace: !s.palace }));
  const toggleBrand = (v: string): void =>
    setSelection((s) => ({
      ...s,
      brands: s.brands.includes(v) ? s.brands.filter((x) => x !== v) : [...s.brands, v],
    }));
  const togglePlace = (v: string): void =>
    setSelection((s) => ({
      ...s,
      places: s.places.includes(v) ? s.places.filter((x) => x !== v) : [...s.places, v],
    }));
  const clearAll = (): void => setSelection(emptyDirectorySelection());

  const activeCount =
    selection.stars.length +
    (selection.palace ? 1 : 0) +
    selection.brands.length +
    selection.places.length;

  const placeTitle = placeKey === 'district' ? t('filters.district') : t('filters.city');
  const hasPlaceFacet = facets.places.length >= 2;
  const hasStarFacet = facets.stars.length >= 2;
  const hasBrandFacet = facets.brands.length >= 1;

  const facetGroups = (
    <div className="space-y-6">
      {hasStarFacet ? (
        <fieldset>
          <legend className="text-fg mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('filters.category')}
          </legend>
          <ul className="space-y-1.5">
            {facets.stars.map((n) => (
              <li key={n}>
                <label className="text-fg/80 hover:text-fg flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selection.stars.includes(n)}
                    onChange={() => toggleStar(n)}
                    className="accent-amber-700"
                  />
                  <span>{t('filters.starLabel', { count: n })}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {facets.palaceCount > 0 ? (
        <fieldset>
          <legend className="text-fg mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('filters.distinction')}
          </legend>
          <label className="text-fg/80 hover:text-fg flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selection.palace}
              onChange={togglePalace}
              className="accent-amber-700"
            />
            <span>{t('filters.palace')}</span>
            <span className="text-muted ml-auto text-xs">{facets.palaceCount}</span>
          </label>
        </fieldset>
      ) : null}

      {hasPlaceFacet ? (
        <fieldset>
          <legend className="text-fg mb-2 text-xs font-semibold uppercase tracking-wide">
            {placeTitle}
          </legend>
          <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
            {facets.places.map((opt) => (
              <li key={opt.value}>
                <label className="text-fg/80 hover:text-fg flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selection.places.includes(opt.value)}
                    onChange={() => togglePlace(opt.value)}
                    className="accent-amber-700"
                  />
                  <span className="truncate">{opt.label}</span>
                  <span className="text-muted ml-auto text-xs">{opt.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {hasBrandFacet ? (
        <fieldset>
          <legend className="text-fg mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('filters.brand')}
          </legend>
          <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
            {facets.brands.map((opt) => (
              <li key={opt.value}>
                <label className="text-fg/80 hover:text-fg flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selection.brands.includes(opt.value)}
                    onChange={() => toggleBrand(opt.value)}
                    className="accent-amber-700"
                  />
                  <span className="truncate">{opt.label}</span>
                  <span className="text-muted ml-auto text-xs">{opt.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );

  const hasAnyFacet = hasStarFacet || facets.palaceCount > 0 || hasPlaceFacet || hasBrandFacet;

  const filterRail = hasAnyFacet ? (
    <aside aria-label={t('filters.title')} className="hidden xl:block">
      <div className="lg:sticky lg:top-24">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-fg text-sm font-semibold">{t('filters.title')}</h2>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-amber-700 underline-offset-2 hover:underline"
            >
              {t('filters.clear')}
            </button>
          ) : null}
        </div>
        {facetGroups}
      </div>
    </aside>
  ) : null;

  const sortBar = (
    <div className="border-border mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <p className="text-fg text-sm font-semibold" aria-live="polite">
        {t('results.count', { count: visibleCount })}
      </p>
      <div className="flex items-center gap-2">
        {hasAnyFacet ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="border-border text-fg hover:bg-muted/10 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium xl:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              aria-hidden="true"
              className="fill-current"
            >
              <path d="M3 5h18v2l-7 7v5l-4 2v-7L3 7V5Z" />
            </svg>
            {t('filters.open')}
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-amber-700 px-1.5 text-[0.65rem] text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {canSort ? (
          <label className="text-muted flex items-center gap-1.5 text-xs">
            <span className="hidden sm:inline">{t('sort.label')}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DirectorySortKey)}
              className="border-border bg-bg text-fg rounded-md border px-2 py-1.5 text-xs"
            >
              <option value="recommended">{t('sort.recommended')}</option>
              <option value="name-asc">{t('sort.nameAsc')}</option>
              <option value="name-desc">{t('sort.nameDesc')}</option>
            </select>
          </label>
        ) : (
          <p className="text-muted text-xs">{t('sort.recommended')}</p>
        )}
      </div>
    </div>
  );

  const emptyState =
    visibleCount === 0 ? (
      <div className="border-border text-muted rounded-xl border border-dashed p-8 text-center text-sm">
        <p className="mb-3">{t('filters.noResults')}</p>
        <button
          type="button"
          onClick={clearAll}
          className="text-amber-700 underline-offset-2 hover:underline"
        >
          {t('filters.clear')}
        </button>
      </div>
    ) : null;

  // Mobile / tablet filter drawer (below xl, where the rail is hidden).
  const drawer =
    drawerOpen && hasAnyFacet ? (
      <div
        className="fixed inset-0 z-[60] xl:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('filters.title')}
      >
        <button
          type="button"
          aria-label={t('filters.close')}
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 bg-black/40"
        />
        <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-white shadow-2xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-fg text-sm font-semibold">{t('filters.title')}</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('filters.close')}
              className="text-muted hover:text-fg text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4">{facetGroups}</div>
          <div className="border-border flex items-center gap-3 border-t px-4 py-3">
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-fg/70 text-xs underline-offset-2 hover:underline"
              >
                {t('filters.clear')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t('filters.apply', { count: visibleCount })}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // ── No geocoded point → list + filters, no map (still 100% indexable) ────
  if (!hasPoints) {
    return (
      <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        {filterRail}
        <div ref={listRef}>
          {sortBar}
          {emptyState}
          {children}
        </div>
        {drawer}
      </div>
    );
  }

  return (
    <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
      {filterRail}

      <div>
        {sortBar}
        <div className="lg:grid lg:grid-cols-[1fr_minmax(340px,40%)] lg:gap-8">
          <div ref={listRef} className={showMap ? 'hidden lg:block' : 'block'}>
            {emptyState}
            {children}
          </div>

          <div
            className={
              showMap ? 'fixed inset-0 z-50 lg:static lg:z-auto lg:block' : 'hidden lg:block'
            }
          >
            <div className="lg:sticky lg:top-24">
              <p className="text-muted mb-2 hidden items-center gap-1.5 text-xs font-medium lg:flex">
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                  className="fill-[#8c7b5a]"
                >
                  <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                </svg>
                {labels.geocodedNote}
              </p>
              <div
                id={`directory-map-${regionId}`}
                role="region"
                aria-label={labels.ariaLabel}
                className="border-border h-[100dvh] w-full overflow-hidden bg-[#f6f1e7] lg:h-[calc(100vh-9rem)] lg:rounded-xl lg:border lg:shadow-sm"
              >
                {hasPoints ? (
                  <DirectoryMapboxCanvas
                    points={points}
                    cluster={cluster}
                    popupViewLabel={labels.popupView}
                    onReady={handleMapReady}
                    onMarkerFocus={focusCard}
                    onMarkerBlur={blurCard}
                  />
                ) : null}
              </div>
              {showMap ? (
                <button
                  type="button"
                  onClick={() => setShowMap(false)}
                  className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/95 px-5 py-2 text-sm font-medium text-slate-900 shadow-lg lg:hidden"
                >
                  {labels.toggleHide}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!showMap ? (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl lg:hidden"
          aria-label={labels.ariaLabel}
        >
          {labels.toggleShow}
        </button>
      ) : null}

      {drawer}
    </div>
  );
}
