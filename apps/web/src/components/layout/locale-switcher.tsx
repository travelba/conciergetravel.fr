'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams, useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';

function routeParamsFromUseParams(params: ReturnType<typeof useParams>): Record<string, string> {
  const out: Record<string, string> = {};
  if (params === null) return out;
  for (const [key, value] of Object.entries(params)) {
    if (key === 'locale') continue;
    if (typeof value === 'string' && value.length > 0) {
      out[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) {
      out[key] = value[0];
    }
  }
  return out;
}

/**
 * Pure-link locale switcher (skill: seo-technical §hreflang).
 *
 * Renders an `<a>` to the **same logical path** in the other locale.
 * `usePathname()` from `next-intl/navigation` returns the path WITHOUT
 * the locale prefix, so passing it to `<Link locale="…" />` re-prefixes
 * it correctly for the target locale.
 *
 * We preserve the query string verbatim — important on `/recherche`
 * where the form state lives in the URL — and never carry the fragment
 * (Next routing strips it client-side anyway).
 *
 * Returning a single `<a>` (instead of a `<button>`) gives crawlers a
 * proper `rel="alternate"`-equivalent link to the localized page, even
 * though we already emit `<link rel="alternate" hreflang>` in metadata.
 */
export function LocaleSwitcher(): ReactElement {
  const t = useTranslations('header.locale');
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeParams = routeParamsFromUseParams(useParams());

  const otherLocale: Locale = currentLocale === 'fr' ? 'en' : routing.defaultLocale;
  const qs = searchParams.toString();

  const href: Parameters<typeof Link>[0]['href'] =
    pathname.includes('[') && Object.keys(routeParams).length > 0
      ? ({
          pathname,
          params: routeParams,
        } as Parameters<typeof Link>[0]['href'])
      : ((qs.length > 0 ? `${pathname}?${qs}` : pathname) as Parameters<typeof Link>[0]['href']);

  return (
    <Link
      href={href}
      locale={otherLocale}
      aria-label={t('label')}
      hrefLang={otherLocale === 'fr' ? 'fr-FR' : 'en'}
      className="text-muted hover:bg-muted/10 hover:text-fg focus-visible:ring-ring rounded-md px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2"
    >
      <span aria-hidden>{otherLocale === 'fr' ? 'FR' : 'EN'}</span>
      <span className="sr-only">{t('switchTo')}</span>
    </Link>
  );
}
