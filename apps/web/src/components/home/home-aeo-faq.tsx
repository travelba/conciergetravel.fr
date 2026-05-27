import 'server-only';

import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

/**
 * `<HomeAeoFaq>` — 4 Q&A AEO block on the home page.
 *
 * The same source of truth (`loadHomeAeoEntries`) backs both:
 * - this visible block (rendered as `<details>` elements);
 * - the `FAQPage` JSON-LD payload emitted by `page.tsx`.
 *
 * DOM ↔ JSON-LD parity is mandatory per Google's FAQPage policy. The
 * first `<details>` opens by default so the answer is in the DOM at
 * load — some LLM crawlers skip closed `<details>` content.
 *
 * Pure RSC.
 */

export interface HomeAeoEntry {
  readonly key: 'q1' | 'q2' | 'q3' | 'q4';
  readonly question: string;
  readonly answer: string;
}

export async function loadHomeAeoEntries(locale: Locale): Promise<readonly HomeAeoEntry[]> {
  const t = await getTranslations({ locale, namespace: 'homepage.aeo' });
  return [
    { key: 'q1', question: t('q1.question'), answer: t('q1.answer') },
    { key: 'q2', question: t('q2.question'), answer: t('q2.answer') },
    { key: 'q3', question: t('q3.question'), answer: t('q3.answer') },
    { key: 'q4', question: t('q4.question'), answer: t('q4.answer') },
  ];
}

export async function HomeAeoFaq({
  locale,
  entries,
}: {
  readonly locale: Locale;
  readonly entries?: readonly HomeAeoEntry[];
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'homepage.aeo' });
  const list = entries ?? (await loadHomeAeoEntries(locale));

  return (
    <section
      data-aeo
      aria-labelledby="home-aeo-title"
      className="border-border container mx-auto max-w-screen-xl border-t px-4 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <h2 id="home-aeo-title" className="text-fg font-serif text-3xl sm:text-4xl">
          {t('intro')}
        </h2>
        <ul className="divide-border mt-8 divide-y">
          {list.map((entry, idx) => (
            <li key={entry.key}>
              <details className="group py-5" {...(idx === 0 ? { open: true } : {})}>
                <summary className="text-fg flex cursor-pointer list-none items-start justify-between gap-4 font-serif text-lg sm:text-xl">
                  <span>{entry.question}</span>
                  <span
                    aria-hidden
                    className="text-muted mt-1 shrink-0 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-muted mt-3 text-sm leading-relaxed sm:text-base">
                  {entry.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
