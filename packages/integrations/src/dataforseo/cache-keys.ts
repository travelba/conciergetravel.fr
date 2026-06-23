/**
 * Redis cache-key builders for DataForSEO grounding. Format follows the
 * repo convention `mch:<vendor>:<scope>:<key>` (architecture-layers.mdc).
 *
 * Keyword/SERP data is stable week-over-week, so the grounding layer caches
 * aggressively (DataForSEO bills per request). The key is normalised
 * (lowercased, locale-scoped) so the same seed served to many entities in a
 * cluster (e.g. every Gordes place) reuses one cached pull.
 */

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

export function dfsCacheKey(
  scope: 'related' | 'suggestions' | 'volume' | 'intent' | 'serp' | 'ai',
  seed: string,
  languageCode: string,
  locationName: string,
): string {
  return `mch:dataforseo:${scope}:${languageCode}:${norm(locationName)}:${norm(seed)}`;
}

/** Default TTL for grounding caches (7 days) — keyword demand drifts slowly. */
export const DFS_CACHE_TTL_SEC = 7 * 24 * 60 * 60;
