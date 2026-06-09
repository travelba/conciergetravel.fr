import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { PublishedRankingCard } from '@/server/rankings/get-ranking-by-slug';

/**
 * `<HomeTopRankings>` — « Les meilleurs hôtels, selon nos critères ».
 *
 * Six classements automatiquement sélectionnés sur la métrique
 * `entryCount desc` (cf. `listPublishedRankings`). Au 2026-05-28 le top
 * 6 effectif est : World's 50 Best 2025 (100), Condé Nast Gold List
 * 2025-26 (70), Italie (50), USA (50), Royaume-Uni (48), Japon (38) —
 * un mix sain entre prix institutionnels et géographies, sans
 * curation manuelle à maintenir.
 *
 * Decision (PO 2026-05-28) — automatic top-by-entry-count plutôt qu'une
 * liste figée (`TOP_RANKING_NAV_ENTRIES`). Avantage : zéro maintenance
 * quand de nouveaux classements sont publiés. Inconvénient : si on
 * publie 6 classements géographiques massifs, le mix éditorial peut
 * dériver. À reconsidérer si la diversité du top 6 devient un sujet.
 *
 * Pure RSC. Reçoit l'array complet en prop (Promise.all parent).
 */
export async function HomeTopRankings({
  locale,
  rankings,
}: {
  readonly locale: Locale;
  readonly rankings: readonly PublishedRankingCard[];
}): Promise<ReactElement | null> {
  if (rankings.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'homepage.featuredRankings' });

  const top6 = [...rankings].sort((a, b) => b.entryCount - a.entryCount).slice(0, 6);
  if (top6.length === 0) return null;

  return (
    <div className="mch-kit">
      <section className="section-pad section-noir" id="offres" aria-labelledby="home-top-rankings">
        <div className="wrap">
          <div className="mag-head">
            <div className="mh-left">
              <span className="eyebrow left">{t('eyebrow')}</span>
              <h2 id="home-top-rankings" className="on-dark">
                {t('title')}
              </h2>
              <p className="on-dark-doux">{t('subtitle')}</p>
            </div>
            <Link href="/classements" className="link-or">
              {t('seeAll')} →
            </Link>
          </div>

          <div className="rank-grid">
            {top6.map((r) => {
              const title = pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr);
              const summary = pickByLocale(
                locale,
                r.factualSummaryFr ?? '',
                r.factualSummaryEn ?? r.factualSummaryFr ?? '',
              );
              return (
                <Link
                  key={r.slug}
                  href={{ pathname: '/classement/[slug]', params: { slug: r.slug } }}
                  className="rank-card"
                >
                  {r.entryCount > 0 ? (
                    <span className="rk-count">{t('entryCount', { count: r.entryCount })}</span>
                  ) : null}
                  <h3>{title}</h3>
                  {summary !== '' ? <span className="rk-desc">{summary}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
