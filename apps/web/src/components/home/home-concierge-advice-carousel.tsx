import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getHomeConciergeAdvicePicks } from '@/lib/home/concierge-advice-pool';

/**
 * `<HomeConciergeAdviceCarousel>` — trois Conseils du Concierge réels
 * échantillonnés depuis Supabase avec une graine déterministe daily.
 *
 * Sober card layout (3 colonnes desktop, stack mobile), avec :
 * - le hotel name + city + country pour ancrer l'origine du conseil
 * - le `tip_for` (chambre / table / timing / accès…)
 * - le body court (50-110 mots) tel que rédigé par la pipeline
 *   editorial-pilot (Phase 3, ADR-0011)
 * - lien vers la fiche source
 *
 * Pure RSC. Fetch interne (cached, daily reshuffle).
 */
export async function HomeConciergeAdviceCarousel({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.conciergeAdvice' });
  const picks = await getHomeConciergeAdvicePicks(locale, 3);

  return (
    <section
      aria-labelledby="home-concierge-advice-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2
            id="home-concierge-advice-title"
            className="text-fg mt-2 font-serif text-3xl sm:text-4xl"
          >
            {t('title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Link
          href="/le-conseil-du-concierge"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('viewAll')}
        </Link>
      </div>

      {picks.length === 0 ? (
        <p className="text-muted text-sm">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((p) => (
            <li key={p.hotelSlug}>
              <article className="border-border bg-bg flex h-full flex-col rounded-lg border p-5">
                <p className="text-muted text-[10px] uppercase tracking-[0.18em]">{p.tipFor}</p>
                <h3 className="text-fg mt-2 font-serif text-lg leading-snug">{p.title}</h3>
                <p className="text-fg/85 mt-3 line-clamp-5 text-sm leading-relaxed">{p.body}</p>
                <div className="mt-4 flex items-center justify-between gap-3 pt-3">
                  <p className="text-muted text-xs">
                    {p.hotelName} · {p.city}
                  </p>
                  <Link
                    href={{ pathname: '/hotel/[slug]', params: { slug: p.hotelSlug } }}
                    className="text-fg shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                  >
                    {t('openFiche')}
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
