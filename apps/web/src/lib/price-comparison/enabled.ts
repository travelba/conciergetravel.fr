import 'server-only';

/**
 * Kill-switch for the Makcorps/Apify price comparator (skill:
 * competitive-pricing-comparison). Set `MCH_DISABLE_PRICE_COMPARISON=1`
 * to skip vendor calls and hide comparator UI — useful when diagnosing
 * hotel fiche latency (Travelport pilot embeds compare in the booking rail).
 */
export function isPriceComparisonDisabled(): boolean {
  const raw = process.env['MCH_DISABLE_PRICE_COMPARISON'];
  if (raw === '0' || raw === 'false') return false;
  // Désactivé par défaut (PO test latence fiche hôtel, 2026-06-10) — passer à 0 pour réactiver.
  if (raw === undefined) return true;
  return raw === '1' || raw === 'true';
}
