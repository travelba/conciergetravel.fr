import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { SupportedLocale } from '@/i18n/supported-locale';

import { HotelFavoriteButton } from './hotel-favorite-button';
import { HotelShareButton } from './hotel-share-button';

export interface HotelHeroRating {
  readonly ratingValue: number;
  readonly reviewCount: number;
  readonly bestRating: number;
  /** Provenance of the score — drives the visible attribution label. */
  readonly source: 'google' | 'amadeus' | 'booking';
}

interface HotelHeroProps {
  readonly locale: SupportedLocale;
  readonly hotelId: string;
  readonly name: string;
  readonly address: string | null;
  readonly postalCode: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly region: string;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly canonicalUrl: string;
  readonly localePath: string;
  readonly description: string | null;
  readonly aggregateRating: HotelHeroRating | null;
}

/** Maps a rating provenance to its i18n source-label key. */
const RATING_SOURCE_LABEL_KEY: Readonly<Record<HotelHeroRating['source'], string>> = {
  google: 'rating.sourceGoogle',
  amadeus: 'rating.sourceAmadeus',
  booking: 'rating.sourceBooking',
};

/**
 * Hotel fiche header (CDC §2.1) — badge + optional rating, H1, address,
 * Share/Save actions. The media gallery renders below via `<HotelGallery>`.
 */
export async function HotelHero({
  locale,
  hotelId,
  name,
  address,
  postalCode,
  city,
  district,
  region,
  isPalace,
  stars,
  canonicalUrl,
  localePath,
  description,
  aggregateRating,
}: HotelHeroProps): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  const addressLine = formatAddressLine(address ?? '', postalCode, city, district);
  const category = isPalace ? t('hero.palaceBadge') : t('hero.stars', { count: stars });
  // Eyebrow: "Palace · Paris · Île-de-France" (kit `.eyebrow.left`).
  const eyebrowParts = [category, city, region].filter((p) => p !== null && p !== '');

  return (
    <header id="hotel-hero" className="mch-kit mb-12" data-hotel-hero>
      <div className="htl-head">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <span className="eyebrow left">{eyebrowParts.join(' · ')}</span>
            <h1>{name}</h1>
            <div className="htl-stars" aria-label={category}>
              <span aria-hidden="true">{'★'.repeat(stars)}</span>
              {isPalace ? <span className="htl-palace">{t('hero.palaceBadge')}</span> : null}
            </div>

            {addressLine.length > 0 ? (
              <p className="htl-loc">
                <LocationIcon />
                <span>{addressLine}</span>
              </p>
            ) : null}

            {aggregateRating !== null ? (
              <div className="htl-rating" data-testid="hotel-aggregate-rating">
                <span
                  className="rt-score"
                  aria-label={t('rating.scoreAria', {
                    value: aggregateRating.ratingValue.toFixed(1),
                    best: aggregateRating.bestRating,
                  })}
                >
                  {aggregateRating.ratingValue.toFixed(1)}
                </span>
                <span className="rt-tx">
                  <b>
                    {aggregateRating.ratingValue.toFixed(1)}/{aggregateRating.bestRating}
                  </b>
                  <span>
                    {aggregateRating.reviewCount > 0
                      ? `${t('rating.reviewCountShort', { count: aggregateRating.reviewCount })} · `
                      : ''}
                    {t('rating.ratedBy', {
                      source: t(RATING_SOURCE_LABEL_KEY[aggregateRating.source]),
                    })}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-wrap gap-4 md:w-auto">
            <HotelShareButton
              hotelName={name}
              shareText={description !== null ? description.slice(0, 160) : null}
              canonicalUrl={canonicalUrl}
            />
            <HotelFavoriteButton hotelId={hotelId} hotelName={name} returnPath={localePath} />
          </div>
        </div>
      </div>

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
