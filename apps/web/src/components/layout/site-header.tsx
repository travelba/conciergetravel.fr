import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense, type ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { AuthArea } from './auth-area';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import { HOTEL_CATEGORY_NAV_ENTRIES, pickCategoryLabel } from './nav-data';

/**
 * Site-wide top bar (skill: responsive-ui-architecture +
 * accessibility §landmarks).
 *
 * Structure:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ [Skip link]                                             │
 *   │ [Brand]   [Primary nav (md+)]   [Locale]  [Auth]  [☰]   │
 *   └─────────────────────────────────────────────────────────┘
 *
 *  - Pure Server Component — does NOT read `cookies()` so it stays
 *    static. The auth area is a client island that resolves the
 *    Supabase session in the browser via `<AuthArea />`. This is what
 *    enables pages underneath to opt into ISR instead of
 *    `force-dynamic` (ADR-0007, Sprint 4.1).
 *  - The skip-link is the first focusable element on every page and
 *    jumps to `#main` (set by the locale layout).
 *  - Desktop nav uses `<nav aria-label>` for a discoverable landmark.
 *  - The "Hôtels" entry exposes a CSS-only hover/focus-within dropdown
 *    surfacing the 5 editorial categories. No JS required — visibility
 *    is driven by `group-hover` + `focus-within` so keyboard users get
 *    the same affordance as mouse users without losing the Server
 *    Component contract above.
 *  - Mobile nav is a focus-trapped overlay (`MobileNav`).
 */
export async function SiteHeader(): Promise<ReactElement> {
  const t = await getTranslations('header');
  const locale = (await getLocale()) as Locale;

  return (
    <>
      <a
        href="#main"
        className="focus:bg-fg focus:text-bg sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm"
      >
        {t('skipToContent')}
      </a>

      <header className="border-border bg-bg/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container mx-auto flex max-w-screen-xl items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="text-fg focus-visible:ring-ring font-serif text-lg tracking-tight hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            aria-label={t('brand')}
          >
            {t('brand')}
          </Link>

          <nav
            aria-label={t('primaryNav.label')}
            className="ml-4 hidden flex-1 items-center gap-1 md:flex"
          >
            {/*
              "Hôtels" — link + CSS-only dropdown of editorial categories.
              The wrapper is a `group` so the panel becomes visible on
              hover OR when any descendant has focus (`focus-within`).
              `aria-haspopup="menu"` advertises the dropdown to screen
              readers; the panel itself uses a `<ul role="menu">` shape.
            */}
            <div className="group relative">
              <Link
                href="/hotels"
                aria-haspopup="menu"
                className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
              >
                {t('primaryNav.hotels')}
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className="h-3 w-3 opacity-60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <div
                role="menu"
                aria-label={t('primaryNav.hotelsCategoriesLabel')}
                className="border-border bg-bg invisible absolute left-0 top-full z-50 mt-1 w-72 rounded-md border p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
              >
                <ul className="flex flex-col">
                  {HOTEL_CATEGORY_NAV_ENTRIES.map((entry) => (
                    <li key={entry.slug} role="none">
                      <Link
                        role="menuitem"
                        href={{
                          pathname: '/categorie/[categorySlug]',
                          params: { categorySlug: entry.slug },
                        }}
                        className="text-fg hover:bg-muted/10 focus-visible:ring-ring block rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                      >
                        {pickCategoryLabel(entry, locale)}
                      </Link>
                    </li>
                  ))}
                  <li role="none" className="border-border mt-1 border-t pt-1">
                    <Link
                      role="menuitem"
                      href="/hotels"
                      className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
                    >
                      {t('primaryNav.hotelsBrowseAll')}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            <Link
              href="/destination"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
            >
              {t('primaryNav.destinations')}
            </Link>
            <Link
              href="/classements"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
            >
              {t('primaryNav.rankings')}
            </Link>
            <Link
              href="/guides"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
            >
              {t('primaryNav.guides')}
            </Link>
            <Link
              href="/recherche"
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
            >
              {t('primaryNav.search')}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {/*
              The switcher reads `useSearchParams()` (preserves the
              query string on `/recherche` etc.), which forces a CSR
              bailout inside statically prerendered pages — wrap it in
              `Suspense` so the rest of the header can prerender.
            */}
            <Suspense fallback={null}>
              <LocaleSwitcher />
            </Suspense>

            <AuthArea variant="header" />

            <MobileNav />
          </div>
        </div>
      </header>
    </>
  );
}
