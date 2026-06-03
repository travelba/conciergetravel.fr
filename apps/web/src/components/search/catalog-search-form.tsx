import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { SearchAutocomplete } from './search-autocomplete';

/**
 * `<CatalogSearchForm>` — compact catalogue search form used by the
 * homepage hero and any other surface that needs a quick "find a stay"
 * entry-point without dragging the Algolia client island.
 *
 * Pure Server Component. Posts to the locale-aware `/recherche` (FR) /
 * `/search` (EN) route — the same target as the header
 * `<HeaderQuickSearch>` and the `SearchAction` JSON-LD emitted on the
 * home page. That alignment is what unlocks Google Sitelinks Search
 * Box for the brand SERP (ADR-0014 §2.2).
 *
 * Phase 1 deliberately keeps dates / occupancy out of the wire format:
 * the booking funnel relies on Amadeus, which is gated until Phase 6
 * (AGENTS.md §4ter). When `previewExtras` is true the form renders
 * dates / guests as disabled visual placeholders to match the Booking-
 * style hero layout users expect — but those fields carry no `name`
 * attribute, so only `destination` reaches `/recherche`.
 */
export async function CatalogSearchForm({
  locale,
  variant = 'hero',
  previewExtras = false,
}: {
  readonly locale: Locale;
  readonly variant?: 'hero' | 'inline';
  readonly previewExtras?: boolean;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.hero' });
  const tHeader = await getTranslations({ locale, namespace: 'header.search' });
  const action = getPathname({ locale, href: '/recherche' });

  const isHero = variant === 'hero';
  const showPreview = isHero && previewExtras;
  const inputId = isHero ? 'home-hero-search-destination' : 'inline-search-destination';

  const formClass = isHero
    ? showPreview
      ? 'border-border bg-bg/95 shadow-card grid w-full gap-1 rounded-lg border p-2 backdrop-blur sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-0 sm:divide-x sm:divide-border sm:p-1.5'
      : 'border-border bg-bg/95 shadow-card flex w-full max-w-xl flex-col items-stretch gap-2 rounded-lg border p-2 backdrop-blur sm:flex-row sm:items-center'
    : 'border-border bg-bg flex w-full max-w-xl items-center gap-2 rounded-md border p-1.5';

  return (
    <form
      role="search"
      action={action}
      method="get"
      aria-label={t('searchTitle')}
      className={formClass}
    >
      <div className={showPreview ? 'flex items-center px-3 sm:px-4' : 'contents'}>
        <label htmlFor={inputId} className="sr-only">
          {tHeader('label')}
        </label>
        <SearchAutocomplete
          locale={locale}
          inputId={inputId}
          placeholder={tHeader('destinationPlaceholder')}
          inputClassName="text-fg placeholder:text-muted w-full bg-transparent px-3 py-2.5 text-base focus:outline-none sm:text-sm"
        />
      </div>

      {showPreview ? (
        <>
          <div className="flex items-center gap-2 px-3 sm:px-4">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="text-muted h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="4" width="14" height="13" rx="1.5" />
              <path d="M3 8h14M7 2v3m6-3v3" strokeLinecap="round" />
            </svg>
            <label htmlFor="home-hero-search-dates" className="sr-only">
              {t('searchPreviewDates')}
            </label>
            <input
              id="home-hero-search-dates"
              type="text"
              placeholder={t('searchPreviewDates')}
              disabled
              aria-disabled="true"
              tabIndex={-1}
              readOnly
              className="text-fg placeholder:text-muted/80 w-full cursor-not-allowed bg-transparent px-1 py-2.5 text-base opacity-60 focus:outline-none sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 px-3 sm:px-4">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="text-muted h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="10" cy="7" r="3" />
              <path d="M4 17c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round" />
            </svg>
            <label htmlFor="home-hero-search-guests" className="sr-only">
              {t('searchPreviewGuests')}
            </label>
            <input
              id="home-hero-search-guests"
              type="text"
              placeholder={t('searchPreviewGuests')}
              disabled
              aria-disabled="true"
              tabIndex={-1}
              readOnly
              className="text-fg placeholder:text-muted/80 w-full cursor-not-allowed bg-transparent px-1 py-2.5 text-base opacity-60 focus:outline-none sm:text-sm"
            />
          </div>
        </>
      ) : null}

      <button
        type="submit"
        aria-label={t('searchSubmitAria')}
        className={
          showPreview
            ? 'bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring m-1 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 sm:m-0 sm:rounded-md sm:px-5'
            : 'bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2'
        }
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13.5 13.5l3 3" strokeLinecap="round" />
        </svg>
        <span>{t('searchSubmit')}</span>
      </button>
    </form>
  );
}
