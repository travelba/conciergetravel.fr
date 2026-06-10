/** Minimum trimmed length for a Google review to count as a real traveler comment. */
export const GOOGLE_REVIEW_MIN_COMMENT_CHARS = 10;

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
