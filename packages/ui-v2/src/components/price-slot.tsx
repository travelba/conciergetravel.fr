'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';

import {
  buildPriceSlotView,
  type BuildConciergePriceSlotInput,
  type BuildLivePriceSlotInput,
  type PriceComparatorRow,
} from '../price-slot.logic';
import { cn } from '../lib/cn';
import { Badge } from './badge';
import { Button } from './button';

export type { BuildConciergePriceSlotInput, BuildLivePriceSlotInput, PriceComparatorRow };

export type PriceSlotProps = (BuildConciergePriceSlotInput | BuildLivePriceSlotInput) & {
  quoteCtaLabel?: string;
  onQuoteClick?: () => void;
  onUnlockMemberClick?: () => void;
  memberSlot?: React.ReactNode;
  comparatorSlot?: React.ReactNode;
  comparatorRows?: PriceComparatorRow[];
  className?: string;
};

export function PriceSlot({
  quoteCtaLabel = 'Demander un devis',
  onQuoteClick,
  onUnlockMemberClick,
  memberSlot,
  comparatorSlot,
  comparatorRows,
  className,
  ...input
}: PriceSlotProps) {
  const result = buildPriceSlotView(input);

  if (!result.ok) {
    return (
      <div
        role="alert"
        className={cn(
          'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 rounded-sm border px-3 py-2 text-sm text-[var(--color-danger)]',
          className,
        )}
      >
        {result.error.message}
      </div>
    );
  }

  const view = result.value;

  if (view.mode === 'concierge') {
    return (
      <div className={cn('flex flex-col items-end gap-2 text-right', className)}>
        <p className="text-sm font-semibold text-[var(--color-fg)]">{view.headline}</p>
        <Badge variant="member">{view.memberTeaser}</Badge>
        {memberSlot}
        {onQuoteClick !== undefined ? (
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onQuoteClick}
            className="w-full sm:w-auto"
          >
            {quoteCtaLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-end gap-2 text-right', className)}>
      <div>
        <p className="text-xs text-[var(--color-muted)]">Prix public TTC</p>
        <p className="text-xl font-semibold text-[var(--color-fg)]">{view.publicPriceFormatted}</p>
      </div>

      {view.memberPriceFormatted !== null ? (
        <div className="w-full rounded-sm border border-[var(--color-gold-200)] bg-[var(--color-gold-50)] px-3 py-2">
          {view.memberLocked ? (
            <button
              type="button"
              onClick={onUnlockMemberClick}
              className="flex w-full items-center justify-end gap-1.5 text-sm font-medium text-[var(--color-accent-gold)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
            >
              <Lock className="size-3.5" aria-hidden />
              Connectez-vous pour débloquer
            </button>
          ) : (
            <>
              <p className="text-xs text-[var(--color-muted)]">Prix membre TTC</p>
              <p className="text-lg font-semibold text-[var(--color-accent-gold)]">
                {view.memberPriceFormatted}
              </p>
            </>
          )}
        </div>
      ) : null}

      {memberSlot}

      {view.comparatorEnabled
        ? (comparatorSlot ?? (
            <PriceComparatorTable rows={comparatorRows ?? []} className="w-full text-left" />
          ))
        : null}
    </div>
  );
}

type PriceComparatorTableProps = {
  rows: PriceComparatorRow[];
  className?: string;
};

function PriceComparatorTable({ rows, className }: PriceComparatorTableProps) {
  if (rows.length === 0) {
    return (
      <p className={cn('text-xs text-[var(--color-muted)]', className)}>
        Comparateur disponible en Phase 9
      </p>
    );
  }

  return (
    <table className={cn('w-full text-xs', className)}>
      <caption className="sr-only">Comparateur de prix</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.source} className="border-t border-[var(--color-border)] first:border-t-0">
            <th scope="row" className="py-1.5 pr-2 font-medium text-[var(--color-fg)]">
              {row.label}
            </th>
            <td className="py-1.5 text-right font-semibold text-[var(--color-fg)]">
              {row.formattedPrice}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
