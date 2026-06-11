import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * `<HomeTrustBar>` — « bandeau atouts » ported from the HTML kit
 * (design/html-kit/index.html §atouts). Four sober editorial signals on
 * cream-3 paper with taupe line icons: éditorial selection, IATA agency,
 * Concierge tip, loyalty programme. Distinct from the hero réassurance
 * pills (cancellation / payment / best rate) — this band states the
 * institutional positioning rather than booking comfort.
 */
export async function HomeTrustBar({ locale }: { readonly locale: Locale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.atouts' });

  const items = [
    { key: 'selection', icon: 'star' as const },
    { key: 'iata', icon: 'globe' as const },
    { key: 'advice', icon: 'chat' as const },
    { key: 'loyalty', icon: 'heart' as const },
  ] as const;

  return (
    <div className="mch-kit">
      <section className="atouts" aria-label={t('ariaLabel')}>
        <div className="wrap atouts-grid reveal">
          {items.map(({ key, icon }) => (
            <div className="atout" key={key}>
              <AtoutIcon type={icon} />
              <div className="atout-tx">
                <b>{t(`${key}.title`)}</b>
                <span>{t(`${key}.desc`)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AtoutIcon({ type }: { readonly type: 'star' | 'globe' | 'chat' | 'heart' }): ReactElement {
  switch (type) {
    case 'star':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2l2.5 5 5.5.8-4 3.9 1 5.5L12 20l-5 2.6 1-5.5-4-3.9 5.5-.8z" />
        </svg>
      );
    case 'globe':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    case 'chat':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      );
    case 'heart':
      return (
        <svg className="icon" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2 5 5.5 5 7.5 5 9 6.2 10 7.6 11.1 6.2 12.5 5 14.5 5 18 5 19.5 8.4 22 11.8 19.5 16.4 12 21 12 21z" />
        </svg>
      );
  }
}
