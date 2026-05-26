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
  readonly address: string | null;
  readonly postalCode: string | null;
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

const heritageActionClass =
  'border-primary-heritage text-primary-heritage hover:bg-surface-container-low focus-visible:ring-primary-heritage inline-flex min-h-touch items-center gap-2 border px-6 py-3 text-label-caps tracking-caps transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60';

/**
 * Hero ATF for the hotel detail page — Stitch "L'Héritage Editorial" layout
 * (docs/design/stitch/screens/eb47749c…) with real catalogue data.
 *
 * CDC §2 bloc 1 content (factual summary, concierge teaser) is preserved below
 * the Stitch header row; IATA trust chip moves to the booking widget only.
 */
export async function HotelHero({
  locale,
  hotelId,
  name,
  city,
  district,
  region,
  address,
  postalCode,
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

  const addressLine = formatAddressLine(address ?? '', postalCode, city, district);

  return (
    <header id="hotel-hero" className="mb-12" data-hotel-hero>
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            {isPalace ? (
              <span className="border-charcoal text-charcoal text-label-caps tracking-caps inline-block border px-3 py-1 uppercase">
                {t('hero.palace')}
              </span>
            ) : (
              <span className="border-charcoal text-charcoal text-label-caps tracking-caps inline-block border px-3 py-1 uppercase">
                {t('hero.stars', { count: stars })}
              </span>
            )}
            {amadeusRating !== null ? (
              <p
                className="text-primary-heritage inline-flex items-baseline"
                data-testid="hotel-aggregate-rating"
              >
                <span
                  className="text-headline-md font-serif"
                  aria-label={t('rating.scoreAria', {
                    value: amadeusRating.ratingValue.toFixed(1),
                    best: amadeusRating.bestRating,
                  })}
                >
                  {amadeusRating.ratingValue.toFixed(1)}
                </span>
                <span className="text-body-lg ml-1">/10</span>
              </p>
            ) : null}
          </div>

          <h1 className="text-primary-heritage text-display-xl mb-2 font-serif md:text-[4rem]">
            {name}
          </h1>

          {addressLine.length > 0 ? (
            <p className="text-on-surface-variant text-body-lg flex items-start gap-2">
              <LocationIcon />
              <span>{addressLine}</span>
            </p>
          ) : null}

          <div className="mt-4 max-w-3xl">
            <FactualSummary summary={factualSummary} fallback={fallbackSummary} />
          </div>

          {hasConciergeAdvice ? (
            <div className="mt-3">
              <ConciergeAdviceTeaser locale={locale} />
            </div>
          ) : null}

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
        </div>

        <div className="flex shrink-0 flex-wrap gap-4">
          <HotelShareButton
            hotelName={name}
            shareText={description !== null ? description.slice(0, 160) : null}
            canonicalUrl={canonicalUrl}
            buttonClassName={heritageActionClass}
          />
          <HotelFavoriteButton
            hotelId={hotelId}
            hotelName={name}
            returnPath={localePath}
            buttonClassName={heritageActionClass}
            useHeritageLabels
          />
        </div>
      </div>

      {/* Breadcrumb parity anchor for analytics */}
      <span className="sr-only" data-canonical-path={localePath} data-region={region} />
    </header>
  );
}

function formatAddressLine(
  address: string,
  postalCode: string | null,
  city: string,
  district: string | null,
): string {
  const parts: string[] = [];
  if (address.trim().length > 0) parts.push(address.trim());
  const locality =
    postalCode !== null && postalCode !== '' ? `${postalCode} ${city}`.trim() : city.trim();
  if (locality.length > 0) parts.push(locality);
  if (district !== null && district !== '' && !locality.includes(district)) {
    parts.push(district);
  }
  return parts.join(', ');
}

function LocationIcon(): ReactElement {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}
