import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { RegionHubContent } from '@/server/destinations/region-hubs';

/**
 * `RegionHubFallback` — editorial-rich empty state for the 4 hero
 * regions on `/classements/lieu/<slug>` whose ranking catalogue is
 * still empty (`champagne`, `provence`, `bordeaux`, `pays-basque`).
 *
 * Audit 2026-05-25: the menu hero region links land on the taxonomy
 * page which detected zero rankings and rendered two generic CTAs —
 * leaving on the table the editorial guides + itineraries we
 * already publish for these regions. This Server Component surfaces
 * those instead.
 *
 * Rendered ABOVE the generic empty state (the generic CTAs stay
 * accessible at the bottom for visitors interested in the broader
 * `/classements` catalogue).
 *
 * No JSON-LD: the parent route already emits `BreadcrumbList`. We
 * intentionally omit a `CollectionPage` ItemList here because the
 * surface mixes two content types (guides + itineraries) — a
 * polluted ItemList would dilute the structured-data signal more
 * than it would help.
 */
export async function RegionHubFallback({
  locale,
  content,
}: {
  readonly locale: Locale;
  readonly content: RegionHubContent;
}): Promise<ReactElement> {
  const t = await getTranslations('regionHubFallback');
  const hasGuides = content.guides.length > 0;
  const hasItineraries = content.itineraries.length > 0;

  if (!hasGuides && !hasItineraries) {
    // Region declared in REGION_HUB_DEFS but neither guide nor
    // itinerary is published yet — fall back to nothing so the
    // generic empty state stays the visible surface.
    return <></>;
  }

  return (
    <section
      aria-labelledby="region-hub-fallback-title"
      className="border-border bg-muted/5 mb-10 rounded-lg border p-6 md:p-8"
    >
      <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">
        {t('eyebrow', { region: content.label })}
      </p>
      <h2 id="region-hub-fallback-title" className="text-fg font-serif text-2xl sm:text-3xl">
        {t('title', { region: content.label })}
      </h2>
      <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{content.intro}</p>

      {hasGuides ? (
        <div className="mt-8">
          <h3 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
            {t('guidesHeading')}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {content.guides.map((g) => (
              <li key={g.slug}>
                <Link
                  href={{ pathname: '/guide/[citySlug]', params: { citySlug: g.slug } }}
                  className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
                >
                  <h4 className="text-fg font-serif text-base">{g.name}</h4>
                  <p className="text-muted mt-2 line-clamp-3 text-xs">{g.summary}</p>
                  <span className="text-fg mt-3 inline-block text-xs font-medium underline-offset-4">
                    {t('cta.guide')} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasItineraries ? (
        <div className="mt-8">
          <h3 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
            {t('itinerariesHeading')}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {content.itineraries.map((it) => {
              const duration =
                it.durationMaxDays !== null && it.durationMaxDays !== it.durationMinDays
                  ? pickByLocale(
                      locale,
                      `${it.durationMinDays}-${it.durationMaxDays} jours`,
                      `${it.durationMinDays}-${it.durationMaxDays} days`,
                    )
                  : pickByLocale(
                      locale,
                      `${it.durationMinDays} jours`,
                      `${it.durationMinDays} days`,
                    );
              return (
                <li key={it.slug}>
                  <Link
                    href={{ pathname: '/itineraire/[slug]', params: { slug: it.slug } }}
                    className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
                  >
                    <p className="text-muted text-xs uppercase tracking-wide">
                      {duration}
                      {it.destinationCity !== null ? ` · ${it.destinationCity}` : ''}
                    </p>
                    <h4 className="text-fg mt-1 font-serif text-base">{it.title}</h4>
                    {it.metaDesc !== null ? (
                      <p className="text-muted mt-2 line-clamp-2 text-xs">{it.metaDesc}</p>
                    ) : null}
                    <span className="text-fg mt-3 inline-block text-xs font-medium underline-offset-4">
                      {t('cta.itinerary')} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
