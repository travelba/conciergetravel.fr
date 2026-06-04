'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';

interface OfferExpiryNoticeProps {
  /** ISO timestamp at which the locked offer / draft expires. */
  readonly expiresAt: string;
  /** Hotel slug for the "start a new search" CTA (falls back to home). */
  readonly slug?: string;
}

/**
 * Live countdown for a locked Travelport offer on the recap. Shows the time
 * remaining and, once expired, a clear message + CTA to relaunch a search on
 * the hotel fiche (never the legacy `/recherche`). The server still enforces
 * expiry — this is purely informational so the user isn't surprised by a
 * generic upstream error after the rate silently lapsed.
 */
export function OfferExpiryNotice({ expiresAt, slug }: OfferExpiryNoticeProps): ReactElement {
  const t = useTranslations('reservationRecap');
  const [now, setNow] = useState<number>(() => Date.now());
  // Avoid a server/client clock hydration mismatch: keep the structure stable
  // (non-expired branch) until mounted, then let the interval drive expiry.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const expMs = Date.parse(expiresAt);
  const remaining = Number.isFinite(expMs) ? expMs - now : -1;
  const expired = mounted && remaining <= 0;
  const minutes = Math.max(0, Math.ceil(remaining / 60_000));

  if (expired) {
    return (
      <p
        role="alert"
        className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        {t('expiry.expired')}{' '}
        {slug !== undefined ? (
          <Link
            href={{ pathname: '/hotel/[slug]', params: { slug } }}
            className="font-medium underline underline-offset-2"
          >
            {t('researchCta')}
          </Link>
        ) : (
          <Link href="/" className="font-medium underline underline-offset-2">
            {t('researchCta')}
          </Link>
        )}
      </p>
    );
  }

  return (
    <p className="text-muted mt-3 text-xs" suppressHydrationWarning>
      {minutes <= 1 ? t('expiry.expiringSoon') : t('expiry.expiresIn', { minutes })}
    </p>
  );
}
