/**
 * Sub-sitemap hreflang alternates — V2 multilingual helper.
 *
 * Replaces the FR/EN hardcoded `alternates` arrays in every
 * `app/sitemaps/*.xml/route.ts`. Iterates `routing.locales` so adding a
 * locale to V2 (DE/ES/IT) extends every sub-sitemap automatically, with
 * the same hreflang convention used by `Metadata.alternates.languages`.
 *
 * Companion of `apps/web/src/i18n/runtime.ts#buildHreflangAlternates`
 * but emits the `<xhtml:link>`-array shape consumed by
 * `@mch/seo` `SitemapEntry.alternates` (object map vs array of pairs).
 *
 * See `.cursor/skills/seo-technical/SKILL.md` §V2 multilingual rollout
 * and `docs/runbooks/i18n-v2-rollout.md` Phase 1b paquet 10.
 */

import { routing, type Locale } from '@/i18n/routing';
import { hreflangKey } from '@/i18n/runtime';

export interface SitemapAlternate {
  readonly hreflang: string;
  readonly href: string;
}

/**
 * Build the `alternates` array for a sitemap `<url>` entry, iterating
 * every locale in `routing.locales` plus `x-default` (which always
 * points at the default-locale URL — FR in V1).
 *
 * The caller supplies a function that returns the **absolute** URL for
 * a given locale (origin + locale prefix + path + slug). Per-locale
 * slug or path differences (e.g. `slug_en ?? slug_fr` on hotels, or
 * future `routing.pathnames` overrides) are handled by the caller.
 *
 * @example
 *   alternates: buildSitemapAlternates((l) =>
 *     l === 'en'
 *       ? `${origin}/en/hotel/${s.slugEn ?? s.slugFr}`
 *       : `${origin}/hotel/${s.slugFr}`,
 *   ),
 *   // V1 → [{fr-FR}, {en}, {x-default → FR}]
 *   // V2 → [{fr-FR}, {en}, {de}, {es}, {it}, {x-default → FR}]
 */
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
