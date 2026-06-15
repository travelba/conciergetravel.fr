/**
 * Canonical gallery source URL keys — pixel-level dedup for kit gates (Rule 10).
 *
 * Query params (`?w=`, `?mchPress=`, `?width=`) must not mask duplicate assets.
 * CDC §2.2bis · skill `hotel-kit-rollout` Rule 10.
 */

/** Strip query/hash and normalize host+path for dedup comparisons. */
export function normalizeGallerySourceUrlForDedup(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';

  try {
    const withScheme = /^https?:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase().replace(/^www\./u, '');
    const path = decodeURIComponent(url.pathname).replace(/\/+$/u, '') || '/';
    return `${host}${path}`.toLowerCase();
  } catch {
    const noQuery = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
    return noQuery.toLowerCase();
  }
}

export function countDuplicateCanonicalGallerySourceUrls(urls: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const raw of urls) {
    const key = normalizeGallerySourceUrlForDedup(raw);
    if (key.length === 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dupSlots = 0;
  for (const n of counts.values()) {
    if (n > 1) dupSlots += n - 1;
  }
  return dupSlots;
}

export function assertUniqueCanonicalGallerySourceUrls(
  slug: string,
  urls: readonly string[],
): void {
  const seen = new Map<string, number>();
  for (let i = 0; i < urls.length; i++) {
    const raw = urls[i]?.trim() ?? '';
    const key = normalizeGallerySourceUrlForDedup(raw);
    if (key.length < 8) {
      throw new Error(`[${slug}-gallery] slot ${i + 1} missing source url`);
    }
    const prev = seen.get(key);
    if (prev !== undefined) {
      throw new Error(
        `[${slug}-gallery] canonical duplicate at press-${prev + 1} and press-${i + 1}: ${key}`,
      );
    }
    seen.set(key, i);
  }
}

function readSourceUrlFromGalleryRow(item: unknown): string | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
  const rec = item as Record<string, unknown>;
  for (const key of ['url', 'source_url', 'sourceUrl'] as const) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim().length >= 12) return value.trim();
  }
  return null;
}

/** Count gallery rows that share the same canonical source path (ignores query variants). */
export function countDuplicateCanonicalGallerySourceUrlsFromRows(gallery: unknown): number {
  if (!Array.isArray(gallery)) return 0;
  const urls: string[] = [];
  for (const item of gallery) {
    const url = readSourceUrlFromGalleryRow(item);
    if (url !== null) urls.push(url);
  }
  return countDuplicateCanonicalGallerySourceUrls(urls);
}
