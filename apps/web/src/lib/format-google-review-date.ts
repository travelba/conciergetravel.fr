/** Format ISO `publish_time` from Google Places for traveller review cards. */
export function formatGoogleReviewDate(
  publishTime: string | null,
  locale: 'fr' | 'en',
): string | null {
  if (publishTime === null || publishTime.trim().length === 0) return null;
  const parsed = Date.parse(publishTime);
  if (!Number.isFinite(parsed)) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(parsed));
}
