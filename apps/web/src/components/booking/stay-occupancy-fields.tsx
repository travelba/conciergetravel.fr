'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactElement } from 'react';

import {
  clampAdults,
  clampRooms,
  type HotelStayOccupancy,
  resizeChildAges,
} from '@/lib/booking/hotel-stay';
import { parseStayUrlParams, serializeChildAges } from '@/lib/booking/stay-url-params';

import { ChildAgeFields } from './child-age-fields';

export interface StayOccupancyFieldsProps {
  readonly defaults: HotelStayOccupancy;
}

const STEP_BTN =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(43,39,34,0.2)] text-lg leading-none text-[color:var(--texte)] transition-colors hover:border-[color:var(--or)] disabled:cursor-not-allowed disabled:opacity-40';

interface StepperRowProps {
  readonly id: string;
  readonly label: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly value: number;
  readonly min: number;
  readonly onChange: (value: number) => void;
}

function StepperRow({
  id,
  label,
  decreaseLabel,
  increaseLabel,
  value,
  min,
  onChange,
}: StepperRowProps): ReactElement {
  const canDecrement = value > min;
  return (
    <div className="rf-field cursor-default hover:border-[color:var(--ligne)]">
      <span>{label}</span>
      <span className="rf-val flex items-center justify-between gap-3">
        <output id={id} aria-live="polite" className="tabular-nums">
          {value}
        </output>
        <span className="flex items-center gap-2">
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
          <button
            type="button"
            aria-label={increaseLabel}
            onClick={() => onChange(value + 1)}
            className={STEP_BTN}
          >
            +
          </button>
        </span>
      </span>
    </div>
  );
}

/**
 * Occupancy block for hotel fiche booking forms — mirrors the homepage
 * `OccupancySelector` (rooms / adults / children + child ages) while
 * emitting native form fields for no-JS POST/GET.
 */
export function StayOccupancyFields({ defaults }: StayOccupancyFieldsProps): ReactElement {
  const t = useTranslations('hotelSearchBar');
  const [rooms, setRooms] = useState(defaults.rooms);
  const [adults, setAdults] = useState(defaults.adults);
  const [childAges, setChildAges] = useState<number[]>([...defaults.childAges]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const parsed = parseStayUrlParams(new URLSearchParams(window.location.search));
      setRooms(parsed.occupancy.rooms);
      setAdults(parsed.occupancy.adults);
      setChildAges([...parsed.occupancy.childAges]);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('form[data-testid="booking-widget-form"]');
    if (form === null) return;
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }, [rooms, adults, childAges]);

  const childrenCount = childAges.length;
  const childAgesValue = serializeChildAges(childAges);

  return (
    <div role="group" aria-label={t('occupantsLabel')} className="contents">
      <input type="hidden" name="rooms" value={String(rooms)} />
      <input type="hidden" name="adults" value={String(adults)} />
      <input type="hidden" name="children" value={String(childrenCount)} />
      {childAgesValue.length > 0 ? (
        <input type="hidden" name="childAges" value={childAgesValue} />
      ) : null}

      <StepperRow
        id="stay-rooms"
        label={t('roomsLabel')}
        decreaseLabel={t('decrease', { label: t('roomsLabel') })}
        increaseLabel={t('increase', { label: t('roomsLabel') })}
        value={rooms}
        min={1}
        onChange={(value) => setRooms(clampRooms(value))}
      />
      <StepperRow
        id="stay-adults"
        label={t('adultsLabel')}
        decreaseLabel={t('decrease', { label: t('adultsLabel') })}
        increaseLabel={t('increase', { label: t('adultsLabel') })}
        value={adults}
        min={1}
        onChange={(value) => setAdults(clampAdults(value))}
      />
      <StepperRow
        id="stay-children"
        label={t('childrenLabel')}
        decreaseLabel={t('decrease', { label: t('childrenLabel') })}
        increaseLabel={t('increase', { label: t('childrenLabel') })}
        value={childrenCount}
        min={0}
        onChange={(value) => setChildAges([...resizeChildAges(childAges, value)])}
      />

      <ChildAgeFields
        variant="rail"
        childAges={childAges}
        onChange={(ages) => setChildAges([...ages])}
      />
    </div>
  );
}
