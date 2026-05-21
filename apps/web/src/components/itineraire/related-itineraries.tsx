import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { ItineraryMiniCard } from '@/server/itineraries/get-related-data';

interface RelatedItinerariesProps {
  readonly locale: Locale;
  readonly itineraries: readonly ItineraryMiniCard[];
}

/**
 * Sibling itineraries — ≥ 2 expected per the rule, but we render
 * whatever the editor curated up to a soft 4-card cap (the data
 * layer caps at 6).
 */
export async function RelatedItineraries({ locale, itineraries }: RelatedItinerariesProps) {
  if (itineraries.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'itineraires.detail' });

  return (
    <section id="related-itineraries" className="mt-14 scroll-mt-24">
      <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">
        {t('relatedItinerariesHeading')}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {itineraries.slice(0, 4).map((it) => {
          const title = pickByLocale(locale, it.titleFr, it.titleEn ?? it.titleFr);
          const destination = it.destinationCity ?? it.destinationRegion ?? it.countryCode;
          const duration =
            it.durationMaxDays !== null && it.durationMaxDays !== it.durationMinDays
              ? `${it.durationMinDays}–${it.durationMaxDays} j`
              : `${it.durationMinDays} j`;
          return (
            <li key={it.slugFr}>
              <Link
                href={{ pathname: '/itineraire/[slug]', params: { slug: it.slugFr } }}
                className="border-border bg-bg group flex flex-col gap-2 rounded-md border p-4 hover:border-amber-400"
              >
                <p className="text-muted text-xs uppercase tracking-[0.16em]">
                  {destination} · {duration}
                </p>
                <span className="text-fg text-sm font-medium">{title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
