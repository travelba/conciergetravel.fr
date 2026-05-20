import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { HotelFactualSummary } from '@/server/hotels/get-hotel-by-slug';

import { ConciergeAdviceTeaser } from './concierge-advice-teaser';
import { FactualSummary } from './factual-summary';
import { HotelFavoriteButton } from './hotel-favorite-button';
import { HotelShareButton } from './hotel-share-button';

export interface HotelHeroRating {
  readonly ratingValue: number;
  readonly reviewCount: number;
  readonly bestRating: number;
}

interface HotelHeroProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly name: string;
  readonly city: string;
  readonly district: string | null;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly canonicalUrl: string;
  readonly localePath: string;
  readonly description: string | null;
  readonly factualSummary: HotelFactualSummary | null;
  readonly fallbackSummary: string | null;
  readonly amadeusRating: HotelHeroRating | null;
  readonly hasMapLink: boolean;
  readonly hasConciergeAdvice: boolean;
  readonly mapLink: string | null;
}

/**
 * Hero ATF for the hotel detail page — CDC §2 bloc 1 + ADR-0013
 * §Trust Layer.
 *
 * Composition (top to bottom):
 *  1. Eyebrow row (palace/stars chip + city + district + region) +
 *     favourite & share actions
 *  2. H1 (hotel name, font-serif)
 *  3. AggregateRating (Amadeus first, Google Places fallback)
 *  4. IATA agency chip (anchor element of the Decision Layer trust
 *     signal — repeated in the BookingWidget)
 *  5. `<FactualSummary>` (B1) — 130-150 chars CDC §2.3
 *  6. `<ConciergeAdviceTeaser>` — short link down to the full
 *     `#concierge-advice` block (Concierge voice — ADR-0011)
 *  7. Optional OSM map link when GPS is set but no POIs to render
 *
 * Pure RSC, no client JS. The `<HotelFavoriteButton>` /
 * `<HotelShareButton>` are existing client islands re-used as-is.
 *
 * Anchored via `id="hotel-hero"` for AEO speakable + analytics
 * tracking. The factual summary is independently anchored via
 * `id="factual-summary"` inside `<FactualSummary>` (B10).
 */
export async function HotelHero({
  locale,
  hotelId,
  name,
  city,
  district,
  region,
  isPalace,
  stars,
  canonicalUrl,
  localePath,
  description,
  factualSummary,
  fallbackSummary,
  amadeusRating,
  hasMapLink,
  hasConciergeAdvice,
  mapLink,
}: HotelHeroProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });
  const tw = await getTranslations({ locale, namespace: 'hotelPage.widget.trust' });

  return (
    <header id="hotel-hero" className="mb-10" data-hotel-hero>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="text-muted flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
          {isPalace ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
              {t('hero.palace')}
            </span>
          ) : (
            <span className="border-border bg-bg rounded-md border px-2 py-1">
              {t('hero.stars', { count: stars })}
            </span>
          )}
          <span>{city}</span>
          {district !== null && district !== '' ? (
            <>
              <span aria-hidden>{t('hero.districtSeparator')}</span>
              <span>{district}</span>
            </>
          ) : null}
          {region !== '' ? (
            <>
              <span aria-hidden>{t('hero.districtSeparator')}</span>
              <span>{region}</span>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HotelFavoriteButton hotelId={hotelId} hotelName={name} returnPath={localePath} />
          <HotelShareButton
            hotelName={name}
            shareText={description !== null ? description.slice(0, 160) : null}
            canonicalUrl={canonicalUrl}
          />
        </div>
      </div>

      <h1 className="text-fg mt-3 font-serif text-3xl sm:text-4xl md:text-5xl">{name}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {amadeusRating !== null ? (
          <p
            className="text-fg inline-flex items-center gap-2 text-sm"
            data-testid="hotel-aggregate-rating"
          >
            <span
              className="border-border bg-bg inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium"
              aria-label={t('rating.scoreAria', {
                value: amadeusRating.ratingValue.toFixed(1),
                best: amadeusRating.bestRating,
              })}
            >
              <span aria-hidden>★</span>
              <span>
                {t('rating.scoreOf', {
                  value: amadeusRating.ratingValue.toFixed(1),
                  best: amadeusRating.bestRating,
                })}
              </span>
            </span>
            <span className="text-muted">
              {t('rating.reviewCount', { count: amadeusRating.reviewCount })}
            </span>
          </p>
        ) : null}
        <span
          className="border-border bg-bg text-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium"
          data-trust-chip="iata"
        >
          <span aria-hidden>✓</span>
          {tw('iata')}
        </span>
      </div>

      <FactualSummary summary={factualSummary} fallback={fallbackSummary} />

      {hasConciergeAdvice ? <ConciergeAdviceTeaser locale={locale} /> : null}

      {hasMapLink && mapLink !== null ? (
        <p className="mt-3 text-sm">
          <a
            href={mapLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-fg underline"
          >
            {t('hero.viewMap')}
          </a>
        </p>
      ) : null}
      {/* localePath is referenced for analytics / share button parity */}
      <span className="sr-only" data-canonical-path={localePath} />
    </header>
  );
}
