import 'server-only';

import { getTranslations } from 'next-intl/server';

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
 * One destination card on the home grid. Two variants:
 * - `city`   — published French city with a real hotel count, links to
 *              `/destination/[citySlug]`.
 * - `country` — intl editorial country guide (no live count yet — Phase
 *               1 still has zero published rows outside France), links
 *               to `/guide/<country>` with a typed href.
 */
export type HomeDestinationCardData =
  | {
      readonly key: string;
      readonly label: string;
      readonly variant: 'city';
      readonly citySlug: string;
      readonly hint: string;
    }
  | {
      readonly key: string;
      readonly label: string;
      readonly variant: 'country';
      readonly href: CountryGuideHref;
    };

interface HomeDestinationGridProps {
  readonly locale: string;
  readonly destinations: readonly HomeDestinationCardData[];
}

/**
 * Featured destinations grid on the home page. Mixes French city hubs
 * (canonical `/destination/[slug]` with published hotel counts) with
 * intl country guide teasers (`/guide/<country>`) so the global scope
 * promised by the new tagline (« La sélection du Concierge — hôtels
 * d'exception dans 91 pays », ADR-0021) is visible above the fold of
 * the destinations strip — not buried in the footer.
 *
 * Renders nothing when no published cities are available (avoids an
 * orphan section in degraded environments).
 *
 * Server Component — only ships markup, no client JS.
 */
export async function HomeDestinationGrid({
  locale,
  destinations,
}: HomeDestinationGridProps): Promise<React.ReactElement | null> {
  if (destinations.length === 0) return null;
  if (!isRoutingLocale(locale)) return null;
  const typedLocale: Locale = locale;
  const t = await getTranslations({ locale: typedLocale, namespace: 'homepage' });

  return (
    <section
      aria-labelledby="home-featured-destinations"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">
            {t('featuredDestinations.eyebrow')}
          </p>
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

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {destinations.map((d) => {
          if (d.variant === 'city') {
            return (
              <li key={d.key}>
                <Link
                  href={{ pathname: '/destination/[citySlug]', params: { citySlug: d.citySlug } }}
                  className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
                >
                  <p className="text-fg font-serif text-base leading-snug">{d.label}</p>
                  <p className="text-muted mt-1 text-[11px] uppercase tracking-[0.18em]">
                    {d.hint}
                  </p>
                </Link>
              </li>
            );
          }
          return (
            <li key={d.key}>
              <Link
                href={d.href}
                className="border-border bg-bg hover:bg-muted/5 focus-visible:ring-ring block h-full rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <p className="text-fg font-serif text-base leading-snug">{d.label}</p>
                <p className="text-muted mt-1 text-[11px] uppercase tracking-[0.18em]">
                  {t('featuredDestinations.eyebrow')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
