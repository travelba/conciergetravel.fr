import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { HotelImage } from '@mch/ui';

import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';

/**
 * Typed hrefs for the six intl country guide pages currently shipped
 * (Italie, Japon, Maroc, Suisse, Maldives, États-Unis). Each must match
 * a concrete static route under `apps/web/src/app/[locale]/guide/<x>/`
 * so the next-intl `Link` helper stays type-safe (ADR-0008 — flat slug).
 */
export type CountryGuideHref =
  | '/guide/italie'
  | '/guide/japon'
  | '/guide/maroc'
  | '/guide/suisse'
  | '/guide/maldives'
  | '/guide/etats-unis';

/**
 * One destination card on the home grid. Three variants:
 * - `city`    — published French city with a real hotel count, links to
 *               `/destination/[citySlug]`.
 * - `country` — intl editorial country guide (Italie, Japon, Maroc, USA…),
 *               links to `/guide/<country>` with a typed href.
 * - `ranking` — fallback for countries without a dedicated guide page
 *               yet (Grèce, Royaume-Uni). Lands on the country ranking
 *               `/classement/<slug>` so the user still gets a real
 *               editorial surface, not a 404.
 *
 * `imagePublicId` is a representative hotel hero (Cloudinary public id)
 * sourced from the catalogue for that geography — `null` when none is
 * available (degraded env), in which case the tile falls back to a sober
 * charcoal panel with the label.
 */
export type HomeDestinationCardData =
  | {
      readonly key: string;
      readonly label: string;
      readonly variant: 'city';
      readonly citySlug: string;
      readonly hint: string;
      readonly imagePublicId: string | null;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly variant: 'country';
      readonly href: CountryGuideHref;
      readonly imagePublicId: string | null;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly variant: 'ranking';
      readonly rankingSlug: string;
      readonly imagePublicId: string | null;
    };

interface HomeDestinationGridProps {
  readonly locale: string;
  readonly destinations: readonly HomeDestinationCardData[];
  readonly cloudName: string;
}

/**
 * Inner tile: representative photo (or charcoal fallback) + legibility
 * gradient + serif label and caption overlaid at the bottom. Shared by
 * the three link variants so the markup stays in one place while each
 * branch keeps its own type-safe href.
 */
function DestinationTileInner({
  label,
  caption,
  imagePublicId,
  cloudName,
}: {
  readonly label: string;
  readonly caption: string;
  readonly imagePublicId: string | null;
  readonly cloudName: string;
}): ReactElement {
  return (
    <>
      {imagePublicId !== null ? (
        <HotelImage
          cloudName={cloudName}
          publicId={imagePublicId}
          alt={label}
          width={640}
          height={800}
          transforms="f_auto,q_auto:good,c_fill,g_auto,w_640,h_800"
          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 33vw, 25vw"
          className="ease-editorial absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transition-none"
        />
      ) : (
        <div aria-hidden className="bg-charcoal absolute inset-0" />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-serif text-xl leading-snug text-white">{label}</p>
        {caption.length > 0 ? (
          <p className="text-gold-200 mt-1 text-[11px] uppercase tracking-[0.18em]">{caption}</p>
        ) : null}
      </div>
    </>
  );
}

/**
 * Featured destinations band on the home page. Mixes French city hubs
 * (canonical `/destination/[slug]` with published hotel counts) with
 * intl country guide teasers (`/guide/<country>`) so the global scope
 * promised by the new tagline (ADR-0021) is visible above the fold of
 * the destinations strip — not buried in the footer.
 *
 * Editorial photo tiles (representative hotel hero per geography) with
 * overlaid labels — a full-bleed photographic rhythm rather than flat
 * text cards. Renders nothing when no published cities are available.
 *
 * Server Component — only ships markup, no client JS.
 */
export async function HomeDestinationGrid({
  locale,
  destinations,
  cloudName,
}: HomeDestinationGridProps): Promise<ReactElement | null> {
  if (destinations.length === 0) return null;
  if (!isRoutingLocale(locale)) return null;
  const typedLocale: Locale = locale;
  const t = await getTranslations({ locale: typedLocale, namespace: 'homepage' });
  const eyebrow = t('featuredDestinations.eyebrow');

  return (
    <section
      aria-labelledby="home-featured-destinations"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">{eyebrow}</p>
          <h2
            id="home-featured-destinations"
            className="text-fg mt-2 font-serif text-3xl sm:text-4xl"
          >
            {t('featuredDestinations.title')}
          </h2>
          <p className="text-muted mt-3 text-sm sm:text-base">
            {t('featuredDestinations.subtitle')}
          </p>
        </div>
        <Link
          href="/destination"
          className="text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          {t('featuredDestinations.seeAll')}
        </Link>
      </div>

      {/*
        Mobile : carrousel snap horizontal (peek ~28 %). Desktop : grille
        2 → 4 colonnes de tuiles photo verticales (aspect 4/5).
        Voir `.cursor/skills/responsive-ui-architecture/SKILL.md`.
      */}
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {destinations.map((d) => {
          const liClassName =
            'group relative aspect-[4/5] shrink-0 basis-[72%] snap-start overflow-hidden rounded-2xl sm:basis-auto';
          const linkClassName =
            'focus-visible:ring-ring block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
          if (d.variant === 'city') {
            return (
              <li key={d.key} className={liClassName}>
                <Link
                  href={{ pathname: '/destination/[citySlug]', params: { citySlug: d.citySlug } }}
                  aria-label={d.label}
                  className={linkClassName}
                >
                  <DestinationTileInner
                    label={d.label}
                    caption={d.hint}
                    imagePublicId={d.imagePublicId}
                    cloudName={cloudName}
                  />
                </Link>
              </li>
            );
          }
          if (d.variant === 'country') {
            return (
              <li key={d.key} className={liClassName}>
                <Link href={d.href} aria-label={d.label} className={linkClassName}>
                  <DestinationTileInner
                    label={d.label}
                    caption={eyebrow}
                    imagePublicId={d.imagePublicId}
                    cloudName={cloudName}
                  />
                </Link>
              </li>
            );
          }
          return (
            <li key={d.key} className={liClassName}>
              <Link
                href={{ pathname: '/classement/[slug]', params: { slug: d.rankingSlug } }}
                aria-label={d.label}
                className={linkClassName}
              >
                <DestinationTileInner
                  label={d.label}
                  caption={eyebrow}
                  imagePublicId={d.imagePublicId}
                  cloudName={cloudName}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
