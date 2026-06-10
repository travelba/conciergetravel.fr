import { getTranslations } from 'next-intl/server';

import type { SupportedLocale } from '@/i18n/supported-locale';
import type { LocalisedConciergeQuestionGroup } from '@/server/hotels/get-hotel-by-slug';

interface HotelConciergeQuestionsProps {
  readonly locale: SupportedLocale;
  readonly hotelName: string;
  readonly groups: readonly LocalisedConciergeQuestionGroup[];
}

/**
 * Concierge-voice Q&A block (Perplexity `concierge_questions` jsonb).
 * Skill: hotel-faq-perplexity-enrichment — mandatory on every hotel fiche.
 */
export async function HotelConciergeQuestions({
  locale,
  hotelName,
  groups,
}: HotelConciergeQuestionsProps): Promise<React.ReactElement | null> {
  if (groups.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'hotelPage' });

  return (
    <section
      id="concierge-questions"
      aria-labelledby="concierge-questions-title"
      className="mb-12 scroll-mt-24"
    >
      <h2 id="concierge-questions-title" className="text-fg mb-2 font-serif text-2xl">
        {t('conciergeQuestions.title', { hotel: hotelName })}
      </h2>
      <p className="text-muted mb-6 text-sm">{t('conciergeQuestions.lede')}</p>

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`cq-${slugify(group.label)}`}>
            <h3
              id={`cq-${slugify(group.label)}`}
              className="text-fg mb-3 scroll-mt-24 font-serif text-lg uppercase tracking-[0.16em]"
            >
              {group.label}
            </h3>
            <ul className="divide-border flex flex-col divide-y">
              {group.items.map((item, i) => (
                <li key={i} className="py-4">
                  <p className="text-fg font-medium">{item.question}</p>
                  <p className="text-muted mt-2 text-sm italic">{item.reply}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
