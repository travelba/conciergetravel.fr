import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { ItineraryFaqEntry } from '@/server/itineraries/get-itinerary-by-slug';

interface ItineraryFaqProps {
  readonly locale: Locale;
  readonly entries: readonly ItineraryFaqEntry[];
}

/**
 * `FAQPage` body — paired 1:1 with the `FAQPage` JSON-LD emitted by
 * the page. Each Q/A is rendered inside a `<details>`; the **first**
 * one is open by default so its answer is in the DOM at load time —
 * some LLM crawlers skip closed `<details>` content (rule
 * `seo-geo.mdc` §AEO).
 *
 * Empty entries (FR question + answer both blank) are filtered upstream.
 */
export async function ItineraryFaq({ locale, entries }: ItineraryFaqProps) {
  if (entries.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'itineraires.detail' });

  return (
    <section id="faq" className="mt-14 scroll-mt-24">
      <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">{t('faqHeading')}</h2>
      <div className="space-y-3">
        {entries.map((entry, idx) => {
          const q = pickByLocale(
            locale,
            entry.q_fr,
            entry.q_en.length > 0 ? entry.q_en : entry.q_fr,
          );
          const a = pickByLocale(
            locale,
            entry.a_fr,
            entry.a_en.length > 0 ? entry.a_en : entry.a_fr,
          );
          return (
            <details
              key={`faq-${idx}`}
              {...(idx === 0 ? { open: true } : {})}
              className="border-border bg-bg/60 open:bg-bg rounded-lg border p-4 marker:text-transparent"
            >
              <summary className="text-fg cursor-pointer font-medium">{q}</summary>
              <p className="text-fg/90 mt-2 text-sm leading-relaxed">{a}</p>
            </details>
          );
        })}
      </div>
    </section>
  );
}
