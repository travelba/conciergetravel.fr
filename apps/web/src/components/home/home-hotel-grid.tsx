import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { FeaturedHotelCard } from '@/lib/home/featured-hotels';

/**
 * Editorial masonry pattern (lg, 4-column grid). The first tile is a
 * 2×2 "feature", followed by a wide tile and two square tiles, then two
 * wide tiles — a curated, magazine-style rhythm rather than a uniform
 * grid. The same span strings also degrade gracefully on the base
 * 2-column grid (col-span-2 → full width, col-span-1 → half), so no
 * responsive variants are needed. Index beyond the pattern falls back to
 * a 1×1 tile.
 */
const MOSAIC_SPANS: readonly string[] = [
  'col-span-2 row-span-2',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-2 row-span-1',
];

/**
 * `<HomeHotelGrid>` — « Les fiches du moment » (CDC §2 + plan §3).
 *
 * Mosaïque éditoriale (masonry) : tuile feature 2×2 + hauteurs variées,
 * légende (nom serif + lieu + distinction) en surimpression sur la photo
 * avec dégradé de lisibilité. Distinction via badge `luxury_tier`
 * (Palace, Relais & Châteaux, boutique, château) ou étoiles.
 *
 * Pure RSC. Reçoit le tableau en prop pour rester compatible avec le
 * Promise.all du parent (page.tsx). Photos réelles du catalogue
 * (Cloudinary) — aucun placeholder.
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

      <ul className="grid auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[10rem] sm:gap-4 lg:auto-rows-[11rem] lg:grid-cols-4">
        {hotels.map((h, i) => {
          const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
          const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
          const countryLabel = pickByLocale(
            locale,
            h.countryLabelFr,
            h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
          );
          const tierBadge = pickTierBadge(h, t);
          const location = countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city;
          const span = MOSAIC_SPANS[i] ?? 'col-span-1 row-span-1';
          const isFeature = i === 0;
          return (
            <li key={h.slug} className={`group relative overflow-hidden rounded-2xl ${span}`}>
              <Link
                href={{ pathname: '/hotel/[slug]', params: { slug } }}
                aria-label={name}
                className="focus-visible:ring-ring block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <HotelImage
                  cloudName={cloudName}
                  publicId={h.heroPublicId}
                  alt={name}
                  width={isFeature ? 960 : 640}
                  height={isFeature ? 960 : 480}
                  transforms={
                    isFeature
                      ? 'f_auto,q_auto:good,c_fill,g_auto,w_960,h_960'
                      : 'f_auto,q_auto:good,c_fill,g_auto,w_640,h_480'
                  }
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="ease-editorial absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                />
                {tierBadge !== null ? (
                  <span className="bg-gold/95 text-charcoal absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide">
                    {tierBadge}
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3
                    className={`font-serif text-white ${isFeature ? 'text-2xl sm:text-3xl' : 'text-lg'}`}
                  >
                    {name}
                  </h3>
                  <p className="mt-1 flex items-center gap-2 text-xs text-white/85">
                    <span className="truncate">{location}</span>
                    <span aria-hidden className="text-gold-300 shrink-0">
                      {'★'.repeat(h.stars)}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
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
