'use client';

import * as React from 'react';
import { CalendarDays, Users } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from './button';

export type StickyBookingBoxProps = {
  datesLabel: string;
  guestsLabel: string;
  priceSlot: React.ReactNode;
  onDatesClick?: () => void;
  onGuestsClick?: () => void;
  submitLabel?: string;
  onSubmit?: () => void;
  memberBenefitsSlot?: React.ReactNode;
  className?: string;
};

export function StickyBookingBox({
  datesLabel,
  guestsLabel,
  priceSlot,
  onDatesClick,
  onGuestsClick,
  submitLabel = 'Demander un devis',
  onSubmit,
  memberBenefitsSlot,
  className,
}: StickyBookingBoxProps) {
  return (
    <aside
      className={cn(
        'flex w-full max-w-[var(--sticky-booking-width)] flex-col gap-4 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[var(--shadow-card)]',
        className,
      )}
      aria-label="Réservation"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onDatesClick}
          className="flex items-center gap-3 rounded-sm border border-[var(--color-border)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-container-low)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <CalendarDays className="size-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
          <span>
            <span className="block text-xs font-semibold text-[var(--color-fg)]">Dates</span>
            <span className="block text-sm text-[var(--color-muted)]">{datesLabel}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={onGuestsClick}
          className="flex items-center gap-3 rounded-sm border border-[var(--color-border)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-container-low)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <Users className="size-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
          <span>
            <span className="block text-xs font-semibold text-[var(--color-fg)]">Voyageurs</span>
            <span className="block text-sm text-[var(--color-muted)]">{guestsLabel}</span>
          </span>
        </button>
      </div>

      {memberBenefitsSlot}

      <div className="border-t border-[var(--color-border)] pt-4">{priceSlot}</div>

      {onSubmit !== undefined ? (
        <Button type="button" variant="primary" size="lg" className="w-full" onClick={onSubmit}>
          {submitLabel}
        </Button>
      ) : null}
    </aside>
  );
}
