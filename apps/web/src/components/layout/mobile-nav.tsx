'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactElement } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

import { AuthArea } from './auth-area';
import {
  BRAND_NAV_ENTRIES,
  HERO_REGION_NAV_ENTRIES,
  HOTEL_CATEGORY_NAV_ENTRIES,
  HOTEL_TYPE_NAV_ENTRIES,
  INTL_DESTINATION_NAV_ENTRIES,
  intlNavSlugToIso,
  OCCASION_NAV_ENTRIES,
  pickCategoryLabel,
  pickEntryLabel,
  SAISON_NAV_ENTRIES,
  THEME_NAV_ENTRIES,
  TOP_DESTINATION_NAV_ENTRIES,
  TOP_RANKING_NAV_ENTRIES,
  type NavLabeledEntry,
} from './nav-data';

/**
 * Mobile slide-over menu — refonte ADR-0014.
 *
 * 5 top-level sections that match `<SiteHeader>` desktop:
 *   - Palaces & Hôtels  → by distinction / by type / by brand
 *   - Destinations      → France / hero regions / international
 *   - Inspiration       → themes / occasions / seasons
 *   - Classements       → top-curés / by type / by destination
 *   - Le Concierge      → about / content / pros
 *
 * Each section uses a native `<details>` so keyboard and assistive-tech
 * users get the disclosure semantics for free. The icon rotates on
 * `[open]` via group-* utilities (CSS-only). The trigger is a focus-
 * trapped overlay (skill: accessibility §dialogs).
 *
 * Body scroll lock + Esc close + focus restoration are preserved from
 * the previous version.
 */
