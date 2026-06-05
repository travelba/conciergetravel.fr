/**
 * Currency normalisation for cross-supplier rate comparison.
 *
 * Comparing rates across suppliers requires a single currency. Connectors
 * SHOULD request EUR from the supplier when possible (Travelport is EUR-only;
 * RateHawk accepts a `currency` param), so in practice conversion is identity.
 * When a supplier can only return a foreign currency, `toEurMinor` applies a
 * conservative static fallback rate — flagged so callers can surface an
 * approximation badge rather than a precise total.
 */
import type { Currency } from './types';

/** Static, deliberately conservative fallback rates (foreign -> EUR). Used
 *  ONLY when a supplier cannot return EUR directly. Refresh via a real FX
 *  feed before relying on non-EUR suppliers in production. */
const FALLBACK_TO_EUR: Readonly<Record<Currency, number>> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.03,
};

export interface EurAmount {
  readonly amountMinor: number;
  /** True when a non-identity FX fallback was applied (display as approx.). */
  readonly approximate: boolean;
}

/** Convert a minor-unit amount in `currency` to EUR minor units. */
export function toEurMinor(amountMinor: number, currency: Currency): EurAmount {
  if (currency === 'EUR') return { amountMinor: Math.round(amountMinor), approximate: false };
  const rate = FALLBACK_TO_EUR[currency];
  return { amountMinor: Math.round(amountMinor * rate), approximate: true };
}

/** Map a free-form supplier currency code to our closed `Currency` union. */
export function parseCurrency(code: string | null | undefined): Currency | null {
  if (typeof code !== 'string') return null;
  const up = code.trim().toUpperCase();
  if (up === 'EUR' || up === 'USD' || up === 'GBP' || up === 'CHF') return up;
  return null;
}
