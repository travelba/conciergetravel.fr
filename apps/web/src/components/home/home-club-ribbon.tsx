import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeClubRibbon>` — Le Concierge Club institutional ribbon.
 *
 * After the 2026-05-26 PO consolidation, both tiers (free Club +
 * Prestige waitlist) live on a single landing — the ribbon now
 * carries one canonical CTA and the Prestige tier is discovered
 * in-page (`#prestige` anchor). Single-row framed border so it
 * reads as institutional rather than promotional — Phase 1 only
 * advertises the free tier perks (ADR-0020 SEA constraints).
 *
 * Pure RSC.
 */
export async function HomeClubRibbon({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.clubRibbon' });

  return (
    <section
      aria-labelledby="home-club-ribbon-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-10 sm:py-12"
    >
      <div className="border-border bg-muted/5 flex flex-col items-start gap-5 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-club-ribbon-title" className="text-fg mt-2 font-serif text-2xl sm:text-3xl">
            {t('title')}
          </h2>
          <p className="text-muted mt-2 text-sm sm:text-base">{t('body')}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/le-concierge-club"
            className="bg-primary-heritage text-off-white hover:bg-primary-heritage/90 focus-visible:ring-ring inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('ctaDiscover')}
          </Link>
        </div>
      </div>
    </section>
  );
}
