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
          width={520}
          height={520}
          transforms="f_auto,q_auto:good,c_fill,g_auto,w_520,h_520"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
          className="h-full w-full"
        />
      ) : (
        <div aria-hidden className="bg-charcoal absolute inset-0" />
      )}
      <span className="dt-label">
        {label}
        {caption.length > 0 ? <em>{caption}</em> : null}
      </span>
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
    <div className="mch-kit">
      <section
        className="section-pad"
        id="destinations"
        aria-labelledby="home-featured-destinations"
      >
        <div className="wrap">
          <div className="mag-head">
            <div className="mh-left">
              <span className="eyebrow left">{eyebrow}</span>
              <h2 id="home-featured-destinations">{t('featuredDestinations.title')}</h2>
              <p>{t('featuredDestinations.subtitle')}</p>
            </div>
            <Link href="/destination" className="link-or">
              {t('featuredDestinations.seeAll')} →
            </Link>
          </div>

          <div className="dest-grid">
            {destinations.map((d) => {
              if (d.variant === 'city') {
                return (
                  <Link
                    key={d.key}
                    href={{ pathname: '/destination/[citySlug]', params: { citySlug: d.citySlug } }}
                    aria-label={d.label}
                    className="dest-tile"
                  >
                    <DestinationTileInner
                      label={d.label}
                      caption={d.hint}
                      imagePublicId={d.imagePublicId}
                      cloudName={cloudName}
                    />
                  </Link>
                );
              }
              if (d.variant === 'country') {
                return (
                  <Link key={d.key} href={d.href} aria-label={d.label} className="dest-tile">
                    <DestinationTileInner
                      label={d.label}
                      caption={eyebrow}
                      imagePublicId={d.imagePublicId}
                      cloudName={cloudName}
                    />
                  </Link>
                );
              }
              return (
                <Link
                  key={d.key}
                  href={{ pathname: '/classement/[slug]', params: { slug: d.rankingSlug } }}
                  aria-label={d.label}
                  className="dest-tile"
                >
                  <DestinationTileInner
                    label={d.label}
                    caption={eyebrow}
                    imagePublicId={d.imagePublicId}
                    cloudName={cloudName}
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
