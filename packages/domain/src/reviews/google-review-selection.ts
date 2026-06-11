/** Minimum trimmed length for a Google review to count as a real traveler comment. */
export const GOOGLE_REVIEW_MIN_COMMENT_CHARS = 10;

/** Kit #acces PO — only show cached GMB quotes dated within this window. */
export const GOOGLE_REVIEW_DISPLAY_MAX_AGE_DAYS = 90;

export interface GoogleReviewCandidate {
  readonly author: string;
  readonly rating: number;
  readonly text: string;
  readonly publishTime: string | null;
}

/** True when the review carries a non-trivial written comment (not rating-only / emoji-only). */
export function hasSubstantiveGoogleReviewComment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < GOOGLE_REVIEW_MIN_COMMENT_CHARS) return false;
  const withoutEmoji = trimmed.replace(/\p{Extended_Pictographic}/gu, '').trim();
  return withoutEmoji.length >= GOOGLE_REVIEW_MIN_COMMENT_CHARS;
}

function publishTimeSortKey(publishTime: string | null): string | null {
  if (publishTime === null) return null;
  const trimmed = publishTime.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Newest first; undated reviews sink to the bottom (stable among themselves). */
export function compareGoogleReviewsByRecency(
  a: Pick<GoogleReviewCandidate, 'publishTime'>,
  b: Pick<GoogleReviewCandidate, 'publishTime'>,
): number {
  const keyA = publishTimeSortKey(a.publishTime);
  const keyB = publishTimeSortKey(b.publishTime);
  if (keyA !== null && keyB !== null) return keyB.localeCompare(keyA);
  if (keyA !== null) return -1;
  if (keyB !== null) return 1;
  return 0;
}

/**
 * Picks traveler reviews for #acces display and DB cache:
 * substantive comment, any rating 1–5, sorted by `publish_time` descending.
 */
function googleReviewAgeDays(publishTime: string | null, nowMs: number): number | null {
  if (publishTime === null) return null;
  const trimmed = publishTime.trim();
  if (trimmed.length === 0) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return (nowMs - ms) / (1000 * 60 * 60 * 24);
}

/** True when `publishTime` parses and falls within the kit #acces recency window. */
export function isGoogleReviewWithinDisplayWindow(
  publishTime: string | null,
  maxAgeDays: number = GOOGLE_REVIEW_DISPLAY_MAX_AGE_DAYS,
  nowMs: number = Date.now(),
): boolean {
  const ageDays = googleReviewAgeDays(publishTime, nowMs);
  return ageDays !== null && ageDays <= maxAgeDays;
}

export function selectGoogleReviewsForDisplay<T extends GoogleReviewCandidate>(
  reviews: readonly T[],
  limit: number,
): readonly T[] {
  if (limit <= 0) return [];
  return [...reviews]
    .filter((review) => {
      if (review.author.trim().length === 0) return false;
      if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
        return false;
      }
      return hasSubstantiveGoogleReviewComment(review.text);
    })
    .sort(compareGoogleReviewsByRecency)
    .slice(0, limit);
}

/**
 * #acces display pool — substantive reviews dated within `maxAgeDays`, newest first.
 * Stale quotes are excluded so the UI never surfaces a « recent » label on old GMB rows.
 */
export function selectGoogleReviewsForAccesDisplay<T extends GoogleReviewCandidate>(
  reviews: readonly T[],
  limit: number,
  maxAgeDays: number = GOOGLE_REVIEW_DISPLAY_MAX_AGE_DAYS,
  nowMs: number = Date.now(),
): readonly T[] {
  if (limit <= 0) return [];
  return selectGoogleReviewsForDisplay(reviews, reviews.length)
    .filter((review) => isGoogleReviewWithinDisplayWindow(review.publishTime, maxAgeDays, nowMs))
    .slice(0, limit);
}

function reviewDedupeKey(review: GoogleReviewCandidate): string {
  return `${review.author.trim().toLowerCase()}|${review.publishTime ?? ''}|${review.text.trim().slice(0, 80)}`;
}

/**
 * Merge a fresh Places sync with the cached DB payload — keeps rows Google
 * dropped from its capped 5-review sample, caps at `maxStored`.
 */
export function mergeGoogleReviewCache<T extends GoogleReviewCandidate>(
  existing: readonly T[],
  incoming: readonly T[],
  options: {
    readonly maxStored: number;
  },
): readonly T[] {
  const maxStored = options.maxStored;
  if (maxStored <= 0) return [];

  const seen = new Set<string>();
  const merged: T[] = [];
  for (const review of [...incoming, ...existing]) {
    if (!hasSubstantiveGoogleReviewComment(review.text)) continue;
    if (review.author.trim().length === 0) continue;
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) continue;
    const key = reviewDedupeKey(review);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(review);
  }
  return [...merged].sort(compareGoogleReviewsByRecency).slice(0, maxStored);
}
