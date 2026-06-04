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

  return (
    <nav aria-label={t('aria')} className="mb-10">
      <ol className="flex items-center">
        {ORDER.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const label = t(step);
          const statusLabel = isDone ? t('completed') : isCurrent ? t('current') : '';
          const isLast = index === ORDER.length - 1;
          return (
            <li
              key={step}
              className={isLast ? 'flex shrink-0 items-center' : 'flex flex-1 items-center'}
            >
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span
                  aria-hidden
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    isDone
                      ? 'bg-gold-600 shadow-xs text-white'
                      : isCurrent
                        ? 'bg-charcoal ring-gold-400 text-white ring-2 ring-offset-2'
                        : 'border-border text-muted border bg-transparent',
                  ].join(' ')}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span
                  {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
                  className={[
                    'text-center text-[11px] leading-tight tracking-wide sm:text-xs',
                    isCurrent ? 'text-fg font-semibold' : isDone ? 'text-fg/70' : 'text-muted/70',
                  ].join(' ')}
                >
                  {label}
                  {statusLabel !== '' ? <span className="sr-only"> — {statusLabel}</span> : null}
                </span>
              </div>
              {!isLast ? (
                <span
                  aria-hidden
                  className={[
                    'mx-2 -mt-6 h-0.5 flex-1 rounded-full sm:mx-3',
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
