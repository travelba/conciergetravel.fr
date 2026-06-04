import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { SupportedLocale } from '@/i18n/supported-locale';

/**
 * Étapes du tunnel réservable (pilote Travelport). Le paiement n'existe pas
 * encore sur ce chemin (preprod sans capture), la dernière étape est donc la
 * confirmation et non un module de paiement.
 */
export type BookingStep = 'rooms' | 'guest' | 'recap' | 'confirmation';

const ORDER: readonly BookingStep[] = ['rooms', 'guest', 'recap', 'confirmation'];

interface BookingProgressProps {
  readonly locale: SupportedLocale;
  readonly current: BookingStep;
}

/**
 * Stepper de progression « niveau OTA » rendu en tête de chaque étape du
 * tunnel (chambres → voyageur → récap → confirmation). Server Component pur :
 * aucun état client, juste un repère visuel + sémantique (`aria-current`).
 */
export async function BookingProgress({
  locale,
  current,
}: BookingProgressProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'bookingProgress' });
  const currentIndex = ORDER.indexOf(current);
  const total = ORDER.length;

  return (
    <nav aria-label={t('aria')} className="mb-8">
      <ol className="flex items-center gap-2 sm:gap-3">
        {ORDER.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const label = t(step);
          const statusLabel = isDone ? t('completed') : isCurrent ? t('current') : '';
          return (
            <li key={step} className="flex flex-1 items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                    isDone
                      ? 'bg-gold-600 text-white'
                      : isCurrent
                        ? 'bg-fg text-bg ring-gold-300 ring-2 ring-offset-2'
                        : 'border-border text-muted border',
                  ].join(' ')}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span
                  {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
                  className={[
                    'truncate text-xs sm:text-sm',
                    isCurrent ? 'text-fg font-medium' : isDone ? 'text-fg' : 'text-muted',
                  ].join(' ')}
                >
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{index + 1}</span>
                  {statusLabel !== '' ? <span className="sr-only"> — {statusLabel}</span> : null}
                </span>
              </div>
              {index < total - 1 ? (
                <span
                  aria-hidden
                  className={[
                    'h-px flex-1',
                    index < currentIndex ? 'bg-gold-400' : 'bg-border',
                  ].join(' ')}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
