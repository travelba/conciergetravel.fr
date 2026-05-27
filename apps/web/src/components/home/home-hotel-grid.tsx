import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { HotelImagePlaceholder } from '@/components/hotel/hotel-image-placeholder';
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
          return (
            <li key={h.slug}>
              <article className="border-border bg-bg group h-full overflow-hidden rounded-lg border transition-shadow hover:shadow-md">
                <Link
                  href={{ pathname: '/hotel/[slug]', params: { slug } }}
                  className="block focus-visible:outline-none"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <HotelImage
                      cloudName={cloudName}
                      publicId={h.heroPublicId}
                      alt={name}
                      width={640}
                      height={480}
                      transforms="f_auto,q_auto:good,c_fill,g_auto,w_640,h_480"
                    />
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="text-muted flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
                      {tierBadge !== null ? (
                        <span
                          className={
                            h.isPalace
                              ? 'rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900'
                              : 'border-border bg-bg rounded-md border px-2 py-0.5'
                          }
                        >
                          {tierBadge}
                        </span>
                      ) : (
                        <span className="border-border bg-bg rounded-md border px-2 py-0.5">
                          {'★'.repeat(h.stars)}
                        </span>
                      )}
                      <span>
                        {countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city}
                      </span>
                    </div>
                    <h3 className="text-fg mt-3 font-serif text-lg leading-snug">{name}</h3>
                    <p className="text-muted mt-3 inline-flex items-center text-xs underline-offset-2 group-hover:underline">
                      {t('viewFiche')} →
                    </p>
                  </div>
                </Link>
              </article>
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
