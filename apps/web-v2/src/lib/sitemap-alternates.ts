import { routing, type Locale } from '@/i18n/routing';

export interface SitemapAlternate {
  readonly hreflang: string;
  readonly href: string;
}

function hreflangKey(locale: Locale): string {
  return locale === 'fr' ? 'fr-FR' : locale;
}

/** hreflang alternates for v2 sub-sitemaps (fr + en + x-default). */
export function buildSitemapAlternates(
  hrefForLocale: (locale: Locale) => string,
): readonly SitemapAlternate[] {
  const alternates: SitemapAlternate[] = [];
  for (const locale of routing.locales) {
    alternates.push({ hreflang: hreflangKey(locale), href: hrefForLocale(locale) });
  }
  alternates.push({ hreflang: 'x-default', href: hrefForLocale(routing.defaultLocale) });
  return alternates;
}
