/** Default age assigned when the user adds a child without picking an age yet. */
export const DEFAULT_CHILD_AGE = 8;

export const MAX_ROOMS = 9;
export const MAX_ADULTS = 9;
export const MAX_CHILDREN = 9;
export const MIN_CHILD_AGE = 0;
export const MAX_CHILD_AGE = 17;

export interface HotelStayOccupancy {
  readonly rooms: number;
  readonly adults: number;
  readonly childAges: readonly number[];
}

export function childrenCountFromAges(childAges: readonly number[]): number {
  return childAges.length;
}

export function clampRooms(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > MAX_ROOMS) return MAX_ROOMS;
  return n;
}

export function clampAdults(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const n = Math.trunc(value);
  if (n < 1) return 1;
  if (n > MAX_ADULTS) return MAX_ADULTS;
  return n;
}

export function clampChildAge(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CHILD_AGE;
  const n = Math.trunc(value);
  if (n < MIN_CHILD_AGE) return MIN_CHILD_AGE;
  if (n > MAX_CHILD_AGE) return MAX_CHILD_AGE;
  return n;
}

/** Resize the ages array to match the target child count (pad with defaults). */
export function resizeChildAges(
  current: readonly number[],
  targetCount: number,
): readonly number[] {
  const clampedCount = Math.min(MAX_CHILDREN, Math.max(0, Math.trunc(targetCount)));
  const next = current.slice(0, clampedCount).map(clampChildAge);
  while (next.length < clampedCount) {
    next.push(DEFAULT_CHILD_AGE);
  }
  return next;
}
