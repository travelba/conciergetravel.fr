import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { ItineraryMiniCard } from '@/server/itineraries/get-related-data';

/**
 * Generic Server-rendered cross-link block listing published
 * itineraries. Used by:
 *   - `/destination/[citySlug]` to surface itineraries that include
 *     this city as a stop.
 *   - `/classement/[slug]` to surface itineraries on the same lieu.
 *
 * The itinerary detail page keeps its own `<RelatedItineraries>`
 * because it ships sibling-itinerary data via the existing
 * `related_itinerary_slugs[]` column (always populated). This list
 * targets the *cross-axis* mesh (city → itinerary, ranking → itinerary)
 * which had no UI surface before P2C.
 *
 * No JSON-LD: this is a navigational mesh, not structured content.
 * BreadcrumbList stays the canonical structured data for the parent.
 */
export function RelatedItinerariesList({
  locale,
  heading,
  intro,
  itineraries,
  cta,
  className,
}: {
  readonly locale: Locale;
  readonly heading: string;
  readonly intro?: string;
  readonly itineraries: readonly ItineraryMiniCard[];
  readonly cta: string;
  readonly className?: string;
}): ReactElement | null {
  if (itineraries.length === 0) return null;
  return (
    <section
      aria-labelledby="related-itineraries-list-title"
      className={`border-border bg-muted/5 rounded-lg border p-6 md:p-8 ${className ?? ''}`}
    >
      <h2 id="related-itineraries-list-title" className="text-fg font-serif text-2xl sm:text-3xl">
        {heading}
      </h2>
      {intro !== undefined && intro.length > 0 ? (
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{intro}</p>
      ) : null}
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {itineraries.map((it) => {
          const title = pickByLocale(locale, it.titleFr, it.titleEn ?? it.titleFr);
          const duration =
            it.durationMaxDays !== null && it.durationMaxDays !== it.durationMinDays
              ? pickByLocale(
                  locale,
                  `${it.durationMinDays}-${it.durationMaxDays} jours`,
                  `${it.durationMinDays}-${it.durationMaxDays} days`,
                )
              : pickByLocale(locale, `${it.durationMinDays} jours`, `${it.durationMinDays} days`);
          return (
            <li key={it.slugFr}>
              <Link
                href={{ pathname: '/itineraire/[slug]', params: { slug: it.slugFr } }}
                className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
              >
                <p className="text-muted text-xs uppercase tracking-wide">
                  {duration}
                  {it.destinationCity !== null && it.destinationCity.length > 0
                    ? ` · ${it.destinationCity}`
                    : ''}
                </p>
                <h3 className="text-fg mt-1 font-serif text-base">{title}</h3>
                <span className="text-fg mt-3 inline-block text-xs font-medium underline-offset-4">
                  {cta} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
