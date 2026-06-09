import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedFeaturedReview } from '@/server/hotels/get-hotel-by-slug';

interface HotelFeaturedReviewsProps {
  readonly locale: SupportedLocale;
  readonly reviews: readonly LocalisedFeaturedReview[];
  /**
   * Which slice to render (kit `template-hotel.html` split):
   *   - `press`   → reviews **without** a numeric rating, as `.press-card`
   *     pull-quotes under « Ils en parlent » (section #presse, H3).
   *   - `reviews` → reviews **with** a numeric rating, as scored `.review`
   *     cards under « Emplacement & accès » (section #acces, H3).
   * The block self-elides when its slice is empty. Defaults to `press`.
   */
  readonly variant?: 'press' | 'reviews';
}

/**
 * Editorial featured-review pull-quotes — CDC §2.10 (bloc 10 had a
 * 1/5 score in the gap analysis before this component shipped).
 *
 * Why pull-quotes and not aggregated user reviews?
 * -------------------------------------------------
 *   - We are NOT a Booking-style aggregator: our trust signal comes
 *     from third-party editorial recognition (Forbes Travel Guide,
 *     Condé Nast Traveler, Michelin, Travel + Leisure, …), not from
 *     anonymous guest counts.
 *   - 1-3 attributed quotes carry more weight than 10,000 scraped
 *     reviews for the kind of luxury palace clientele we target.
 *   - LLMs (Perplexity, SearchGPT) extract `<blockquote>` + `<cite>`
 *     fragments with the citation intact — a pure UX + SEO win.
 *
 * Visual contract
 * ---------------
 *   - 1 col mobile → 2 col `md` → 3 col `lg`. Capped at 3 cards
 *     (visual density). Surplus reviews still ship to JSON-LD
 *     (builder caps at 5 there) but are dropped from the UI.
 *   - Each card is a typographic `<blockquote>` with the source as a
 *     `<cite>`, an optional rating chip ("5★/5", "98/100"), and a
 *     date in fine print. The publication name is the dominant
 *     identifier — quote attribution is what matters.
 *   - The block self-elides when `reviews.length === 0`.
 *
 * a11y
 * ----
 *   - Section labelled by `#featured-reviews-title`.
 *   - Quotes wrapped in `<blockquote>` with `cite` attribute pointing
 *     to `sourceUrl` when present (Schema.org HTML signal).
 *   - Rating chip is a text label, not an icon-only star.
 *
 * Skill: structured-data-schema-org, geo-llm-optimization,
 * accessibility.
 */
const MAX_VISIBLE = 3;

export async function HotelFeaturedReviews({
  locale,
  reviews,
  variant = 'press',
}: HotelFeaturedReviewsProps): Promise<React.ReactElement | null> {
  // Split by presence of a numeric rating: press extracts carry no score,
  // guest reviews do. Each variant self-elides when its slice is empty so an
  // all-press fiche (e.g. Airelles) shows only the press block.
  const slice = reviews.filter((r) =>
    variant === 'reviews' ? r.rating !== null : r.rating === null,
  );
  if (slice.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const visible = slice.slice(0, MAX_VISIBLE);

  if (variant === 'reviews') {
    return (
      <div className="mch-kit bref-sub">
        <h3>{t('featuredReviews.reviewsHeading')}</h3>
        <div className="review-grid" aria-label={t('featuredReviews.listAria')}>
          {visible.map((review, idx) => {
            const scoreLabel =
              review.rating !== null && review.maxRating !== null
                ? `${review.rating}/${review.maxRating}`
                : review.rating !== null
                  ? String(review.rating)
                  : null;
            return (
              <blockquote
                key={`${review.source}-${idx}`}
                className="review"
                cite={review.sourceUrl ?? undefined}
              >
                <div className="rv-top">
                  {scoreLabel !== null ? (
                    <span
                      className="rv-score"
                      aria-label={t('featuredReviews.ratingAria', {
                        value: review.rating ?? 0,
                        max: review.maxRating ?? 0,
                      })}
                    >
                      {scoreLabel}
                    </span>
                  ) : null}
                  <span className="rv-name">{review.source}</span>
                </div>
                <p>{review.quote}</p>
              </blockquote>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mch-kit bref-sub">
      <h3>{t('featuredReviews.pressHeading')}</h3>
      <div className="press-grid" aria-label={t('featuredReviews.listAria')}>
        {visible.map((review, idx) => (
          <blockquote
            key={`${review.source}-${idx}`}
            className="press-card"
            cite={review.sourceUrl ?? undefined}
          >
            <span className="press-src">{review.source}</span>
            <p>{review.quote}</p>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
