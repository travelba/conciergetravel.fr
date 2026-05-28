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
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {openings.map((h) => {
          const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
          const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
          const countryLabel = pickByLocale(
            locale,
            h.countryLabelFr,
            h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
          );
          return (
            <li key={h.slug} className="shrink-0 basis-[82%] snap-start sm:basis-auto">
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
                      width={480}
                      height={360}
                      transforms="f_auto,q_auto:good,c_fill,g_auto,w_480,h_360"
                    />
                  </div>
                  <div className="p-4">
                    <div className="text-muted flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                      <span className="border-border bg-bg rounded-md border px-2 py-0.5">
                        {h.isPalace ? 'Palace' : `${'★'.repeat(h.stars)}`}
                      </span>
                      <span>
                        {countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city}
                      </span>
                    </div>
                    <h3 className="text-fg mt-3 font-serif text-base leading-snug">{name}</h3>
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
    </section>
  );
}