export function MobileNav(): ReactElement {
  const t = useTranslations('header');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Close on route change — using the React 19 "store previous value"
  // pattern so the close happens during render rather than from an
  // effect, satisfying `react-hooks/set-state-in-effect`.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const pathname = usePathname();
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setOpen(false);
  }

  // Body scroll lock + Esc handler.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus first focusable element of the panel on open, restore to
  // trigger on close.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        const focusable = panelRef.current?.querySelector<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      });
    } else {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const summaryClass =
    'text-fg hover:bg-muted/10 focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden';
  const subHeadingClass = 'text-muted mt-2 text-[10px] font-semibold uppercase tracking-wider';
  const subLinkClass =
    'text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 block';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={labelId}
        aria-label={open ? t('menu.close') : t('menu.open')}
        onClick={() => setOpen((v) => !v)}
        className="border-border bg-bg text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2 md:hidden"
      >
        {open ? (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M5 5l10 10M5 15L15 5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label={t('menu.close')}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="bg-fg/40 absolute inset-0"
          />

          {/* Panel */}
          <div
            id={labelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('menu.label')}
            className="border-border bg-bg absolute right-0 top-0 flex h-dvh w-[min(22rem,90vw)] flex-col overflow-y-auto border-l p-5 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-fg font-serif text-lg">{t('brand')}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('menu.close')}
                className="border-border bg-bg text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md border focus-visible:outline-none focus-visible:ring-2"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M5 5l10 10M5 15L15 5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Quick-search shortcut */}
            <Link
              href="/recherche"
              className="border-border bg-muted/5 hover:bg-muted/10 mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="h-4 w-4 opacity-60"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              >
                <circle cx="9" cy="9" r="5.5" />
                <path d="M13.5 13.5l3 3" strokeLinecap="round" />
              </svg>
              <span>{t('primaryNav.search')}</span>
            </Link>

            <nav aria-label={t('primaryNav.label')} className="flex flex-col gap-0.5 text-base">
              {/* 1 — Palaces & Hôtels */}
              <details className="group">
                <summary className={summaryClass}>
                  <span>{t('primaryNav.hotels')}</span>
                  <Chevron />
                </summary>
                <div className="border-muted/30 ml-3 mt-1 flex flex-col gap-2 border-l pb-2 pl-3">
                  <p className={subHeadingClass}>{t('primaryNav.hotelsByDistinction')}</p>
                  <ul className="flex flex-col gap-0.5">
                    {HOTEL_CATEGORY_NAV_ENTRIES.map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={{
                            pathname: '/categorie/[categorySlug]',
                            params: { categorySlug: entry.slug },
                          }}
                          className={subLinkClass}
                        >
                          {pickCategoryLabel(entry, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className={subHeadingClass}>{t('primaryNav.hotelsByType')}</p>
                  <ul className="flex flex-col gap-0.5">
                    {HOTEL_TYPE_NAV_ENTRIES.map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={{
                            pathname: '/categorie/[categorySlug]',
                            params: { categorySlug: entry.slug },
                          }}
                          className={subLinkClass}
                        >
                          {pickEntryLabel(entry, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className={subHeadingClass}>{t('primaryNav.hotelsByBrand')}</p>
                  <ul className="flex flex-col gap-0.5">
                    {BRAND_NAV_ENTRIES.slice(0, 6).map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={{
                            pathname: '/marque/[brandSlug]',
                            params: { brandSlug: entry.slug },
                          }}
                          className={subLinkClass}
                        >
                          {pickEntryLabel(entry, locale)}
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href="/marques" className={`${subLinkClass} text-muted text-xs`}>
                        {t('primaryNav.hotelsBrowseAllBrands')}
                      </Link>
                    </li>
                  </ul>
                  <Link href="/hotels" className={`${subLinkClass} text-muted text-xs`}>
                    {t('primaryNav.hotelsBrowseAll')}
                  </Link>
                </div>
              </details>

              {/* 2 — Destinations */}
              <details className="group">
                <summary className={summaryClass}>
                  <span>{t('primaryNav.destinations')}</span>
                  <Chevron />
                </summary>
                <div className="border-muted/30 ml-3 mt-1 flex flex-col gap-2 border-l pb-2 pl-3">
                  <p className={subHeadingClass}>{t('primaryNav.destinationsFrance')}</p>
                  <MobileLinkList
                    entries={TOP_DESTINATION_NAV_ENTRIES}
                    locale={locale}
                    pathname="/destination/[citySlug]"
                    paramKey="citySlug"
                    linkClass={subLinkClass}
                  />
                  <p className={subHeadingClass}>{t('primaryNav.destinationsHeroes')}</p>
                  {/*
                    HERO region slugs (`cote-d-azur`, `provence`, etc.)
                    are NOT cities — `getDestinationBySlug` would 404.
                    Route them through the rankings axis (`lieu`) where
                    they fall back to a noindex empty state at worst.
                    Audit 2026-05-25 — see `site-header.tsx` for context.
                  */}
                  <AxisLinkList
                    entries={HERO_REGION_NAV_ENTRIES}
                    locale={locale}
                    axe="lieu"
                    linkClass={subLinkClass}
                  />
                  <p className={subHeadingClass}>{t('primaryNav.destinationsWorld')}</p>
                  {/*
                    Vague-6 — all 8 international country guides
                    indexable. Each entry routes to its dedicated
                    /guide/<slug> page (inline switch keeps the typed
                    `Href` strict; no string assembly). aria-label
                    appends the ISO country code for screen readers
                    so the link is unambiguous out of context.
                  */}
                  <ul className="flex flex-col gap-0.5">
                    {INTL_DESTINATION_NAV_ENTRIES.map((entry) => {
                      const iso = intlNavSlugToIso(entry.slug);
                      const ariaLabel =
                        iso !== null
                          ? `${pickEntryLabel(entry, locale)} — ${iso.toUpperCase()}`
                          : pickEntryLabel(entry, locale);
                      const href = ((): React.ComponentProps<typeof Link>['href'] => {
                        switch (entry.slug) {
                          case 'italie':
                            return '/guide/italie';
                          case 'suisse':
                            return '/guide/suisse';
                          case 'maroc':
                            return '/guide/maroc';
                          case 'maldives':
                            return '/guide/maldives';
                          case 'emirats-arabes-unis':
                            return '/guide/emirats-arabes-unis';
                          case 'thailande':
                            return '/guide/thailande';
                          case 'japon':
                            return '/guide/japon';
                          case 'etats-unis':
                            return '/guide/etats-unis';
                          default:
                            return '/hotels';
                        }
                      })();
                      return (
                        <li key={entry.slug}>
                          <Link href={href} aria-label={ariaLabel} className={subLinkClass}>
                            {pickEntryLabel(entry, locale)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <Link href="/destination" className={`${subLinkClass} text-muted text-xs`}>
                    {t('primaryNav.destinationsBrowseAll')}
                  </Link>
                </div>
              </details>

              {/* 3 — Inspiration */}
              <details className="group">
                <summary className={summaryClass}>
                  <span>{t('primaryNav.inspiration')}</span>
                  <Chevron />
                </summary>
                <div className="border-muted/30 ml-3 mt-1 flex flex-col gap-2 border-l pb-2 pl-3">
                  <p className={subHeadingClass}>{t('primaryNav.inspirationByTheme')}</p>
                  <AxisLinkList
                    entries={THEME_NAV_ENTRIES}
                    locale={locale}
                    axe="theme"
                    linkClass={subLinkClass}
                  />
                  <p className={subHeadingClass}>{t('primaryNav.inspirationByOccasion')}</p>
                  <AxisLinkList
                    entries={OCCASION_NAV_ENTRIES}
                    locale={locale}
                    axe="occasion"
                    linkClass={subLinkClass}
                  />
                  <p className={subHeadingClass}>{t('primaryNav.inspirationBySaison')}</p>
                  <AxisLinkList
                    entries={SAISON_NAV_ENTRIES}
                    locale={locale}
                    axe="saison"
                    linkClass={subLinkClass}
                  />
                  <Link href="/inspiration" className={`${subLinkClass} text-muted text-xs`}>
                    {t('primaryNav.inspirationBrowseAll')}
                  </Link>
                </div>
              </details>

              {/* 4 — Classements */}
              <details className="group">
                <summary className={summaryClass}>
                  <span>{t('primaryNav.rankings')}</span>
                  <Chevron />
                </summary>
                <div className="border-muted/30 ml-3 mt-1 flex flex-col gap-2 border-l pb-2 pl-3">
                  <p className={subHeadingClass}>{t('primaryNav.rankingsTop')}</p>
                  <ul className="flex flex-col gap-0.5">
                    {TOP_RANKING_NAV_ENTRIES.map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={{
                            pathname: '/classement/[slug]',
                            params: { slug: entry.slug },
                          }}
                          className={subLinkClass}
                        >
                          {pickEntryLabel(entry, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href="/classements" className={`${subLinkClass} text-muted text-xs`}>
                    {t('primaryNav.rankingsBrowseAll')}
                  </Link>
                </div>
              </details>

              {/* 5 — Le Concierge.
                  Audit 2026-05-25: every dedicated institutional page
                  exists (`/le-conseil-du-concierge`, `/le-concierge/
                  pour-les-hoteliers`, `/le-concierge/mice-et-seminaires`,
                  `/le-concierge/presse-et-partenaires`). Header & mobile
                  now route to those instead of the parent hub. */}
              <details className="group">
                <summary className={summaryClass}>
                  <span>{t('primaryNav.concierge')}</span>
                  <Chevron />
                </summary>
                <div className="border-muted/30 ml-3 mt-1 flex flex-col gap-1 border-l pb-2 pl-3">
                  <Link href="/le-concierge" className={subLinkClass}>
                    {t('primaryNav.conciergeAboutLink')}
                  </Link>
                  <Link href="/le-concierge/reserver" className={subLinkClass}>
                    {t('primaryNav.conciergeBooking')}
                  </Link>
                  {/* Le Concierge Club — programme dedicated landings. */}
                  <Link href="/le-concierge-club" className={subLinkClass}>
                    {t('primaryNav.conciergeClub')}
                  </Link>
                  <Link href="/le-concierge-club/prestige" className={subLinkClass}>
                    {t('primaryNav.conciergeClubPrestige')}
                  </Link>
                  <Link href="/le-concierge/faq" className={subLinkClass}>
                    {t('primaryNav.conciergeFaq')}
                  </Link>
                  <Link href="/le-concierge/methode-editoriale" className={subLinkClass}>
                    {t('primaryNav.conciergeMethod')}
                  </Link>
                  <Link href="/le-conseil-du-concierge" className={subLinkClass}>
                    {t('primaryNav.conciergeTip')}
                  </Link>
                  <Link href="/itineraires" className={subLinkClass}>
                    {t('primaryNav.conciergeItineraries')}
                  </Link>
                  <Link href="/guides" className={subLinkClass}>
                    {t('primaryNav.conciergeGuides')}
                  </Link>
                  <Link href="/le-concierge/pour-les-hoteliers" className={subLinkClass}>
                    {t('primaryNav.conciergeHotelier')}
                  </Link>
                  <Link href="/le-concierge/mice-et-seminaires" className={subLinkClass}>
                    {t('primaryNav.conciergeMice')}
                  </Link>
                  <Link href="/le-concierge/contact" className={subLinkClass}>
                    {t('primaryNav.conciergeContact')}
                  </Link>
                  <Link href="/le-concierge/presse-et-partenaires" className={subLinkClass}>
                    {t('primaryNav.conciergePress')}
                  </Link>
                  <Link href="/presse/le-concierge-club" className={subLinkClass}>
                    {t('primaryNav.conciergeClubPressKit')}
                  </Link>
                </div>
              </details>
            </nav>

            <AuthArea variant="mobile" />
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────

function Chevron(): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="h-3 w-3 opacity-60 transition group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MobileLinkListProps {
  readonly entries: readonly NavLabeledEntry[];
  readonly locale: Locale;
  readonly pathname: '/destination/[citySlug]';
  readonly paramKey: 'citySlug';
  readonly linkClass: string;
}

function MobileLinkList({
  entries,
  locale,
  pathname,
  paramKey,
  linkClass,
}: MobileLinkListProps): ReactElement {
  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <li key={entry.slug}>
          <Link
            href={{ pathname, params: { [paramKey]: entry.slug } as { citySlug: string } }}
            className={linkClass}
          >
            {pickEntryLabel(entry, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface AxisLinkListProps {
  readonly entries: readonly NavLabeledEntry[];
  readonly locale: Locale;
  readonly axe: 'theme' | 'occasion' | 'saison' | 'type' | 'lieu';
  readonly linkClass: string;
}

function AxisLinkList({ entries, locale, axe, linkClass }: AxisLinkListProps): ReactElement {
  return (
    <ul className="flex flex-col gap-0.5">
      {entries.map((entry) => (
        <li key={entry.slug}>
          <Link
            href={{
              pathname: '/classements/[axe]/[valeur]',
              params: { axe, valeur: entry.slug },
            }}
            className={linkClass}
          >
            {pickEntryLabel(entry, locale)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
