import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { RankingLookup } from '@/server/itineraries/get-related-data';

interface RelatedRankingsProps {
  readonly locale: Locale;
  readonly rankings: readonly RankingLookup[];
}

/**
 * Internal-link block to relevant editorial rankings (CDC §6.3 mesh).
 * Renders nothing when 0 rankings — the page-level wiring guarantees
 * we resolved against `related_ranking_ids[]` first, so a `null`
 * return only ever means "no published ranking matched".
 *
 * Anchor text uses the localised ranking title — never a generic
 * "view ranking" verbiage (rule `seo-geo.mdc` §anti-cannibalisation
 * and `itinerary-page.mdc` §5.1).
 */
export async function RelatedRankings({ locale, rankings }: RelatedRankingsProps) {
  if (rankings.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'itineraires.detail' });

  return (
    <section id="related-rankings" className="mt-14 scroll-mt-24">
      <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">
        {t('relatedRankingsHeading')}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
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
                className="border-border bg-bg group flex flex-col gap-2 rounded-md border p-4 hover:border-amber-400"
              >
                <span className="text-fg text-sm font-medium">{title}</span>
                {summary.length > 0 ? (
                  <span className="text-muted line-clamp-2 text-xs">{summary}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
