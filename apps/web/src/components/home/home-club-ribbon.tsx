import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeClubRibbon>` — Le Concierge Club ported to the HTML kit `club`
 * layout (design/html-kit/index.html §"Le Concierge Club"). Watercolour
 * visual + benefits checklist + single canonical CTA. Phase 1 only
 * advertises the free tier perks (ADR-0020 SEA constraints); the
 * Prestige tier is discovered in-page on `/le-concierge-club`.
 *
 * Pure RSC.
 */
export async function HomeClubRibbon({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.clubRibbon' });
  const benefits = [t('benefit1'), t('benefit2'), t('benefit3'), t('benefit4')];

  return (
    <div className="mch-kit">
      <section className="club" id="le-concierge-club" aria-labelledby="home-club-ribbon-title">
        <div className="wrap club-inner">
          <div className="club-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit/img/club_concierge.jpg" alt={t('visualAlt')} loading="lazy" />
          </div>
          <div className="club-body">
            <div className="club-tx">
              <span className="eyebrow left">{t('eyebrow')}</span>
              <h2 id="home-club-ribbon-title">{t('title')}</h2>
              <p>{t('body')}</p>
              <Link href="/le-concierge-club" className="btn btn-or">
                {t('ctaDiscover')}
              </Link>
            </div>
            <ul className="club-list">
              {benefits.map((b) => (
                <li key={b}>
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
