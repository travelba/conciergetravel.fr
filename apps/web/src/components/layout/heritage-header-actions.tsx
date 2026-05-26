import { getTranslations } from 'next-intl/server';
import { Suspense, type ReactElement } from 'react';

import { Link } from '@/i18n/navigation';

import { LocaleSwitcher } from './locale-switcher';

const iconButtonClass =
  'text-primary-heritage hover:bg-surface-container-low focus-visible:ring-primary-heritage inline-flex h-10 w-10 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2';

/**
 * Stitch mock utility cluster: favoris, compte, langue, réservation.
 */
export async function HeritageHeaderActions(): Promise<ReactElement> {
  const t = await getTranslations('header');

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Link
        href="/compte/favoris"
        aria-label={t('heritage.favoritesAria')}
        className={iconButtonClass}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      <Link href="/compte" aria-label={t('account.myAccount')} className={iconButtonClass}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </Link>

      <Suspense fallback={null}>
        <LocaleSwitcher />
      </Suspense>

      <Link
        href="/le-concierge/reserver"
        aria-label={t('heritage.bookAria')}
        className={iconButtonClass}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 8.5h20M6 12.5h12M4 16.5h16" strokeLinecap="round" />
          <rect x="2" y="4" width="20" height="16" rx="2" />
        </svg>
      </Link>
    </div>
  );
}
