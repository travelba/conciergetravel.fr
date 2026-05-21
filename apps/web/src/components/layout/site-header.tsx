import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense, type ReactElement, type ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { AuthArea } from './auth-area';
import { HeaderQuickSearch } from './header-quick-search';
import { LocaleSwitcher } from './locale-switcher';
import { MobileNav } from './mobile-nav';
import {
  BRAND_NAV_ENTRIES,
  HERO_REGION_NAV_ENTRIES,
  HOTEL_CATEGORY_NAV_ENTRIES,
  HOTEL_TYPE_NAV_ENTRIES,
  INTL_DESTINATION_NAV_ENTRIES,
  OCCASION_NAV_ENTRIES,
  pickCategoryLabel,
  pickEntryLabel,
  SAISON_NAV_ENTRIES,
  THEME_NAV_ENTRIES,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_RANKING_NAV_ENTRIES,
} from './nav-data';

/**
 * Site-wide top bar — refonte ADR-0014.
 *
 * Structure:
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [Skip link]                                                     │
 *   │ [Brand]   Palaces&Hôtels▾ Destinations▾ Inspiration▾            │
 *   │           Classements▾ Le Concierge▾   [🔎] [FR][Auth] [☰]      │
 *   └────────────────────────────────────────────────────────────────┘
 *
 *  - Pure Server Component (skill: nextjs-app-router) — does NOT read
 *    `cookies()` so it stays static. The auth area is a client island
 *    (ADR-0007). Mega-menus are CSS-only (`group-hover` + `focus-within`):
 *    no JS bundle cost, full keyboard accessibility.
 *  - Skip-link is the first focusable element on every page.
 *  - Each top-level entry has a 3-column mega-menu (640px wide on desktop)
 *    surfacing the taxonomy already declared in `axes.ts` /
 *    `editorial-categories.ts` / `BRAND_FAMILIES` (skill: seo-technical
 *    §Maillage).
 *  - The quick-search slot in the header is provided by `HeaderQuickSearch`
 *    (PR-9). For now, a search icon link is rendered next to the locale
 *    switcher.
 *  - Mobile nav is a focus-trapped overlay (`MobileNav`).
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 * @see docs/adr/0016-non-palace-category-pages.md
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
            className="ml-4 hidden flex-1 items-center gap-0.5 md:flex"
          >
            <PalacesHotelsMegaMenu locale={locale} t={t} />
            <DestinationsMegaMenu locale={locale} t={t} />
            <InspirationMegaMenu locale={locale} t={t} />
            <ClassementsMegaMenu locale={locale} t={t} />
            <ConciergeMegaMenu locale={locale} t={t} />
          </nav>

          <HeaderQuickSearch locale={locale} />

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/recherche"
              aria-label={t('primaryNav.search')}
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 lg:hidden"
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
            </Link>

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

// ─── Mega-menu plumbing ──────────────────────────────────────────────────

type T = Awaited<ReturnType<typeof getTranslations<'header'>>>;

interface MegaMenuProps {
  readonly locale: Locale;
  readonly t: T;
}

/**
 * Shared mega-menu shell — a `group` button + a 3-column dropdown panel
 * that opens on hover OR keyboard focus-within. The panel is rendered
 * even when "closed" (just hidden via opacity/visibility) to preserve
 * SSR crawlability for LLM crawlers.
 */
function MegaTrigger({
  href,
  label,
  triggerAria,
  children,
  ariaLabel,
}: {
  readonly href: '/hotels' | '/destination' | '/inspiration' | '/classements' | '/le-concierge';
  readonly label: string;
  readonly triggerAria?: string;
  readonly children: ReactNode;
  readonly ariaLabel: string;
}): ReactElement {
  return (
    <div className="group relative">
      <Link
        href={href}
        aria-haspopup="menu"
        aria-label={triggerAria}
        className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
      >
        {label}
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
        aria-label={ariaLabel}
        className="border-border bg-bg invisible absolute left-0 top-full z-50 mt-1 w-[42rem] rounded-md border p-4 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </div>
    </div>
  );
}

