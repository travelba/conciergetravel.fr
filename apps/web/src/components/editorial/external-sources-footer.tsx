import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { intlLocaleTag } from '@/i18n/runtime';
import { pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';

/**
 * "Sources & références" block, rendered at the bottom of a guide
 * or ranking. Reflects the JSONB `external_sources` column, where
 * the editorial pipeline has already filtered every URL against the
 * allowlist (Wikipedia, Atout France, UNESCO, Michelin, official
 * domains, regional tourist offices, press of reference).
 *
 * EEAT trust signal — both for search engines (Google citations,
 * E-A-T evaluation) and for LLM crawlers (ChatGPT/Perplexity citing
 * the page back to its sources).
 *
 * Skill: seo-technical §EEAT, geo-llm-optimization.
 */

export type ExternalSourceType =
  | 'wikipedia'
  | 'official'
  | 'unesco'
  | 'michelin'
  | 'atout_france'
  | 'tourist_office'
  | 'wikidata'
  | 'press'
  | 'wikimedia_commons'
  | 'gov'
  | 'other';

const KNOWN_TYPES: readonly ExternalSourceType[] = [
  'wikipedia',
  'official',
  'unesco',
  'michelin',
  'atout_france',
  'tourist_office',
  'wikidata',
  'press',
  'wikimedia_commons',
  'gov',
  'other',
];

function normalizeType(value: string): ExternalSourceType {
  return (KNOWN_TYPES as readonly string[]).includes(value)
    ? (value as ExternalSourceType)
    : 'other';
}

export interface ExternalSourceData {
  readonly url: string;
  readonly label_fr: string;
  readonly label_en?: string;
  /** Free-form so we can absorb LLM-generated synonyms. */
  readonly type: string;
}

interface Props {
  readonly sources: readonly ExternalSourceData[];
  readonly locale: SupportedLocale;
}

/**
 * Maps each source type to its `editorial.sources.groups.*` message
 * key. Centralised so adding a type is a two-line change. Multiple
 * types can intentionally collapse into the same group (e.g.
 * `wikipedia` / `wikidata` / `wikimedia_commons` → "Encyclopédies").
 */
const TYPE_GROUP_KEY: Readonly<Record<ExternalSourceType, string>> = {
  wikipedia: 'encyclopaedias',
  wikidata: 'encyclopaedias',
  wikimedia_commons: 'encyclopaedias',
  official: 'official',
  atout_france: 'atoutFrance',
  gov: 'government',
  tourist_office: 'touristOffice',
  unesco: 'unesco',
  michelin: 'michelin',
  press: 'press',
  other: 'other',
};

export async function ExternalSourcesFooter({
  sources,
  locale,
}: Props): Promise<ReactElement | null> {
  if (sources.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'editorial.sources' });

  const groups = new Map<string, ExternalSourceData[]>();
  for (const s of sources) {
    const label = t(`groups.${TYPE_GROUP_KEY[normalizeType(s.type)]}`);
    const arr = groups.get(label) ?? [];
    arr.push(s);
    groups.set(label, arr);
  }

  // Deterministic ordering for stable output — sort group headings
  // by the current locale's native collation.
  const collation = intlLocaleTag(locale);
  const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b, collation),
  );

  return (
    <section
      id="sources"
      aria-labelledby="sources-heading"
      className="border-border bg-bg/40 mt-12 rounded-lg border p-6"
    >
      <h2 id="sources-heading" className="text-fg mb-2 font-serif text-2xl font-light">
        {t('heading')}
      </h2>
      <p className="text-fg/70 mb-5 text-sm">{t('intro')}</p>
      <div className="space-y-5">
        {orderedGroups.map(([groupLabel, items]) => (
          <div key={groupLabel}>
            <h3 className="text-fg/80 mb-2 text-sm font-medium uppercase tracking-wide">
              {groupLabel}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {items.map((s) => {
                const label = pickLocalizedText(locale, s.label_fr, s.label_en) ?? s.label_fr;
                return (
                  <li key={s.url} className="flex items-baseline gap-2">
                    <span className="text-fg/40">→</span>
                    <a
                      href={s.url}
                      rel="noopener nofollow"
                      target="_blank"
                      className="text-fg/90 break-words underline-offset-2 hover:underline"
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
