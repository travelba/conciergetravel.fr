import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import type { HotelRankingMention } from '@/server/rankings/get-rankings-for-hotel';

interface Props {
  readonly mentions: ReadonlyArray<HotelRankingMention>;
  readonly locale: SupportedLocale;
}

/**
 * Internal-link block surfaced near the bottom of the hotel detail
 * page (CDC §15 Footer fiche + plan rankings-parity-yonder WS2.5 v4).
 *
 * Renders nothing when the hotel hasn't been featured in any
 * published ranking — keeps the page clean for fresh entries.
 */
export async function HotelFeaturedInRankings({
  mentions,
  locale,
}: Props): Promise<ReactElement | null> {
  if (mentions.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'hotelFeaturedInRankings' });

  return (
    <section
      id="featured-in-rankings"
      aria-labelledby="featured-in-rankings-title"
      className="mb-10 mt-10 scroll-mt-24"
    >
      <h2 id="featured-in-rankings-title" className="text-fg mb-3 font-serif text-2xl">
        {t('title')}
      </h2>
      <p className="text-muted mb-5 text-sm">{t('subtitle')}</p>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {mentions.map((m) => {
          const title = pickLocalizedText(locale, m.titleFr, m.titleEn) ?? m.titleFr;
          const badge = pickLocalizedText(locale, m.badgeFr, m.badgeEn);
          return (
            <li
              key={m.slug}
              className="border-border bg-bg/60 rounded-lg border p-4 transition hover:shadow-md"
            >
              <Link
                href={{ pathname: '/classement/[slug]', params: { slug: m.slug } }}
                className="flex items-baseline gap-3"
              >
                <span className="text-fg/80 font-serif text-xl font-light">
                  {t('rankLabel', { rank: m.rank })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-fg block text-sm font-medium underline-offset-2 hover:underline">
                    {title}
                  </span>
                  {badge !== null && badge !== undefined && badge !== '' ? (
                    <span className="border-gold-300/60 bg-gold-50/40 text-gold-800 mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px]">
                      {badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
