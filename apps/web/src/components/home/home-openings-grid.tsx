import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { RecentOpeningCard } from '@/lib/home/recent-openings';

/**
 * `<HomeOpeningsGrid>` — « Le Concierge a frappé à leur porte ».
 *
 * Bloc de 4 adresses tirées des plus hauts `priority` du catalogue
 * (cf. `recent-openings.ts` §sourcing signal). Layout 1 col mobile,
 * 2 cols tablet, 4 cols desktop. Cards plus denses que `<HomeHotelGrid>`
 * pour signaler une intention différente : « les dernières adresses
 * que la conciergerie a visitées », pas « les fiches du moment ».
 *
 * CTA bouton plein vers `/ouvertures` — la page dédiée liste jusqu'à
 * 20 entrées avec leur date d'ouverture (vide en Phase 1).
 *
 * Pure RSC. Reçoit le tableau en prop (Promise.all parent).
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
    <section
      aria-labelledby="home-openings-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
          <h2 id="home-openings-title" className="text-fg mt-2 font-serif text-3xl sm:text-4xl">
            {t('title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">{t('subtitle')}</p>
        </div>
        <Link
          href="/ouvertures"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('seeAll')}
        </Link>
      </div>

      {/*
        Mobile : carrousel horizontal snap (peek de ~18 % du card suivant
        = signal visuel évident qu'on peut swiper). Desktop : grille
        2-cols (sm) → 4-cols (lg). Voir
        `.cursor/skills/responsive-ui-architecture/SKILL.md` §"Snap
        carousels" pour la justification du pattern.
      */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {openings.map((h) => {
          const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
          const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
          const countryLabel = pickByLocale(
            locale,
            h.countryLabelFr,
            h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
          );
          const location = countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city;
          return (
            <li
              key={h.slug}
              className="group relative aspect-[3/2] shrink-0 basis-[82%] snap-start overflow-hidden rounded-2xl sm:basis-auto"
            >
              <Link
                href={{ pathname: '/hotel/[slug]', params: { slug } }}
                aria-label={name}
                className="focus-visible:ring-ring block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <HotelImage
                  cloudName={cloudName}
                  publicId={h.heroPublicId}
                  alt={name}
                  width={640}
                  height={428}
                  transforms="f_auto,q_auto:good,c_fill,g_auto,w_640,h_428"
                  sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 25vw"
                  className="ease-editorial absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transition-none"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                />
                <span className="bg-gold/95 text-charcoal absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide">
                  {h.isPalace ? 'Palace' : `${'★'.repeat(h.stars)}`}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-gold-200 text-[11px] uppercase tracking-[0.18em]">
                    {location}
                  </p>
                  <h3 className="mt-1 font-serif text-lg leading-snug text-white">{name}</h3>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