function MegaColumn({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div>
      <p className="text-muted mb-2 text-xs font-medium uppercase tracking-wider">{heading}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function MegaLink({
  href,
  label,
  muted = false,
}: {
  readonly href: React.ComponentProps<typeof Link>['href'];
  readonly label: string;
  readonly muted?: boolean;
}): ReactElement {
  return (
    <li role="none">
      <Link
        role="menuitem"
        href={href}
        className={`hover:bg-muted/10 focus-visible:ring-ring block rounded-md px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 ${
          muted ? 'text-muted hover:text-fg text-xs' : 'text-fg'
        }`}
      >
        {label}
      </Link>
    </li>
  );
}

// ─── Mega-menu 1 — Palaces & Hôtels ──────────────────────────────────────

function PalacesHotelsMegaMenu({ locale, t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/hotels"
      label={t('primaryNav.hotels')}
      ariaLabel={t('primaryNav.hotelsCategoriesLabel')}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.hotelsByDistinction')}>
          <>
            {HOTEL_CATEGORY_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: entry.slug },
                }}
                label={pickCategoryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.hotelsByType')}>
          <>
            {HOTEL_TYPE_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/categorie/[categorySlug]',
                  params: { categorySlug: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.hotelsByBrand')}>
          <>
            {BRAND_NAV_ENTRIES.slice(0, 8).map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/marque/[brandSlug]',
                  params: { brandSlug: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
            <MegaLink href="/marques" label={t('primaryNav.hotelsBrowseAllBrands')} muted />
          </>
        </MegaColumn>
      </div>
      <div className="border-border mt-3 border-t pt-2">
        <Link
          role="menuitem"
          href="/hotels"
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.hotelsBrowseAll')}
        </Link>
      </div>
    </MegaTrigger>
  );
}

// ─── Mega-menu 2 — Destinations ──────────────────────────────────────────

function DestinationsMegaMenu({ locale, t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/destination"
      label={t('primaryNav.destinations')}
      ariaLabel={t('primaryNav.destinationsLabel')}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.destinationsFrance')}>
          <>
            {TOP_DESTINATION_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/destination/[citySlug]',
                  params: { citySlug: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.destinationsHeroes')}>
          <>
            {HERO_REGION_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/destination/[citySlug]',
                  params: { citySlug: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.destinationsWorld')}>
          <>
            {INTL_DESTINATION_NAV_ENTRIES.map((entry) => {
              // Vague-6 — all 8 international country guides shipped.
              // Each menu entry routes to its dedicated guide page.
              // The typed `Href` requires a literal pathname union;
              // we map the slug explicitly to keep the typecheck strict.
              switch (entry.slug) {
                case 'italie':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/italie"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'suisse':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/suisse"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'maroc':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/maroc"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'maldives':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/maldives"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'emirats-arabes-unis':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/emirats-arabes-unis"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'thailande':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/thailande"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'japon':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/japon"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                case 'etats-unis':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/etats-unis"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
                default:
                  // Defensive — any future intl slug not mapped
                  // degrades to the catalogue root rather than 404.
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/hotels"
                      label={pickEntryLabel(entry, locale)}
                    />
                  );
              }
            })}
          </>
        </MegaColumn>
      </div>
      <div className="border-border mt-3 border-t pt-2">
        <Link
          role="menuitem"
          href="/destination"
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.destinationsBrowseAll')}
        </Link>
      </div>
    </MegaTrigger>
  );
}

// ─── Mega-menu 3 — Inspiration ───────────────────────────────────────────

function InspirationMegaMenu({ locale, t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/inspiration"
      label={t('primaryNav.inspiration')}
      ariaLabel={t('primaryNav.inspirationLabel')}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.inspirationByTheme')}>
          <>
            {THEME_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'theme', valeur: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.inspirationByOccasion')}>
          <>
            {OCCASION_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'occasion', valeur: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.inspirationBySaison')}>
          <>
            {SAISON_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'saison', valeur: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
      </div>
      <div className="border-border mt-3 border-t pt-2">
        <Link
          role="menuitem"
          href="/inspiration"
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.inspirationBrowseAll')}
        </Link>
      </div>
    </MegaTrigger>
  );
}

// ─── Mega-menu 4 — Classements ───────────────────────────────────────────

function ClassementsMegaMenu({ locale, t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/classements"
      label={t('primaryNav.rankings')}
      ariaLabel={t('primaryNav.rankingsLabel')}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.rankingsTop')}>
          <>
            {TOP_RANKING_NAV_ENTRIES.map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classement/[slug]',
                  params: { slug: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.rankingsByType')}>
          <>
            {HOTEL_TYPE_NAV_ENTRIES.slice(0, 6).map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'type', valeur: entry.slug.replace(/^hotels-/u, '') },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.rankingsByDestination')}>
          <>
            {TOP_DESTINATION_NAV_ENTRIES.slice(0, 6).map((entry) => (
              <MegaLink
                key={entry.slug}
                href={{
                  pathname: '/classements/[axe]/[valeur]',
                  params: { axe: 'lieu', valeur: entry.slug },
                }}
                label={pickEntryLabel(entry, locale)}
              />
            ))}
          </>
        </MegaColumn>
      </div>
      <div className="border-border mt-3 border-t pt-2">
        <Link
          role="menuitem"
          href="/classements"
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.rankingsBrowseAll')}
        </Link>
      </div>
    </MegaTrigger>
  );
}

// ─── Mega-menu 5 — Le Concierge ──────────────────────────────────────────

function ConciergeMegaMenu({ t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/le-concierge"
      label={t('primaryNav.concierge')}
      ariaLabel={t('primaryNav.conciergeLabel')}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.conciergeAbout')}>
          <>
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeAboutLink')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeBooking')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeLoyalty')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeFaq')} />
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.conciergeContent')}>
          <>
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeTip')} />
            <MegaLink href="/itineraire" label={t('primaryNav.conciergeItineraries')} />
            <MegaLink href="/guides" label={t('primaryNav.conciergeGuides')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeJournal')} />
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.conciergePro')}>
          <>
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeHotelier')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeMice')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeContact')} />
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergePress')} />
          </>
        </MegaColumn>
      </div>
    </MegaTrigger>
  );
}
