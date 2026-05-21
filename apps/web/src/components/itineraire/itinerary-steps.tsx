import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { ItinerarySection } from '@/server/itineraries/get-itinerary-by-slug';
import type { HotelLookup } from '@/server/itineraries/get-related-data';

interface ItineraryStepsProps {
  readonly locale: Locale;
  readonly sections: readonly ItinerarySection[];
  readonly hotels: readonly HotelLookup[];
}

/**
 * Step-by-step itinerary block — pairs each section row from
 * `itineraries.sections[]` (CDC §4.2) with the matching hotel lookup
 * so the page renders a clear `Day n → Hotel → POIs` triplet.
 *
 * Hotel link uses the locale-aware FR slug (ADR-0008 — slugs identical
 * FR/EN; we always link `/hotel/<slug>` with `<slug>` from
 * `hotels.slug` which is the canonical FR slug).
 *
 * Rule: itinerary-page.mdc §3.3 (`<ItinerarySteps>` RSC).
 */
export async function ItinerarySteps({ locale, sections, hotels }: ItineraryStepsProps) {
  const t = await getTranslations({ locale, namespace: 'itineraires.detail' });
  const hotelById = new Map<string, HotelLookup>(hotels.map((h) => [h.id, h]));

  return (
    <section id="steps" className="mt-12 scroll-mt-24">
      <h2 className="text-fg mb-3 font-serif text-2xl md:text-3xl">{t('stepsHeading')}</h2>
      <p className="text-muted mb-8 max-w-2xl text-sm md:text-base">{t('stepsLead')}</p>

      <ol className="space-y-8">
        {sections.map((section, idx) => {
          const stepNumber = section.step > 0 ? section.step : idx + 1;
          const stepLabel = t('stepLabel', { n: stepNumber });
          const title = pickByLocale(
            locale,
            section.title_fr,
            section.title_en || section.title_fr,
          );
          const body = pickByLocale(locale, section.body_fr, section.body_en || section.body_fr);
          const hotel =
            section.hotel_id !== null && section.hotel_id !== undefined
              ? (hotelById.get(section.hotel_id) ?? null)
              : null;
          const stayDuration =
            section.duration_days !== undefined && section.duration_days > 0
              ? t('stayDuration', { n: section.duration_days })
              : null;

          return (
            <li
              key={`step-${stepNumber}`}
              id={`step-${stepNumber}`}
              className="border-border bg-bg/60 scroll-mt-24 rounded-lg border p-6"
            >
              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-fg font-serif text-2xl font-light">{stepLabel}</span>
                <h3 className="text-fg font-medium md:text-lg">{title}</h3>
              </div>

              <ul className="text-muted mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-wide">
                {section.city.length > 0 ? <li>{section.city}</li> : null}
                {section.city.length > 0 && stayDuration !== null ? <li aria-hidden>·</li> : null}
                {stayDuration !== null ? <li>{stayDuration}</li> : null}
              </ul>

              <p className="text-fg/90 mb-4 max-w-prose text-sm leading-relaxed md:text-base">
                {body}
              </p>

              {hotel !== null ? (
                <p className="mb-3">
                  <Link
                    href={{ pathname: '/hotel/[slug]', params: { slug: hotel.slug } }}
                    className="text-fg/90 inline-flex items-center gap-1 text-sm font-medium underline hover:no-underline"
                  >
                    {pickByLocale(locale, hotel.nameFr, hotel.nameEn ?? hotel.nameFr)} →
                  </Link>
                </p>
              ) : null}

              {section.poi.length > 0 ? (
                <div className="mt-4">
                  <p className="text-fg/70 mb-2 text-xs font-medium uppercase tracking-wide">
                    {t('poiHeading')}
                  </p>
                  <ul className="text-muted flex flex-wrap gap-2 text-xs">
                    {section.poi.map((poi, poiIdx) => (
                      <li
                        key={`poi-${stepNumber}-${poiIdx}`}
                        className="border-border bg-bg/40 rounded-full border px-3 py-1"
                      >
                        {poi}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
