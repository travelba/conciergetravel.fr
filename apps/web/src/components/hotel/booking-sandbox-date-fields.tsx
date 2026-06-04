'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

interface DateFieldsLabels {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: string;
}

interface BookingSandboxDateFieldsProps {
  readonly labels: DateFieldsLabels;
  readonly defaults: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
  };
  /** Today (ISO) — lower bound for check-in. */
  readonly today: string;
}

const FIELD_CLASS =
  'border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2';

function addDayIso(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Date + occupancy fields for the Travelport sandbox forms (rail + `/chambres`
 * date selector). Enforces `check-out ≥ check-in + 1` client-side: changing the
 * check-in date raises the check-out `min` and bumps it forward when needed, so
 * the user can never submit an invalid range (the server still re-validates).
 *
 * The `children` field is intentionally omitted: Travelport search requires
 * child *ages*, which the funnel does not collect — surfacing a children count
 * would mislead on occupancy and price.
 */
export function BookingSandboxDateFields({
  labels,
  defaults,
  today,
}: BookingSandboxDateFieldsProps): ReactElement {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);

  const minCheckOut = addDayIso(checkIn >= today ? checkIn : today);

  const onCheckInChange = (next: string): void => {
    setCheckIn(next);
    if (checkOut <= next) setCheckOut(addDayIso(next));
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg font-medium">{labels.checkIn}</span>
        <input
          type="date"
          name="checkIn"
          value={checkIn}
          min={today}
          required
          onChange={(e) => onCheckInChange(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg font-medium">{labels.checkOut}</span>
        <input
          type="date"
          name="checkOut"
          value={checkOut}
          min={minCheckOut}
          required
          onChange={(e) => setCheckOut(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-fg font-medium">{labels.adults}</span>
        <input
          type="number"
          name="adults"
          min={1}
          max={9}
          defaultValue={defaults.adults}
          required
          className={FIELD_CLASS}
        />
      </label>
    </div>
  );
}
