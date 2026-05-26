import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { RankingLookup } from '@/server/itineraries/get-related-data';

/**
 * Generic Server-rendered cross-link block listing published
 * rankings. Used by:
 *   - `/destination/[citySlug]` to surface rankings about that city.
 *   - `/classement/[slug]` to surface sibling rankings on the same lieu.
 *   - `/itineraire/[slug]` (existing `<RelatedRankings>` keeps its
 *     own copy tied to the itinerary i18n namespace).
 *
 * Heading + intro are passed by the caller — keeps the component
 * un-coupled from any specific i18n namespace. Renders nothing when
 * the array is empty so the parent doesn't have to gate visibility.
 *
 * Maillage interne (rule `seo-geo.mdc` §Maillage) — anchor text uses
 * the localised ranking title, never a generic "view ranking" verbiage
 * (preserves keyword equity flow).
 */
export function RelatedRankingsList({
  locale,
  heading,
  intro,
  rankings,
  cta,
  className,
}: {
  readonly locale: Locale;
  readonly heading: string;
  readonly intro?: string;
  readonly rankings: readonly RankingLookup[];
  readonly cta: string;
  readonly className?: string;
}): ReactElement | null {
  if (rankings.length === 0) return null;
  return (
    <section
      aria-labelledby="related-rankings-list-title"
      className={`border-border bg-muted/5 rounded-lg border p-6 md:p-8 ${className ?? ''}`}
    >
      <h2 id="related-rankings-list-title" className="text-fg font-serif text-2xl sm:text-3xl">
        {heading}
      </h2>
      {intro !== undefined && intro.length > 0 ? (
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{intro}</p>
      ) : null}
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rankings.map((r) => {
          const title = pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr);
          const summary = pickByLocale(
            locale,
            r.factualSummaryFr ?? '',
            r.factualSummaryEn ?? r.factualSummaryFr ?? '',
          );
          return (
            <li key={r.id}>
              <Link
                href={{ pathname: '/classement/[slug]', params: { slug: r.slug } }}
                className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
              >
                <h3 className="text-fg font-serif text-base">{title}</h3>
                {summary.length > 0 ? (
                  <p className="text-muted mt-2 line-clamp-3 text-xs">{summary}</p>
                ) : null}
                <span className="text-fg mt-3 inline-block text-xs font-medium underline-offset-4">
                  {cta} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
