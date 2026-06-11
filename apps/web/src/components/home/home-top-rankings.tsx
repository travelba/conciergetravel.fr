import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import { KIT_STATIC_RANKINGS, kitStaticLinkHref } from '@/lib/home/kit-home-static-fallback';
import type { PublishedRankingCard } from '@/server/rankings/get-ranking-by-slug';

/**
 * `<HomeTopRankings>` — « Les meilleurs hôtels, selon nos critères »
 * (design/html-kit §offres). Live top-6 by entry count when Supabase
 * is wired; static kit cards otherwise.
 */
export async function HomeTopRankings({
  locale,
  rankings,
}: {
  readonly locale: Locale;
  readonly rankings: readonly PublishedRankingCard[];
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.featuredRankings' });
  const top6 = [...rankings].sort((a, b) => b.entryCount - a.entryCount).slice(0, 6);
  const useStatic = top6.length === 0;

  return (
    <div className="mch-kit">
      <section className="section-pad section-noir" id="offres" aria-labelledby="home-top-rankings">
        <div className="wrap">
          <div className="mag-head reveal">
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

          <div className="rank-grid reveal">
            {useStatic
              ? KIT_STATIC_RANKINGS.map((tile) => {
                  const title = pickByLocale(locale, tile.titleFr, tile.titleEn);
                  const count = pickByLocale(locale, tile.countLabelFr, tile.countLabelEn);
                  const desc = pickByLocale(locale, tile.descFr, tile.descEn);
                  return (
                    <Link
                      key={tile.titleFr}
                      href={kitStaticLinkHref(tile.link)}
                      className="rank-card"
                    >
                      <span className="rk-count">{count}</span>
                      <h3>{title}</h3>
                      <span className="rk-desc">{desc}</span>
                    </Link>
                  );
                })
              : top6.map((r) => {
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
