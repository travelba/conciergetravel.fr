import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { FeaturedHotelCard } from '@/lib/home/featured-hotels';

/**
 * Editorial mosaic placement (HTML kit §magazine). The first tile is a
 * tall "experience" (rows span 2), the second a wide "à la une" (cols
 * span 2), the rest are square cards — a curated magazine rhythm.
 */
const MOSAIC_CLASS: readonly string[] = [
  'card card-experience',
  'card card-amalfi',
  'card',
  'card',
  'card',
  'card',
];

/**
 * `<HomeHotelGrid>` — « Inspiration & Évasion » ported to the HTML kit
 * `magazine` / `mosaic` layout (design/html-kit/index.html §magazine).
 * Real catalogue hotels (Cloudinary photos), tier badge as card tag,
 * name + location overlaid with a legibility gradient.
 *
 * Pure RSC. Receives the array as a prop (parent Promise.all).
 */
export async function HomeHotelGrid({
  locale,
  hotels,
  cloudName,
}: {
  readonly locale: Locale;
  readonly hotels: readonly FeaturedHotelCard[];
  readonly cloudName: string;
}): Promise<ReactElement | null> {
  if (hotels.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'homepage.featuredHotels' });

  return (
    <div className="mch-kit">
      <section className="magazine" id="magazine" aria-labelledby="home-featured-hotels">
        <div className="wrap">
          <div className="mag-head reveal">
            <div className="mh-left">
              <span className="eyebrow left">{t('eyebrow')}</span>
              <h2 id="home-featured-hotels">{t('title')}</h2>
              <p>{t('subtitle')}</p>
            </div>
            <Link href="/hotels" className="link-or">
              {t('seeAll')} →
            </Link>
          </div>

          <div className="mosaic reveal">
            {hotels.map((h, i) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
              const countryLabel = pickByLocale(
                locale,
                h.countryLabelFr,
                h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
              );
              const mosaicTag = pickMosaicTag(i, t);
              const location = countryLabel.length > 0 ? `${h.city}, ${countryLabel}` : h.city;
              const isFeature = i === 0;
              return (
                <Link
                  key={h.slug}
                  href={{ pathname: '/hotel/[slug]', params: { slug } }}
                  className={MOSAIC_CLASS[i] ?? 'card'}
                  aria-label={name}
                >
                  <HotelImage
                    cloudName={cloudName}
                    publicId={h.heroPublicId}
                    alt={name}
                    width={isFeature ? 760 : 640}
                    height={isFeature ? 950 : 480}
                    transforms={
                      isFeature
                        ? 'f_auto,q_auto:good,c_fill,g_auto,w_760,h_950'
                        : 'f_auto,q_auto:good,c_fill,g_auto,w_640,h_480'
                    }
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="h-full w-full"
                  />
                  <div className="card-body">
                    {mosaicTag !== null ? <span className="card-tag">{mosaicTag}</span> : null}
                    <h3>{name}</h3>
                    <div className="loc">{location}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function pickMosaicTag(
  index: number,
  t: (key: 'experience' | 'featured') => string,
): string | null {
  if (index === 0) return t('experience');
  if (index === 1) return t('featured');
  return null;
}
