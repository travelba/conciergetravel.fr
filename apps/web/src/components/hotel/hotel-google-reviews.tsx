import { getTranslations } from 'next-intl/server';

import { GoogleReviewQuote } from '@/components/hotel/google-review-quote';
import { formatGoogleReviewDate } from '@/lib/format-google-review-date';
import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedGoogleReview } from '@/server/hotels/get-hotel-by-slug';

interface HotelGoogleReviewsProps {
  readonly locale: SupportedLocale;
  readonly reviews: readonly LocalisedGoogleReview[];
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly googleMapsUrl: string | null;
}

const MAX_VISIBLE = 3;

/**
 * Google Maps / Business Profile traveler reviews for #acces.
 * Self-elides when there is no aggregate score and no cached review quotes.
 */
export async function HotelGoogleReviews({
  locale,
  reviews,
  rating,
  reviewCount,
  googleMapsUrl,
}: HotelGoogleReviewsProps): Promise<React.ReactElement | null> {
  const hasAggregate =
    rating !== null && reviewCount !== null && reviewCount > 0 && Number.isFinite(rating);
  const visible = reviews.slice(0, MAX_VISIBLE);
  if (!hasAggregate && visible.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const aggregateRating = rating ?? 0;
  const aggregateCount = reviewCount ?? 0;
  const ratingLabel = hasAggregate
    ? locale === 'en'
      ? aggregateRating.toFixed(1)
      : aggregateRating.toFixed(1).replace('.', ',')
    : null;
  const kitLocale = locale === 'en' ? 'en' : 'fr';
  const quoteLabels = {
    seeMore: t('googleReviews.seeMore'),
    seeLess: t('googleReviews.seeLess'),
  };

  return (
    <div className="mch-kit bref-sub">
      <h3>{t('googleReviews.heading')}</h3>

      {hasAggregate ? (
        <p className="text-fg mb-4 text-sm">
          <span
            className="border-accent/40 text-accent rounded-full border px-2.5 py-0.5 font-medium tabular-nums"
            aria-label={t('googleReviews.aggregateAria', {
              rating: aggregateRating,
              count: aggregateCount,
            })}
          >
            {ratingLabel} / 5 · {aggregateCount.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR')}{' '}
            {locale === 'en' ? 'reviews' : 'avis'}
          </span>
        </p>
      ) : null}

      {visible.length > 0 ? (
        <div className="review-grid" aria-label={t('googleReviews.listAria')}>
          {visible.map((review, idx) => (
            <blockquote key={`${review.author}-${idx}`} className="review">
              <div className="rv-top">
                <span
                  className="rv-score"
                  aria-label={t('featuredReviews.ratingAria', {
                    value: review.rating,
                    max: 5,
                  })}
                >
                  {review.rating}/5
                </span>
                <span className="rv-name">{review.author}</span>
              </div>
              <GoogleReviewQuote
                text={review.text}
                publishDate={formatGoogleReviewDate(review.publishTime, kitLocale)}
                labels={quoteLabels}
              />
            </blockquote>
          ))}
        </div>
      ) : null}

      <p className="text-muted mt-4 text-xs">
        {googleMapsUrl !== null ? (
          <>
            {t('googleReviews.attribution')}{' '}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-fg underline"
            >
              {t('googleReviews.viewOnGoogle')}
            </a>
          </>
        ) : (
          t('googleReviews.attribution')
        )}
      </p>
    </div>
  );
}
