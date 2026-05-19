import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { intlLocaleTag } from '@/i18n/runtime';
import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';

/**
 * Domain-glossary block — renders the JSONB `glossary` column as a
 * `<dl>` definition list (HTML semantic + accessibility friendly).
 *
 * Skill: accessibility, structured-data-schema-org (glossary maps
 * naturally to DefinedTerm schema, emitted alongside).
 */

export interface GlossaryEntryData {
  readonly term_fr: string;
  readonly term_en?: string;
  readonly definition_fr: string;
  readonly definition_en?: string;
}

interface Props {
  readonly glossary: readonly GlossaryEntryData[];
  readonly locale: SupportedLocale;
}

export async function EditorialGlossary({ glossary, locale }: Props): Promise<ReactElement | null> {
  if (glossary.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'editorial' });
  const heading = t('glossaryHeading');

  // Sort alphabetically for predictable, scan-friendly output. The
  // BCP-47 tag drives native collation (FR → "École" before "Eau",
  // DE/ES/IT inherit the FR fallback content per V2 policy).
  const sortKey = (g: GlossaryEntryData): string =>
    pickLocalizedText(locale, g.term_fr, g.term_en) ?? g.term_fr;
  const collation = intlLocaleTag(locale);
  const sorted = [...glossary].sort((a, b) => sortKey(a).localeCompare(sortKey(b), collation));

  return (
    <section id="glossaire" aria-labelledby="glossary-heading" className="my-10">
      <h2 id="glossary-heading" className="text-fg mb-4 font-serif text-2xl font-light">
        {heading}
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {sorted.map((g) => (
          <div key={g.term_fr} className="border-border bg-bg/30 rounded-lg border p-4">
            <dt className="text-fg mb-1 font-medium">
              {pickLocalizedText(locale, g.term_fr, g.term_en) ?? g.term_fr}
            </dt>
            <dd className="text-fg/80 text-sm leading-relaxed">
              {pickLocalizedText(locale, g.definition_fr, g.definition_en) ?? g.definition_fr}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
