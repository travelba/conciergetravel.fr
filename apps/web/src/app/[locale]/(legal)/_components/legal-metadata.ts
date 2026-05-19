import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';

/**
 * Internal pathnames for the four legal pages. These are the *internal*
 * canonical paths (left-hand side of `routing.pathnames`); next-intl
 * `getPathname` resolves them to the right localised slug per locale
 * (e.g. `/cgv` → `/en/terms`, `/mentions-legales` → `/en/legal-notice`).
 */
type LegalPathname = '/cgv' | '/confidentialite' | '/cookies' | '/mentions-legales';

/**
 * Build the canonical + hreflang + OG metadata for a legal page.
 *
 * `args.pathname` is one of the four typed legal pathnames declared in
 * `routing.pathnames`; `getPathname` then yields the correctly localised
 * URL per locale (FR keeps `/cgv` etc., EN switches to `/en/terms`, …).
 */
export async function buildLegalMetadata(args: {
  readonly locale: string;
  readonly pathname: LegalPathname;
  readonly translationsNamespace:
    | 'legal.noticePage'
    | 'legal.privacyPage'
    | 'legal.termsPage'
    | 'legal.cookiesPage';
}): Promise<Metadata> {
  if (!isRoutingLocale(args.locale)) return {};
  const t = await getTranslations({ locale: args.locale, namespace: args.translationsNamespace });
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: args.pathname });
  const title = t('title');
  const description = t('metaDescription');
  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalPath(args.locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      type: 'article',
      title,
      description,
      locale: ogLocale(args.locale),
      siteName: 'MyConciergeHotel',
    },
  };
}
