import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * Bandeau « Le Concierge » — port of `design/html-kit/index.html`
 * §concierge-feature (between atouts and recently visited).
 */
export async function HomeConciergeFeature({
  locale,
}: {
  readonly locale: Locale;
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.conciergeFeature' });
  const bullets = [t('bullet1'), t('bullet2'), t('bullet3')];

  return (
    <div className="mch-kit">
      <section
        className="concierge-feature"
        id="le-concierge"
        aria-labelledby="home-concierge-feature-title"
      >
        <div className="wrap cf-grid reveal">
          <div className="cf-tx">
            <span className="eyebrow left">{t('eyebrow')}</span>
            <h2 id="home-concierge-feature-title">{t('title')}</h2>
            <p>{t('body')}</p>
            <ul className="cf-list">
              {bullets.map((item) => (
                <li key={item}>
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a href="#le-concierge-club" className="btn btn-or">
              {t('cta')}
            </a>
          </div>
          <div className="cf-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kit/img/concierge_band.jpg" alt={t('visualAlt')} loading="lazy" />
          </div>
        </div>
      </section>
    </div>
  );
}
