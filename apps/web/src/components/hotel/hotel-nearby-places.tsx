import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { buildCloudinarySrc } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { env } from '@/lib/env';
import type { NearbyPlaceCard } from '@/server/hotels/get-nearby-places-for-hotel';

/**
 * "Lieux à visiter à proximité" — reverse maillage from the hotel fiche
 * into the "lieux" vertical (the inverse of the place fiche's "Hôtels à
 * proximité" block). Renders a short card per published place with a
 * crawlable `<Link>` to `/lieux/[citySlug]/[placeSlug]`, locale-aware
 * (EN uses `slug_en` when present).
 *
 * Anti-cannibalisation: the hotel page shows only a teaser card + link —
 * never the long place description (that lives on the canonical fiche).
 *
 * Self-elides when the list is empty (frequent outside Paris/Gordes
 * today), so no empty block ever ships.
 */

const HERO_TRANSFORM = 'c_fill,w_600,h_400,f_auto,q_auto';

/**
 * Resolve a place `hero_image` (Cloudinary public_id OR absolute URL)
 * into a delivery URL. Duplicated locally (kept off the `server/places`
 * vertical) so the hotel surface owns its own rendering primitives.
 */
function placeHeroSrc(heroImage: string | null): string | null {
  if (heroImage === null || heroImage.trim().length === 0) return null;
  if (/^https?:\/\//u.test(heroImage)) return heroImage;
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined || cloudName.length === 0) return null;
  return buildCloudinarySrc({ cloudName, publicId: heroImage, transforms: HERO_TRANSFORM });
}

function pickName(card: NearbyPlaceCard, locale: Locale): string {
  if (locale === 'en' && card.nameEn !== null && card.nameEn.trim().length > 0) return card.nameEn;
  return card.name;
}

function pickSummary(card: NearbyPlaceCard, locale: Locale): string | null {
  const primary = locale === 'en' ? card.factualSummaryEn : card.factualSummaryFr;
  const fallback = locale === 'en' ? card.factualSummaryFr : card.factualSummaryEn;
  const chosen =
    primary !== null && primary.trim().length > 0
      ? primary
      : fallback !== null && fallback.trim().length > 0
        ? fallback
        : null;
  if (chosen === null) return null;
  return chosen.length <= 130 ? chosen : `${chosen.slice(0, 127).trimEnd()}…`;
}

function pickSlug(card: NearbyPlaceCard, locale: Locale): string {
  if (locale === 'en' && card.slugEn !== null && card.slugEn.trim().length > 0) return card.slugEn;
  return card.slug;
}

interface HotelNearbyPlacesProps {
  readonly locale: Locale;
  readonly hotelName: string;
  readonly places: readonly NearbyPlaceCard[];
}

export async function HotelNearbyPlaces({
  locale,
  hotelName,
  places,
}: HotelNearbyPlacesProps): Promise<ReactElement | null> {
  if (places.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'hotelPage.nearbyPlaces' });

  return (
    <section id="lieux-a-proximite" aria-labelledby="nearby-places-title" className="mb-12 mt-10">
      <h3 id="nearby-places-title" className="text-fg font-serif text-2xl">
        {t('title')}
      </h3>
      <p className="text-muted mt-2 max-w-2xl text-sm leading-relaxed">
        {t('lead', { hotelName })}
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((card) => {
          const name = pickName(card, locale);
          const summary = pickSummary(card, locale);
          const src = placeHeroSrc(card.heroImage);
          const slug = pickSlug(card, locale);
          const distance =
            card.walkMinutes !== null && card.walkMinutes > 0
              ? t('walkMinutes', { count: card.walkMinutes })
              : t('distanceMeters', { meters: card.distanceMeters });
          return (
            <li
              key={`${card.citySlug}/${card.slug}`}
              className="border-border bg-bg overflow-hidden rounded-lg border transition hover:shadow-md"
            >
              <Link
                href={{
                  pathname: '/lieux/[citySlug]/[placeSlug]',
                  params: { citySlug: card.citySlug, placeSlug: slug },
                }}
                prefetch={false}
                className="focus-visible:ring-ring block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {src !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary, intrinsic dims not needed here
                  <img src={src} alt={name} loading="lazy" className="h-40 w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <p className="text-muted text-xs">{distance}</p>
                  <h4 className="text-fg mt-1 text-base font-medium leading-snug">{name}</h4>
                  {summary !== null ? (
                    <p className="text-muted mt-2 line-clamp-3 text-sm">{summary}</p>
                  ) : null}
                  <span className="text-fg mt-3 inline-block text-sm font-medium underline underline-offset-4">
                    {t('viewPlace')}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
