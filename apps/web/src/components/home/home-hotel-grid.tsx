import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { HotelImagePlaceholder } from '@/components/hotel/hotel-image-placeholder';
import { HotelCard } from '@/components/shared/hotel-card';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { FeaturedHotelCard } from '@/lib/home/featured-hotels';

/**
 * `<HomeHotelGrid>` — « Les fiches du moment » (CDC §2 + plan §3).
 *
 * Six fiches sélectionnées par notre conciergerie. Cards distinctives
 * via un badge `luxury_tier` (Palace, Relais & Châteaux, boutique,
 * château) + eyebrow pays pour le scope monde.
 *
 * Pure RSC. Reçoit le tableau en prop pour rester compatible avec le
 * Promise.all du parent (page.tsx).
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
    <section
      aria-labelledby="home-featured-hotels"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-featured-hotels" className="text-fg mt-2 font-serif text-3xl sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Link
          href="/hotels"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('seeAll')}
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {hotels.map((h) => {
          const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
          const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
          const countryLabel = pickByLocale(
            locale,
            h.countryLabelFr,
            h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
          );
          const tierBadge = pickTierBadge(h, t);
          const location = countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city;
          return (
            <li key={h.slug}>
              <HotelCard
                href={{ pathname: '/hotel/[slug]', params: { slug } }}
                variant="grid"
                name={name}
                location={location}
                distinction={{
                  label: tierBadge ?? '★'.repeat(h.stars),
                  isPalace: h.isPalace,
                }}
                media={
                  <HotelImage
                    cloudName={cloudName}
                    publicId={h.heroPublicId}
                    alt={name}
                    width={640}
                    height={480}
                    transforms="f_auto,q_auto:good,c_fill,g_auto,w_640,h_480"
                  />
                }
              />
            </li>
          );
        })}
      </ul>

      {/* Fallback placeholder pour les fiches sans hero — n'apparaît
          quasiment jamais en pratique car le fetcher filtre déjà. */}
      <div className="sr-only">
        <HotelImagePlaceholder variant="thumbnail" hotelName="placeholder" />
      </div>
    </section>
  );
}

function pickTierBadge(
  h: FeaturedHotelCard,
  t: (key: 'palace' | 'relaisChateaux' | 'boutique' | 'chateau') => string,
): string | null {
  if (h.isPalace) return t('palace');
  if (h.luxuryTier === 'relais_chateaux') return t('relaisChateaux');
  if (h.luxuryTier === 'boutique') return t('boutique');
  if (h.luxuryTier === 'chateau') return t('chateau');
  return null;
}
