/**
 * Display helpers for the small distance/walk-time pills used by the
 * POI cards on the hotel detail page.
 *
 * Rationale:
 *   - **< 100 m** → "sur place" (the threshold matches OSM `5 min walk`
 *     rounding; below 100 m the metric "85 m" reads as noise).
 *   - **< 1000 m** → integer metres ("250 m", "850 m").
 *   - **≥ 1000 m** → kilometres with one decimal ("1,2 km" FR,
 *     "1.2 km" EN). We never display more than one decimal because
 *     POI coordinates are themselves accurate to ~ 50 m at best —
 *     showing "1,28 km" would imply false precision.
 *
 * Walking time is rounded to the nearest minute and falls back to a
 * "5 km/h" derivation (the OSM canonical pedestrian speed) when the
 * sync script did not pre-compute `walk_minutes`. Sub-1-minute walks
 * are reported as `1 min` rather than `0 min` (the rendering target
 * is "human guidance", not "stop-watch precision").
 */

export function formatDistanceMeters(meters: number, locale: 'fr' | 'en'): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 100) return locale === 'fr' ? 'sur place' : 'on site';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  const formatted = km.toFixed(1);
  // FR uses comma as decimal separator — the canonical sitewide rule
  // (mirrored by `Intl.NumberFormat('fr-FR')` but lighter).
  return locale === 'fr' ? `${formatted.replace('.', ',')} km` : `${formatted} km`;
}

/**
 * Returns walking minutes from `walkMinutes` when provided, otherwise
 * derives them from distance using 5 km/h (~ 83 m/min) — the OSM
 * canonical pedestrian speed.
 *
 * Clamps to a minimum of 1 minute so a "5 m walk" doesn't print as
 * "0 min à pied", which reads as broken on a hotel detail page.
 */
export function deriveWalkMinutes(
  walkMinutes: number | null,
  distanceMeters: number,
): number | null {
  if (walkMinutes !== null && Number.isFinite(walkMinutes) && walkMinutes >= 0) {
    return Math.max(1, Math.round(walkMinutes));
  }
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  return Math.max(1, Math.round(distanceMeters / 83));
}
