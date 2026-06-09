'use client';

import { useTranslations } from 'next-intl';
import { type ReactElement } from 'react';

export interface OccupancySelectorProps {
  readonly rooms: number;
  readonly adults: number;
  /** Named `childrenCount` (not `children`) — `children` is React-reserved. */
  readonly childrenCount: number;
  readonly onRoomsChange: (value: number) => void;
  readonly onAdultsChange: (value: number) => void;
  readonly onChildrenChange: (value: number) => void;
  /** "Valider ma chambre" — closes the panel (values are already live). */
  readonly onValidate: () => void;
}

interface StepperProps {
  readonly id: string;
  readonly label: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly value: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
}

const STEP_BTN =
  'flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(43,39,34,0.2)] text-lg leading-none text-[color:var(--texte)] transition-colors hover:border-[color:var(--or)] disabled:cursor-not-allowed disabled:opacity-40';

function Stepper({
  id,
  label,
  decreaseLabel,
  increaseLabel,
  value,
  min,
  onChange,
}: StepperProps): ReactElement {
  const canDecrement = value > min;
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <span id={`${id}-label`} className="text-sm text-[color:var(--texte)]">
        {label}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          aria-label={decreaseLabel}
          disabled={!canDecrement}
          onClick={() => {
            if (canDecrement) onChange(value - 1);
          }}
          className={STEP_BTN}
        >
          −
        </button>
        <output
          id={id}
          aria-labelledby={`${id}-label`}
          aria-live="polite"
          className="w-6 text-center text-sm tabular-nums"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label={increaseLabel}
          onClick={() => onChange(value + 1)}
          className={STEP_BTN}
        >
          +
        </button>
      </span>
    </div>
  );
}

/**
 * Occupancy stepper panel. Three counters with +/- controls; the minus
 * button disables itself at each lower bound (rooms ≥ 1, adults ≥ 1,
 * children ≥ 0). Values apply live; "Valider ma chambre" just closes.
 */
export function OccupancySelector({
  rooms,
  adults,
  childrenCount,
  onRoomsChange,
  onAdultsChange,
  onChildrenChange,
  onValidate,
}: OccupancySelectorProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  return (
    <div role="group" aria-label={t('occupantsLabel')} className="flex flex-col">
      <Stepper
        id="occ-rooms"
        label={t('roomsLabel')}
        decreaseLabel={t('decrease', { label: t('roomsLabel') })}
        increaseLabel={t('increase', { label: t('roomsLabel') })}
        value={rooms}
        min={1}
        onChange={onRoomsChange}
      />
      <Stepper
        id="occ-adults"
        label={t('adultsLabel')}
        decreaseLabel={t('decrease', { label: t('adultsLabel') })}
        increaseLabel={t('increase', { label: t('adultsLabel') })}
        value={adults}
        min={1}
        onChange={onAdultsChange}
      />
      <Stepper
        id="occ-children"
        label={t('childrenLabel')}
        decreaseLabel={t('decrease', { label: t('childrenLabel') })}
        increaseLabel={t('increase', { label: t('childrenLabel') })}
        value={childrenCount}
        min={0}
        onChange={onChildrenChange}
      />
      <button
        type="button"
        onClick={onValidate}
        className="mt-3 self-end rounded-md bg-[color:var(--noir)] px-4 py-2 text-sm text-[#f6f1e7] hover:bg-[color:var(--anthracite)]"
      >
        {t('validateRoom')}
      </button>
    </div>
  );
}
