/** Booking-style verbal labels for scores displayed on a /10 scale (CDC C1a). */
export type RatingLabel = 'Exceptionnel' | 'Superbe' | 'Très bien' | 'Bien' | 'Agréable';

const RATING_THRESHOLDS: ReadonlyArray<{ min: number; label: RatingLabel }> = [
  { min: 9, label: 'Exceptionnel' },
  { min: 8.6, label: 'Superbe' },
  { min: 8, label: 'Très bien' },
  { min: 7, label: 'Bien' },
  { min: 6, label: 'Agréable' },
];

/** Converts a Google-style /5 aggregate to the UI /10 scale (×2, one decimal). */
export function scaleRatingToTen(ratingOutOfFive: number): number {
  if (ratingOutOfFive < 0 || ratingOutOfFive > 5) {
    return NaN;
  }
  return Math.round(ratingOutOfFive * 20) / 10;
}

/** Returns the Booking-like label for a /10 score, or `null` below the display floor. */
export function resolveRatingLabel(scoreOutOfTen: number): RatingLabel | null {
  if (!Number.isFinite(scoreOutOfTen) || scoreOutOfTen < 6) {
    return null;
  }
  for (const { min, label } of RATING_THRESHOLDS) {
    if (scoreOutOfTen >= min) {
      return label;
    }
  }
  return null;
}

/** Formats a /10 score for display (one decimal, comma as decimal separator). */
export function formatRatingScore(scoreOutOfTen: number): string {
  const rounded = Math.round(scoreOutOfTen * 10) / 10;
  return rounded.toFixed(1).replace('.', ',');
}
