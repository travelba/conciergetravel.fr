import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<HomeInspirationGrid>` — « Par occasion » ported to the HTML kit
 * `occ-grid` layout (design/html-kit/index.html §"Par occasion"). Six
 * axes (5 `theme` + 1 `occasion`) mapping onto the rankings matrix
 * `/classements/[axe]/[valeur]`. Each tile is a full-bleed editorial
 * photo with a legibility gradient and overlaid title + lede.
 *
 * Pure RSC.
 */
type InspirationCard = {
  readonly messageKey: 'spa' | 'famille' | 'golf' | 'luneDeMiel' | 'gastronomie' | 'rooftop';
  readonly axe: 'theme' | 'occasion';
  readonly valeur: string;
  readonly img: string;
};

const CARDS: readonly InspirationCard[] = [
  { messageKey: 'spa', axe: 'theme', valeur: 'spa-bienetre', img: 'occ_spa.jpg' },
  { messageKey: 'famille', axe: 'theme', valeur: 'famille', img: 'occ_balneaire.jpg' },
  { messageKey: 'golf', axe: 'theme', valeur: 'sport-golf', img: 'occ_retraite.jpg' },
  { messageKey: 'luneDeMiel', axe: 'occasion', valeur: 'lune-de-miel', img: 'occ_lunedemiel.jpg' },
  { messageKey: 'gastronomie', axe: 'theme', valeur: 'gastronomie', img: 'occ_gastronomie.jpg' },
  { messageKey: 'rooftop', axe: 'theme', valeur: 'rooftop', img: 'occ_rooftop.jpg' },
];

export async function HomeInspirationGrid({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.inspiration' });

  return (
    <div className="mch-kit">
      <section
        className="section-pad section-creme2"
        id="experiences"
        aria-labelledby="home-inspiration-title"
      >
        <div className="wrap">
          <div className="mag-head">
            <div className="mh-left">
              <span className="eyebrow left">{t('eyebrow')}</span>
              <h2 id="home-inspiration-title">{t('title')}</h2>
              <p>{t('subtitle')}</p>
            </div>
            <Link href="/classements" className="link-or">
              {t('seeAll')} →
            </Link>
          </div>

          <div className="occ-grid">
            {CARDS.map((card) => {
              const style = { '--bg': `url('/kit/img/${card.img}')` } as CSSProperties;
              return (
                <Link
                  key={card.messageKey}
                  href={{
                    pathname: '/classements/[axe]/[valeur]',
                    params: { axe: card.axe, valeur: card.valeur },
                  }}
                  className="occ-card"
                  style={style}
                >
                  <div className="occ-tx">
                    <h3>{t(`axes.${card.messageKey}.title`)}</h3>
                    <span>{t(`axes.${card.messageKey}.subtitle`)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
