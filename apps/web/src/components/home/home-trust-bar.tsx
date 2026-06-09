import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * `<HomeTrustBar>` — institutional trust strip below the hero.
 *
 * Matches the Stitch « home hybride » charter: four sober signals on
 * cream paper, laiton icons, no promotional noise.
 */
export async function HomeTrustBar({ locale }: { readonly locale: Locale }): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.trustBar' });

  const items = [
    { key: 'iata', icon: 'shield' as const },
    { key: 'advisors', icon: 'chat' as const },
    { key: 'rate', icon: 'tag' as const },
    { key: 'payment', icon: 'lock' as const },
  ] as const;

  return (
    <section
      aria-label={t('ariaLabel')}
      className="border-gold-300/50 bg-surface-container-high/60 border-b"
      data-home-trust-bar
    >
      <div className="container mx-auto max-w-screen-xl px-4 py-5">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {items.map(({ key, icon }) => (
            <li key={key} className="flex items-center gap-3">
              <TrustIcon type={icon} />
              <span className="text-fg text-sm leading-snug">{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrustIcon({ type }: { readonly type: 'shield' | 'chat' | 'tag' | 'lock' }): ReactElement {
  const className = 'text-gold h-5 w-5 shrink-0';
  switch (type) {
    case 'shield':
      return (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M10 2.5L4 5v5c0 3.5 2.5 6 6 7.5 3.5-1.5 6-4 6-7.5V5L10 2.5z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'chat':
      return (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 5.5h12v7H8l-4 3v-3V5.5z" strokeLinejoin="round" />
        </svg>
      );
    case 'tag':
      return (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M11 3.5h5.5V9L10 15.5 4.5 10 11 3.5z" strokeLinejoin="round" />
          <circle cx="14" cy="6" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'lock':
      return (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="5" y="9" width="10" height="7" rx="1.5" />
          <path d="M7 9V6.5a3 3 0 016 0V9" strokeLinecap="round" />
        </svg>
      );
  }
}
