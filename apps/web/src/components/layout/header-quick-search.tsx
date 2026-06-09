import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SearchAutocomplete } from '@/components/search/search-autocomplete';
import { getPathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HeaderQuickSearch>` — compact search input in the header (ADR-0014 §2.2).
 *
 * Pure Server Component: renders a native HTML form that GETs to
 * `/recherche?destination=…`. No JS bundle cost, fully crawler-friendly
 * (the form action is the canonical search URL, which is also the
 * target of the `SearchAction` JSON-LD on the home page).
 *
 * The Algolia-powered autocomplete is layered on top as a progressive
 * enhancement (`<HeaderQuickSearchAutocomplete>` client island, future
 * follow-up). Without JS, users still get the same submit-to-search
 * experience.
 *
 * Layout target (md ≥): the input sits between the primary nav and the
 * auth area. On smaller viewports, the input is hidden — the search
 * icon link in the header takes over.
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 */
export async function HeaderQuickSearch({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations('header.search');
  // Resolve the locale-aware action path so the form submission lands
  // on the correct route (`/recherche` in FR, `/search` in EN).
  const action = getPathname({ locale, href: '/recherche' });

  return (
    <form
      role="search"
      action={action}
      method="get"
      className="border-border bg-bg focus-within:border-gold-400 focus-within:ring-ring ml-3 hidden h-9 items-center rounded-md border focus-within:ring-2 md:flex"
      aria-label={t('label')}
    >
      <label className="sr-only" htmlFor="header-quick-search-destination">
        {t('label')}
      </label>
      <SearchAutocomplete
        locale={locale}
        inputId="header-quick-search-destination"
        placeholder={t('destinationPlaceholder')}
        wrapperClassName="relative"
        inputClassName="text-fg placeholder:text-muted h-9 w-44 rounded-l-md bg-transparent px-3 text-sm focus:outline-none xl:w-56"
      />
      <button
        type="submit"
        aria-label={t('submitAria')}
        className="bg-primary-heritage text-off-white hover:bg-primary-heritage/90 inline-flex h-full items-center justify-center rounded-r-md px-3 text-xs font-medium"
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
        <span className="sr-only">{t('submit')}</span>
      </button>
    </form>
  );
}
