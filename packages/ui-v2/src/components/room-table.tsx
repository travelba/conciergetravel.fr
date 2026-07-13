import * as React from 'react';
import { Users } from 'lucide-react';

import { cn } from '../lib/cn';

export type RoomTableRow = {
  id: string;
  name: string;
  maxOccupants: number;
  sizeSqm?: number;
  bedDescription?: string;
  conditionsLabel?: string;
  roomHref?: string;
  priceSlot: React.ReactNode;
};

export type RoomTableProps = {
  rows: RoomTableRow[];
  emptyFallback?: React.ReactNode;
  className?: string;
};

function OccupantIcons({ count }: { count: number }) {
  const visible = Math.min(count, 4);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} occupants maximum`}>
      {Array.from({ length: visible }, (_, index) => (
        <Users key={index} className="size-3.5 text-[var(--color-muted)]" aria-hidden />
      ))}
      {count > 4 ? <span className="text-xs text-[var(--color-muted)]">+{count - 4}</span> : null}
    </span>
  );
}

export function RoomTable({ rows, emptyFallback, className }: RoomTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-sm border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-8 text-center text-sm text-[var(--color-muted)]',
          className,
        )}
      >
        {emptyFallback ?? 'Les types de chambres seront disponibles prochainement.'}
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-x-auto rounded-sm border border-[var(--color-border)]', className)}
    >
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Types de chambres disponibles</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            <th scope="col" className="px-4 py-3">
              Type de chambre
            </th>
            <th scope="col" className="px-4 py-3">
              Occupants
            </th>
            <th scope="col" className="px-4 py-3">
              Surface
            </th>
            <th scope="col" className="px-4 py-3">
              Lits
            </th>
            <th scope="col" className="px-4 py-3">
              Conditions
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Tarif
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-[var(--color-surface-container-low)]/60 border-b border-[var(--color-border)] last:border-b-0"
            >
              <td className="px-4 py-4 align-top">
                {row.roomHref !== undefined ? (
                  <a
                    href={row.roomHref}
                    className="font-medium text-[var(--color-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  >
                    {row.name}
                  </a>
                ) : (
                  <span className="font-medium text-[var(--color-fg)]">{row.name}</span>
                )}
              </td>
              <td className="px-4 py-4 align-top">
                <OccupantIcons count={row.maxOccupants} />
              </td>
              <td className="px-4 py-4 align-top text-[var(--color-muted)]">
                {row.sizeSqm !== undefined ? `${row.sizeSqm} m²` : '—'}
              </td>
              <td className="px-4 py-4 align-top text-[var(--color-muted)]">
                {row.bedDescription ?? '—'}
              </td>
              <td className="px-4 py-4 align-top text-[var(--color-muted)]">
                {row.conditionsLabel ?? '—'}
              </td>
              <td className="px-4 py-4 text-right align-top">{row.priceSlot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
