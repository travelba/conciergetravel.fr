import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale, withLocalePath } from '@/i18n/runtime';

/**
 * Build the canonical + hreflang + OG metadata for a legal page.
 * Same slug in both locales (`/<slug>` in FR, `/en/<slug>` in EN) —
 * mirrors the rest of the site.
 */
export async function buildLegalMetadata(args: {
  readonly locale: string;
  readonly slug: string;
  readonly translationsNamespace:
    | 'legal.noticePage'
    | 'legal.privacyPage'
    | 'legal.termsPage'
    | 'legal.cookiesPage';
}): Promise<Metadata> {
  if (!isRoutingLocale(args.locale)) return {};
  const t = await getTranslations({ locale: args.locale, namespace: args.translationsNamespace });
  const buildCanonicalPath = (l: Locale): string => withLocalePath(l, `/${args.slug}`);
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
