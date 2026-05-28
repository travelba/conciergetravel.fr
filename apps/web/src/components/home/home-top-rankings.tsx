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
    <section
      aria-labelledby="home-top-rankings"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-top-rankings" className="text-fg mt-2 font-serif text-3xl sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Link
          href="/classements"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('seeAll')}
        </Link>
      </div>

      {/*
        Mobile : carrousel snap horizontal (1 card visible + peek du
        suivant). Desktop : grille 2-cols (sm) → 3-cols (lg). Voir
        `.cursor/skills/responsive-ui-architecture/SKILL.md` §"Snap
        carousels".
      */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
        {top6.map((r) => {
          const title = pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr);
          const summary = pickByLocale(
            locale,
            r.factualSummaryFr ?? '',
            r.factualSummaryEn ?? r.factualSummaryFr ?? '',
          );
          return (
            <li key={r.slug} className="shrink-0 basis-[82%] snap-start sm:basis-auto">
              <Link
                href={{ pathname: '/classement/[slug]', params: { slug: r.slug } }}
                className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <p className="text-muted text-[10px] uppercase tracking-[0.18em]">
                  {r.entryCount > 0 ? t('entryCount', { count: r.entryCount }) : null}
                </p>
                <h3 className="text-fg mt-1 font-serif text-lg leading-snug">{title}</h3>
                {summary !== '' ? (
                  <p className="text-muted mt-3 line-clamp-3 text-sm">{summary}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
