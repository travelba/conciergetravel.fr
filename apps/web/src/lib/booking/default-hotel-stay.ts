import type { HotelStayOccupancy } from './hotel-stay';

/**
 * Default stay window for hotel booking widgets (fiche + room sub-page).
 * Mirrors the editorial convention: check-in J+30, check-out J+33, 1 room, 2 adults.
 */
export function defaultHotelStay(): {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly rooms: number;
  readonly adults: number;
  readonly children: number;
  readonly childAges: readonly number[];
} {
  const now = new Date();
  const ci = new Date(now.getTime() + 30 * 86_400_000);
  const co = new Date(now.getTime() + 33 * 86_400_000);
  const fmt = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return {
    checkIn: fmt(ci),
    checkOut: fmt(co),
    rooms: 1,
    adults: 2,
    children: 0,
    childAges: [],
  };
}

export function defaultHotelStayOccupancy(): HotelStayOccupancy {
  const stay = defaultHotelStay();
  return {
    rooms: stay.rooms,
    adults: stay.adults,
    childAges: stay.childAges,
  };
}

/** ISO date string for today (UTC) — used as `min` on date inputs. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
