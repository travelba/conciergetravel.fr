'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

/**
 * Shared route-segment error boundary UI.
 *
 * Used by the heavy editorial templates (`destination/[citySlug]`,
 * `classement/[slug]`) so a render-time throw inside one of those
 * segments degrades to a sober, localised "try again" panel instead of
 * bubbling up to the locale-level boundary and wiping the surrounding
 * chrome. Mirrors `app/[locale]/error.tsx` (Sentry capture + reset).
 */
export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    Sentry.captureException(error);
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }, [error]);

  return (
    <main className="container mx-auto flex min-h-[50vh] max-w-prose flex-col items-start justify-center gap-4 px-4 py-16">
      <p className="text-muted text-xs uppercase tracking-[0.18em]">500</p>
      <h1 className="text-fg font-serif text-4xl">{t('errorTitle')}</h1>
      <p className="text-muted">{t('errorDescription')}</p>
      <button
        type="button"
        onClick={reset}
        className="bg-fg text-bg hover:bg-fg/90 mt-4 inline-flex h-11 min-h-[44px] items-center gap-2 rounded-md px-5 text-sm font-medium"
      >
        {t('tryAgain')}
      </button>
    </main>
  );
}
