import 'server-only';

/**
 * Kill-switch for the Makcorps/Apify price comparator (skill:
 * competitive-pricing-comparison). Set `MCH_DISABLE_PRICE_COMPARISON=1`
 * to skip vendor calls and hide comparator UI.
 */
export function isPriceComparisonDisabled(): boolean {
  const raw = process.env['MCH_DISABLE_PRICE_COMPARISON'];
  if (raw === '1' || raw === 'true') return true;
  return false;
}
