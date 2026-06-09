import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { RecentOpeningCard } from '@/lib/home/recent-openings';

/**
 * `<HomeOpeningsGrid>` — « Le Concierge a frappé à leur porte » ported to
 * the HTML kit `section-pad` + `grid-4` / `hcard` layout
 * (design/html-kit/index.html §"Récemment visités"). Four real catalogue
 * addresses (highest `priority`), Cloudinary photos, link to each fiche.
 *
 * Pure RSC. Receives the array as a prop (parent Promise.all).
 */
export async function HomeOpeningsGrid({
  locale,
  openings,
  cloudName,
}: {
  readonly locale: Locale;
  readonly openings: readonly RecentOpeningCard[];
  readonly cloudName: string;
}): Promise<ReactElement | null> {
  if (openings.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'homepage.openings' });

  return (
    <div className="mch-kit">
      <section className="section-pad" id="hotels" aria-labelledby="home-openings-title">
        <div className="wrap">
          <div className="mag-head">
            <div className="mh-left">
              <span className="eyebrow left">{t('eyebrow')}</span>
              <h2 id="home-openings-title">{t('title')}</h2>
              <p>{t('subtitle')}</p>
            </div>
            <Link href="/ouvertures" className="link-or">
              {t('seeAll')} →
            </Link>
          </div>

          <div className="grid-4">
            {openings.map((h) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
              const countryLabel = pickByLocale(
                locale,
                h.countryLabelFr,
                h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
              );
              const location = countryLabel.length > 0 ? `${h.city}, ${countryLabel}` : h.city;
              return (
                <Link
                  key={h.slug}
                  href={{ pathname: '/hotel/[slug]', params: { slug } }}
                  className="hcard"
                  aria-label={name}
                >
                  <div className="hcard-img">
                    <HotelImage
                      cloudName={cloudName}
                      publicId={h.heroPublicId}
                      alt={name}
                      width={520}
                      height={650}
                      transforms="f_auto,q_auto:good,c_fill,g_auto,w_520,h_650"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                      className="h-full w-full"
                    />
                  </div>
                  <div className="hcard-body">
                    <h3>{name}</h3>
                    <span className="loc">{location}</span>
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
