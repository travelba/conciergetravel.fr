/** Cache + lock keys follow redis-caching / travelport-stays skills. */

export const travelportAuthTokenKey = (): string => 'travelport:auth:token';
export const travelportAuthLockKey = (): string => 'travelport:auth:lock';

export function travelportSearchByPropertyCacheKey(input: {
  readonly propertyKeys: readonly { readonly chainCode: string; readonly propertyCode: string }[];
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly childAges: readonly number[] | undefined;
  readonly currency: string;
}): string {
  const ages = (input.childAges ?? [])
    .slice()
    .sort((a, b) => a - b)
    .join('-');
  const keys = input.propertyKeys
    .map((k) => `${k.chainCode}/${k.propertyCode}`)
    .sort()
    .join('|');
  return `travelport:search:${keys}:${input.checkInDate}:${input.checkOutDate}:${input.adults}:${ages}:${input.currency}`;
}

export function travelportSearchByCoordsCacheKey(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly radius: number;
  readonly unit: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly adults: number;
  readonly currency: string;
}): string {
  const lat = input.latitude.toFixed(5);
  const lng = input.longitude.toFixed(5);
  return `travelport:search-coords:${lat},${lng}:${input.radius}${input.unit}:${input.checkInDate}:${input.checkOutDate}:${input.adults}:${input.currency}`;
}

export function travelportReservationCacheKey(locator: string): string {
  return `travelport:reservation:${locator}`;
}
