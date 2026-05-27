import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeInspirationGrid>` — 6 axes thème × occasion (CDC §2 +
 * inspiration Tablet "Style & Mood" / Yonder thématiques).
 *
 * Sober editorial grid. Each axis points to `/classements` for now
 * (Phase 1 — the index page lists all rankings; specific axis slugs
 * will be wired in a follow-up once the ranking matrix is stable).
 *
 * Pure RSC.
 */
export async function HomeInspirationGrid({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.inspiration' });

  const axes = ['famille', 'romantique', 'spa', 'ski', 'gastronomie', 'design'] as const;

  return (
    <section
      aria-labelledby="home-inspiration-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-inspiration-title" className="text-fg mt-2 font-serif text-3xl sm:text-4xl">
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

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {axes.map((axis) => (
          <li key={axis}>
            <Link
              href="/classements"
              className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <h3 className="text-fg font-serif text-lg">{t(`axes.${axis}.title`)}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                {t(`axes.${axis}.subtitle`)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
