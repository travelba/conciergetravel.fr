import { getTranslations } from 'next-intl/server';

import type { LocalisedFaq } from '@/server/hotels/get-hotel-by-slug';

interface TopConciergeFaqProps {
  readonly locale: 'fr' | 'en';
  readonly items: readonly LocalisedFaq[];
}

/**
 * "Top 5 réponses du Concierge" — a curated, **always-open** Concierge
 * voice block rendered above the full `<HotelFaq>` section.
 *
 * Rationale (ADR-0011 C1, WS5 phase 4)
 * -------------------------------------
 * - The full FAQ is a `<details>` list (10-15 entries, intent-grouped)
 *   designed for human scanning + AEO `FAQPage` JSON-LD coverage.
 * - The Top 5 block addresses a different goal: it is the "first-answer
 *   surface" for both humans (scrollability above the fold of the FAQ
 *   anchor) and LLMs (the 5 most quotable, actionable answers — always
 *   expanded so they are in the DOM at load).
 * - It does NOT emit JSON-LD. The flat `<HotelFaq>` already feeds
 *   `FAQPage`. Duplicating the 5 here would risk Google flagging
 *   duplicate `Question` entities.
 *
 * Render policy
 * -------------
 * - Self-elides when fewer than 5 items are marked `featured: true`.
 *   That keeps the component honest: if the humanizer hasn't picked 5,
 *   we never show a half-baked Top 4.
 * - All items are rendered inline (no `<details>`), so the answers are
 *   visible without interaction (GEO win).
 * - Concierge tips (when present) are surfaced under each answer in a
 *   sober italic block — matches the visual treatment used by
 *   `<ConciergeAdvice>` so the brand voice stays consistent.
 *
 * Skill: geo-llm-optimization (AEO Top-5 visible),
 *        concierge-voice-pipeline (UI surface for the FAQ humanizer).
 */
export async function TopConciergeFaq({
  locale,
  items,
}: TopConciergeFaqProps): Promise<React.ReactElement | null> {
  if (items.length < 5) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage.topConciergeFaq' });
  const top5 = items.slice(0, 5);

  return (
    <section
      id="faq-top-concierge"
      aria-labelledby="faq-top-concierge-title"
      className="bg-surface-2 mb-12 scroll-mt-24 rounded-2xl px-6 py-8 sm:px-8"
      data-aeo="top-concierge-faq"
    >
      <header className="flex flex-col gap-2">
        <h2 id="faq-top-concierge-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('title')}
        </h2>
        <p className="text-muted max-w-prose text-sm leading-relaxed">{t('lead')}</p>
      </header>

      <ol className="mt-6 flex flex-col gap-6" data-top-concierge-list>
        {top5.map((item, i) => (
          <li
            key={`${item.category}-${i}`}
            className="border-border/60 border-l-2 pl-4"
            data-top-concierge-item={String(i + 1)}
          >
            <h3 className="text-fg text-base font-semibold leading-snug">{item.question}</h3>
            <p className="text-fg/90 mt-2 max-w-prose text-sm leading-relaxed">{item.answer}</p>
            {item.conciergeTip !== null ? (
              <p
                data-concierge-tip="faq"
                className="border-accent/30 bg-bg text-fg/90 mt-3 max-w-prose rounded-md border-l-2 px-3 py-2 text-xs italic leading-snug"
              >
                <span className="text-fg/80 font-semibold not-italic">{t('tipPrefix')} : </span>
                {item.conciergeTip}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
