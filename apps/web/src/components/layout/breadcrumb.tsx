import { getLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';

/**
 * `<Breadcrumb>` — visible fil d'ariane mirror of the `BreadcrumbList`
 * JSON-LD (ADR-0014 §2.4).
 *
 * Rendering contract:
 * - Server Component, reads the current pathname from the `x-pathname`
 *   request header (set by `proxy.ts`).
 * - Renders **nothing** on the home page (`/` or `/<locale>`).
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
 *   should keep their own page-level breadcrumb (already in place).
 * - For these pages, this global Breadcrumb stays hidden (returns
 *   `null`) so we don't show a generic placeholder. The decision to
 *   show/hide is made by the per-segment map below.
 *
 * Accessibility:
 * - `<nav aria-label>` for the landmark.
 * - Ordered list `<ol>` reflects the hierarchy.
 * - Visual separator `›` is `aria-hidden`.
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 */
export async function Breadcrumb(): Promise<ReactElement | null> {
  const headersList = await headers();
  const rawPath = headersList.get('x-pathname') ?? '/';
  const locale = (await getLocale()) as Locale;
  if (!isRoutingLocale(locale)) return null;

  // Strip the leading `/<locale>` prefix to get the bare path. For
  // the default locale (fr) next-intl doesn't add the prefix to the
  // URL but the proxy header still uses the raw URL — we handle
  // both shapes.
  const localePrefix = `/${locale}`;
  const bare =
    rawPath === localePrefix
      ? '/'
      : rawPath.startsWith(`${localePrefix}/`)
        ? rawPath.slice(localePrefix.length)
        : rawPath;

  // Skip the home page.
  if (bare === '/' || bare === '') return null;

  const segments = bare.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const t = await getTranslations('header.breadcrumb');

  // Map the first segment (the top-level entry) to a label + href.
  // Dynamic params (`[slug]`, `[citySlug]`, …) live at index 1+ and
  // are intentionally NOT resolved here — see component docstring.
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
    <nav aria-label={t('label')} className="container mx-auto max-w-screen-xl px-4 pt-3 text-xs">
      <ol className="text-muted flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:underline">
            {t('home')}
          </Link>
        </li>
        <li aria-hidden>›</li>
        {isDeep ? (
          <>
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
                className="hover:underline"
              >
                {topLevel.label}
              </Link>
            </li>
            {/* Deeper label (slug, city, axe…) is rendered by the
                page-specific breadcrumb, not here. */}
          </>
        ) : (
          <li className="text-fg" aria-current="page">
            {topLevel.label}
          </li>
        )}
      </ol>
    </nav>
  );
}
