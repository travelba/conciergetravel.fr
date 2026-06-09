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
  intlNavSlugToIso,
  LABEL_NAV_ENTRIES,
  navHotelTypeToAxisValue,
  OCCASION_NAV_ENTRIES,
  pickCategoryLabel,
  pickEntryLabel,
  SAISON_NAV_ENTRIES,
  THEME_NAV_ENTRIES,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_INTL_DESTINATION_NAV_ENTRIES,
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

      <header className="border-outline-variant bg-bg/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container mx-auto flex max-w-screen-xl items-center gap-4 px-4 py-3">
          <Link
            href="/"
            className="focus-visible:ring-ring flex items-center gap-2.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            aria-label={t('brand')}
          >
            <span className="text-primary-heritage font-serif text-[1.7rem] font-medium leading-none tracking-[0.04em]">
              M<span className="text-gold-700">C</span>
            </span>
            <span className="text-primary-heritage hidden font-serif text-lg leading-none tracking-[0.01em] sm:inline">
              {t('brand')}
            </span>
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

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/recherche"
              aria-label={t('primaryNav.search')}
              className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 md:hidden"
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
    <div className="group relative flex h-full items-center">
      <Link
        href={href}
        aria-haspopup="menu"
        aria-label={triggerAria}
        className="text-fg hover:text-gold-700 focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2"
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
  ariaLabel,
}: {
  readonly href: React.ComponentProps<typeof Link>['href'];
  readonly label: string;
  readonly muted?: boolean;
  /**
   * Optional explicit `aria-label`. Used by international destination
   * entries to surface the ISO code to screen readers while keeping
   * the visible label localised — useful when several entries share
   * the same destination page (`/hotels`) before per-country deep
   * links land.
   */
  readonly ariaLabel?: string;
}): ReactElement {
  return (
    <li role="none">
      <Link
        role="menuitem"
        href={href}
        aria-label={ariaLabel}
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
            {/* Slice 12 — exposes the 5 international additions (Aman,
                Belmond, Six Senses, Bulgari, Auberge Resorts) in addition
                to the 7 historical FR/Asian author collections. ADR-0021
                Vague 4 — the mega-menu now incarnates the worldwide
                catalogue scope. The full set of 18 brands lives in
                BRAND_NAV_ENTRIES; the footer surfaces a wider subset. */}
            {BRAND_NAV_ENTRIES.slice(0, 12).map((entry) => (
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
      {/* ── Editorial distinctions row (2026-05-29) ────────────────────────
          Surfaces the structured `affiliations[]` facets backfilled by
          migration 0063: 6 prestige labels (R&C, SLH, LHW, Forbes,
          Michelin Keys, Palace Atout France). The footer carries the
          rankings (T+L, CN Gold, World's 50 Best). Anti-invisibility
          measure — see `.cursor/rules/user-acceptance-before-commit.mdc`. */}
      <div className="border-border mt-3 border-t pt-3" aria-labelledby="mega-distinctions-heading">
        <p
          id="mega-distinctions-heading"
          className="text-muted mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
        >
          {t('primaryNav.hotelsByLabel')}
        </p>
        <div className="flex flex-wrap gap-1.5 px-1.5">
          {LABEL_NAV_ENTRIES.slice(0, 6).map((entry) => (
            <Link
              key={entry.slug}
              role="menuitem"
              href={{
                pathname: '/label/[facetSlug]',
                params: { facetSlug: entry.slug },
              }}
              className="border-border text-muted hover:text-fg focus-visible:ring-ring hover:border-gold-300 rounded-full border bg-transparent px-2.5 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2"
            >
              {pickEntryLabel(entry, locale)}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-border mt-3 flex flex-col gap-1 border-t pt-2">
        <Link
          role="menuitem"
          href="/hotels"
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.hotelsBrowseAll')}
        </Link>
        {/* ADR-0026 — annuaire entry (country directory by city). */}
        <Link
          role="menuitem"
          href={{ pathname: '/hotels/[pays]', params: { pays: 'france' } }}
          className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring block rounded-md px-2.5 py-2 text-xs focus-visible:outline-none focus-visible:ring-2"
        >
          {t('primaryNav.directoryByCountry')}
        </Link>
      </div>
    </MegaTrigger>
  );
}

// ─── Mega-menu 2 — Destinations ──────────────────────────────────────────

/**
 * Curated 8-city subset of `TOP_INTL_DESTINATION_NAV_ENTRIES` rendered in
 * the new `Monde — villes` column. Hand-picked from the 14 published
 * city guides (post PR-A inline merge, 2026-05-28) — every slug now
 * renders the long-read editorial body inside `/destination/[citySlug]`,
 * so the mega-menu link lands on a fully-rendered page rather than the
 * pre-merge "hub-only" placeholder.
 */
const INTL_CITY_MENU_SLUGS = [
  'new-york',
  'tokyo',
  'dubai',
  'marrakech',
  'mykonos',
  'santorin',
  'bali',
  'amalfi-coast',
] as const;

function DestinationsMegaMenu({ locale, t }: MegaMenuProps): ReactElement {
  // Pull the curated intl city subset in declared order — `find` keeps
  // the same labels as the master `TOP_INTL_DESTINATION_NAV_ENTRIES`
  // declaration so a single edit reflects everywhere (footer + nav).
  const intlCityEntries = INTL_CITY_MENU_SLUGS.map((slug) =>
    TOP_INTL_DESTINATION_NAV_ENTRIES.find((entry) => entry.slug === slug),
  ).filter(
    (entry): entry is (typeof TOP_INTL_DESTINATION_NAV_ENTRIES)[number] => entry !== undefined,
  );

  return (
    <MegaTrigger
      href="/destination"
      label={t('primaryNav.destinations')}
      ariaLabel={t('primaryNav.destinationsLabel')}
    >
      {/* 4-column layout (post ADR-0021 Vague 4) — splits Monde into
          villes (city long-reads) + pays (country guides). Falls back
          to 2 columns ≤ md to keep the mega-menu readable. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-4">
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
          {/*
            HERO_REGION_NAV_ENTRIES uses region slugs (`cote-d-azur`,
            `provence`, `alpes`, `champagne`, `corse`, `pays-basque`,
            `loire`). These are NOT city slugs — `getDestinationBySlug`
            filters strictly on `citySlug(h.city) === slug` (FR-only),
            so routing them to `/destination/[citySlug]` was producing
            8 `notFound()` 404s page-wide (nav audit 2026-05-25).

            We route them to `/classements/lieu/[slug]` instead, which:
            - tolerates known taxonomy values via `isKnownTaxonomyValue`
              (HERO_REGION_NAV_ENTRIES is in KNOWN_LIEU_VALUES);
            - renders the matching rankings when present (4/8: alpes 12,
              cote-d-azur 13, corse 4, loire 3);
            - degrades to a noindex empty state otherwise — never a 404.

            Long-term fix: ship dedicated `/destination/region/[slug]`
            pages once the editorial region hubs are seeded (Phase 2).
          */}
          <>
            {HERO_REGION_NAV_ENTRIES.map((entry) => (
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
        <MegaColumn heading={t('primaryNav.destinationsWorldCities')}>
          {/*
            New `Monde — villes` column (PR-C, ADR-0021 Vague 4). Each
            slug now renders a long-read city guide inline on
            `/destination/[citySlug]` (PR-A — ADR-0015 step 1), so the
            mega-menu link lands on a proper editorial page rather than
            the pre-merge hub-only placeholder. The 8 selected slugs
            cover the highest-traffic global capitals + iconic island
            destinations from the 14 published city guides.
          */}
          <>
            {intlCityEntries.map((entry) => (
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
              // aria-label appends the ISO country code for screen
              // readers so the link is unambiguous out of context.
              const iso = intlNavSlugToIso(entry.slug);
              const label = pickEntryLabel(entry, locale);
              const ariaLabel = iso !== null ? `${label} — ${iso.toUpperCase()}` : label;
              switch (entry.slug) {
                case 'italie':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/italie"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'suisse':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/suisse"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'maroc':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/maroc"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'maldives':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/maldives"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'emirats-arabes-unis':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/emirats-arabes-unis"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'thailande':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/thailande"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'japon':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/japon"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                case 'etats-unis':
                  return (
                    <MegaLink
                      key={entry.slug}
                      href="/guide/etats-unis"
                      label={label}
                      ariaLabel={ariaLabel}
                    />
                  );
                default:
                  return (
                    <MegaLink key={entry.slug} href="/hotels" label={label} ariaLabel={ariaLabel} />
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
            {HOTEL_TYPE_NAV_ENTRIES.slice(0, 6).map((entry) => {
              // Map the user-friendly menu slug to the canonical axis
              // value declared in `axes.ts`. Drop entries that can't
              // map (defensive; the test in `nav-data.test.ts` makes
              // this branch unreachable in CI).
              const axisValue = navHotelTypeToAxisValue(entry.slug);
              if (axisValue === null) return null;
              return (
                <MegaLink
                  key={entry.slug}
                  href={{
                    pathname: '/classements/[axe]/[valeur]',
                    params: { axe: 'type', valeur: axisValue },
                  }}
                  label={pickEntryLabel(entry, locale)}
                />
              );
            })}
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

/**
 * Concierge mega-menu — wired to the dedicated institutional pages.
 *
 * Audit 2026-05-25: 5 entries were still pointing at `/le-concierge`
 * even though the dedicated pages had landed (footer used them
 * already, header was lagging). We now route every link to its
 * canonical destination:
 *
 * - `conciergeTip`       → `/le-conseil-du-concierge`
 * - `conciergeHotelier`  → `/le-concierge/pour-les-hoteliers`
 * - `conciergeMice`      → `/le-concierge/mice-et-seminaires`
 * - `conciergePress`     → `/le-concierge/presse-et-partenaires`
 *
 * `conciergeJournal` keeps pointing at `/le-concierge` (the dedicated
 * journal hub is still on the Phase-1 editorial backlog — no page yet).
 */
function ConciergeMegaMenu({ t }: MegaMenuProps): ReactElement {
  return (
    <MegaTrigger
      href="/le-concierge"
      label={t('primaryNav.concierge')}
      ariaLabel={t('primaryNav.conciergeLabel')}
    >
      {/*
        PR-C trim — the mega-menu now ships 11 entries instead of 15
        (audit 2026-05-28). Dropped:
          - `conciergeBooking` → reachable from the footer + every
            hotel fiche CTA (no need in the institutional menu).
          - `conciergeJournal` → was a placeholder pointing at
            `/le-concierge` (the editorial journal hub never shipped);
            keeping the link advertised stale content.
          - `conciergeContact` → reachable from the footer Services
            block (no first-class menu entry needed).
          - `conciergeClubPressKit` → consolidated under
            `conciergePress` (`/le-concierge/presse-et-partenaires`)
            which links to the Club press kit on the same page.
      */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        <MegaColumn heading={t('primaryNav.conciergeAbout')}>
          <>
            <MegaLink href="/le-concierge" label={t('primaryNav.conciergeAboutLink')} />
            {/* Single landing page after the 2026-05-26 PO
                consolidation — both tiers (free Club + Prestige
                waitlist) live side-by-side on /le-concierge-club. The
                Prestige sub-link is now an in-page anchor inside that
                landing. */}
            <MegaLink href="/le-concierge-club" label={t('primaryNav.conciergeClub')} />
            <MegaLink
              href="/le-concierge/methode-editoriale"
              label={t('primaryNav.conciergeMethod')}
            />
            <MegaLink href="/le-concierge/faq" label={t('primaryNav.conciergeFaq')} />
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.conciergeContent')}>
          <>
            <MegaLink href="/le-conseil-du-concierge" label={t('primaryNav.conciergeTip')} />
            <MegaLink href="/itineraires" label={t('primaryNav.conciergeItineraries')} />
            {/* Ouvertures & visites — chronological feed of the most
                recent addresses visited by our concierge desk (refonte
                2026-05-28: surfaces the existing `/ouvertures` page
                that was reachable from the home strip only). */}
            <MegaLink href="/ouvertures" label={t('primaryNav.conciergeOpenings')} />
            <MegaLink href="/guides" label={t('primaryNav.conciergeGuides')} />
          </>
        </MegaColumn>
        <MegaColumn heading={t('primaryNav.conciergePro')}>
          <>
            <MegaLink
              href="/le-concierge/pour-les-hoteliers"
              label={t('primaryNav.conciergeHotelier')}
            />
            <MegaLink
              href="/le-concierge/mice-et-seminaires"
              label={t('primaryNav.conciergeMice')}
            />
            <MegaLink
              href="/le-concierge/presse-et-partenaires"
              label={t('primaryNav.conciergePress')}
            />
          </>
        </MegaColumn>
      </div>
    </MegaTrigger>
  );
}
