'use client';

import * as React from 'react';
import { CalendarDays, MapPin, Search, Users } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from './button';

export type SearchBarSegment = 'destination' | 'dates' | 'guests';

export type SearchBarProps = {
  destinationLabel: string;
  datesLabel: string;
  guestsLabel: string;
  searchLabel?: string;
  onSegmentClick?: (segment: SearchBarSegment) => void;
  onSearch?: () => void;
  className?: string;
};

type SegmentButtonProps = {
  segment: SearchBarSegment;
  icon: React.ReactNode;
  label: string;
  value: string;
  onSegmentClick?: (segment: SearchBarSegment) => void;
  className?: string;
};

function SegmentButton({
  segment,
  icon,
  label,
  value,
  onSegmentClick,
  className,
}: SegmentButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSegmentClick?.(segment)}
      className={cn(
        'flex min-h-[var(--search-bar-height)] flex-1 flex-col justify-center gap-0.5 border-r border-[var(--color-border)] px-4 py-2 text-left transition-colors hover:bg-[var(--color-surface-container-low)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-ring)]',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-fg)]">
        {icon}
        {label}
      </span>
      <span className="truncate text-sm text-[var(--color-muted)]">{value}</span>
    </button>
  );
}

export function SearchBar({
  destinationLabel,
  datesLabel,
  guestsLabel,
  searchLabel = 'Rechercher',
  onSegmentClick,
  onSearch,
  className,
}: SearchBarProps) {
  const segmentProps = onSegmentClick !== undefined ? { onSegmentClick } : {};

  return (
    <div
      className={cn(
        'flex w-full overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-card)]',
        className,
      )}
      role="search"
    >
      <SegmentButton
        segment="destination"
        icon={<MapPin className="size-3.5 shrink-0" aria-hidden />}
        label="Destination"
        value={destinationLabel}
        {...segmentProps}
        className="flex-[1.4]"
      />
      <SegmentButton
        segment="dates"
        icon={<CalendarDays className="size-3.5 shrink-0" aria-hidden />}
        label="Dates"
        value={datesLabel}
        {...segmentProps}
      />
      <SegmentButton
        segment="guests"
        icon={<Users className="size-3.5 shrink-0" aria-hidden />}
        label="Voyageurs"
        value={guestsLabel}
        {...segmentProps}
        className="border-r-0 sm:border-r"
      />
      <div className="flex shrink-0 items-stretch p-1">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSearch}
          className="h-full min-w-[120px] rounded-sm px-6"
        >
          <Search className="size-4" aria-hidden />
          {searchLabel}
        </Button>
      </div>
    </div>
  );
}
