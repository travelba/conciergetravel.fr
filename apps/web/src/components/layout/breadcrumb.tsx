'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Link, usePathname } from '@/i18n/navigation';

/**
 * `<Breadcrumb>` — visible fil d'ariane mirror of the `BreadcrumbList`
 * JSON-LD (ADR-0014 §2.4).
 *
 * Rendering contract:
 * - **Client Component**, derives the current route from `usePathname()`
 *   (next-intl, locale-stripped). It MUST be client-driven because it
 *   lives in the shared `[locale]/layout.tsx`, which the App Router does
 *   NOT re-render on client-side (soft) navigation. A server `headers()`
 *   read would freeze the crumb at the first hard load — e.g. landing on
 *   the home from an inner page would keep showing "Accueil › Classements".
 *   `usePathname()` re-evaluates on every navigation.
 * - Renders **nothing** on the home page (`/`).
 * - On every other page, emits a sober `<nav aria-label="Fil d'ariane">`
 *   with up to 3 levels: Home → (Section) → Current.
 * - The deepest segment carries `aria-current="page"`.
 *
 * Limitations / scope:
 * - This is a "section-level" breadcrumb: it shows the entry segment
 *   (Hotels / Destinations / Inspiration / Classements / Le Concierge)
 *   but does NOT resolve dynamic params (`[slug]`, `[citySlug]`, etc.)
 *   to a human-readable label. Pages that need the deepest label
 *   (`/hotel/<slug>`, `/destination/<city>`, `/classement/<slug>`)
 *   keep their own page-level breadcrumb (already in place).
 *
 * Accessibility:
 * - `<nav aria-label>` for the landmark.
 * - Ordered list `<ol>` reflects the hierarchy.
 * - Visual separator `›` is `aria-hidden`.
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 */
export function Breadcrumb(): ReactElement | null {
  // next-intl `usePathname()` returns the locale-stripped pathname
  // (`/classements`, `/`, …) and re-renders on every soft navigation.
  const bare = usePathname();
  const t = useTranslations('breadcrumb');

  // Skip the home page.
  if (bare === '/') return null;

  const segments = bare.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const TOP_LEVEL_LABEL: Record<string, { label: string; href: string } | undefined> = {
    hotel: { label: t('hotels'), href: '/hotels' },
    hotels: { label: t('hotels'), href: '/hotels' },
    categorie: { label: t('categories'), href: '/hotels' },
    classement: { label: t('rankings'), href: '/classements' },
    classements: { label: t('rankings'), href: '/classements' },
    destination: { label: t('destinations'), href: '/destination' },
    guide: { label: t('guides'), href: '/destination' },
    guides: { label: t('guides'), href: '/destination' },
    inspiration: { label: t('inspiration'), href: '/inspiration' },
    'le-concierge': { label: t('concierge'), href: '/le-concierge' },
    'a-propos': { label: t('concierge'), href: '/le-concierge' },
    marque: { label: t('brands'), href: '/marques' },
    marques: { label: t('brands'), href: '/marques' },
    recherche: { label: t('search'), href: '/recherche' },
    search: { label: t('search'), href: '/recherche' },
    compte: { label: t('account'), href: '/compte' },
    account: { label: t('account'), href: '/compte' },
    reservation: { label: t('booking'), href: '/recherche' },
    booking: { label: t('booking'), href: '/recherche' },
    'mentions-legales': { label: t('legal'), href: '/mentions-legales' },
    confidentialite: { label: t('legal'), href: '/mentions-legales' },
    cgv: { label: t('legal'), href: '/mentions-legales' },
    cookies: { label: t('legal'), href: '/mentions-legales' },
  };

  const firstSegment = segments[0] ?? '';

  // Hotel fiches ship a full page-level breadcrumb (city + hotel name).
  if (firstSegment === 'hotel') return null;

  const topLevel = TOP_LEVEL_LABEL[firstSegment];
  if (topLevel === undefined) {
    // Unmapped route → render no breadcrumb to avoid a confusing chain.
    return null;
  }

  // For pages deeper than one segment, the bottom of the breadcrumb
  // is left blank — the page-specific breadcrumb (visible in
  // `/hotel/[slug]`, `/destination/[citySlug]`, etc.) carries the
  // contextual label. We render the section landing as the deepest
  // visible step so users still see "Accueil › Hôtels" on
  // `/categorie/palaces-paris` for instance.
  const isDeep = segments.length > 1;

  return (
    <nav aria-label={t('label')} className="mch-kit container mx-auto max-w-screen-xl px-4 pt-3">
      <ol className="breadcrumb">
        <li>
          <Link href="/">{t('home')}</Link>
        </li>
        <li className="sep" aria-hidden>
          ›
        </li>
        {isDeep ? (
          <li>
            {/*
              The href is a known route from the typed `pathnames`
              map — the lookup is exhaustive across the values of
              TOP_LEVEL_LABEL. We assert it via the cast on hardcoded
              strings (the map is in-source).
            */}
            <Link
              href={
                topLevel.href as
                  | '/hotels'
                  | '/destination'
                  | '/inspiration'
                  | '/classements'
                  | '/le-concierge'
                  | '/marques'
                  | '/recherche'
                  | '/compte'
                  | '/mentions-legales'
              }
            >
              {topLevel.label}
            </Link>
            {/* Deeper label (slug, city, axe…) is rendered by the
                page-specific breadcrumb, not here. */}
          </li>
        ) : (
          <li className="bc-current" aria-current="page">
            {topLevel.label}
          </li>
        )}
      </ol>
    </nav>
  );
}
