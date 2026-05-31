import type { ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';

import { intlLocaleTag } from '@/i18n/runtime';
import type { SupportedLocale } from '@/i18n/supported-locale';
import type {
  HotelExternalSourceReference,
  HotelExternalSourceReferenceKind,
  HotelExternalSourcesProvenance,
} from '@/server/hotels/get-hotel-by-slug';

interface HotelExternalSourcesFooterProps {
  readonly locale: SupportedLocale;
  readonly provenance: HotelExternalSourcesProvenance | null;
}

/**
 * `<HotelExternalSourcesFooter>` — CDC §2 bloc 13bis (EEAT provenance).
 *
 * Renders the structured `external_sources` JSONB column hydrated by
 * the Phase 1.5 backfill
 * (`scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts`,
 * see `AGENTS.md` §"Phase 5 mini-sweep"). Two complementary blocks:
 *
 *   1. **Faits vérifiés** — derived facts (opening year, architects,
 *      heritage designations) attributed to Wikidata. High-trust
 *      because the Q-page link is one click away.
 *   2. **Références externes** — canonical URLs of the encyclopaedias
 *      and registries the fiche pulls from (Wikidata, Wikipedia FR/EN,
 *      Wikimedia Commons, official site, TripAdvisor, Booking.com).
 *
 * Mirrors `<ExternalSourcesFooter>` (editorial guides + rankings) but
 * with a different shape: hotel provenance is **per-fact** (`{field,
 * value, source, source_url}`) while the editorial shape is
 * **per-citation** (`{url, label_fr, label_en, type}`). See
 * `apps/web/src/server/hotels/get-hotel-external-sources.ts` §"Why
 * the shape diverges" for the architectural note.
 *
 * EEAT trust signal — both for Google E-A-T scoring and for LLM
 * crawlers (ChatGPT, Perplexity, Claude) that cite the page back to
 * its sources. The block self-elides when `provenance === null`, so
 * fiches without backfilled provenance (~38 % of catalogue at Phase
 * 1.5 close, dropping over time) render nothing instead of an empty
 * shell.
 *
 * Rendering rules:
 *   - text only, no third-party logos (mirrors `<HotelTrustSignals>`).
 *   - external links are `rel="nofollow noopener"` (no PageRank leak,
 *     no `window.opener` exposure).
 *   - sober — sits in the EEAT cluster between `<HotelTrustSignals>`
 *     and `<HotelReassurance>`.
 *   - locale-aware date formatting via `intlLocaleTag`.
 *
 * Pure RSC, no client JS. WCAG 2.2 AA: `<section aria-labelledby>` +
 * `<dl>` semantics for the facts, `<ul>` for the link list, all text
 * content stays tabbable.
 *
 * Skills: seo-technical §EEAT, geo-llm-optimization §provenance.
 */
export async function HotelExternalSourcesFooter({
  locale,
  provenance,
}: HotelExternalSourcesFooterProps): Promise<ReactElement | null> {
  if (provenance === null) return null;
  const { references, facts, collectedAt } = provenance;
  const t = await getTranslations({ locale, namespace: 'hotelPage.sources' });

  const hasFacts =
    facts.inceptionYear !== null ||
    facts.architects.length > 0 ||
    facts.heritageDesignations.length > 0;
  const hasReferences = references.length > 0;
  if (!hasFacts && !hasReferences) return null;

  const collectedLabel =
    collectedAt !== null
      ? new Intl.DateTimeFormat(intlLocaleTag(locale), { dateStyle: 'long' }).format(
          new Date(collectedAt),
        )
      : null;

  return (
    <section aria-labelledby="external-sources-title" className="mb-12">
      <h2 id="external-sources-title" className="text-fg mb-4 font-serif text-2xl">
        {t('heading')}
      </h2>

      <div className="border-border bg-bg rounded-lg border p-4 sm:p-5">
        <p className="text-muted mb-5 max-w-prose text-sm leading-relaxed">{t('intro')}</p>

        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          {hasFacts ? <FactsBlock locale={locale} facts={facts} /> : null}
          {hasReferences ? <ReferencesBlock references={references} /> : null}
        </div>

        {collectedLabel !== null ? (
          <p className="text-muted mt-5 text-xs">{t('lastCollected', { date: collectedLabel })}</p>
        ) : null}
      </div>
    </section>
  );
}

async function FactsBlock({
  locale,
  facts,
}: {
  locale: SupportedLocale;
  facts: HotelExternalSourcesProvenance['facts'];
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: 'hotelPage.sources.facts' });
  return (
    <div>
      <h3 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
        {t('heading')}
      </h3>
      <dl className="flex flex-col gap-2.5 text-sm">
        {facts.inceptionYear !== null ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="text-muted shrink-0 sm:w-44">{t('inceptionYear')}</dt>
            <dd className="text-fg">
              {facts.inceptionYear}{' '}
              <span className="text-muted text-xs">{t('attribution.wikidata')}</span>
            </dd>
          </div>
        ) : null}
        {facts.architects.length > 0 ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="text-muted shrink-0 sm:w-44">
              {t('architects', { count: facts.architects.length })}
            </dt>
            <dd className="text-fg">
              {facts.architects.join(', ')}{' '}
              <span className="text-muted text-xs">{t('attribution.wikidata')}</span>
            </dd>
          </div>
        ) : null}
        {facts.heritageDesignations.length > 0 ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="text-muted shrink-0 sm:w-44">{t('heritageDesignations')}</dt>
            <dd className="text-fg">
              {facts.heritageDesignations.join(', ')}{' '}
              <span className="text-muted text-xs">{t('attribution.wikidata')}</span>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

const REF_LABEL_KEY: Readonly<Record<HotelExternalSourceReferenceKind, string>> = {
  wikidata: 'wikidata',
  wikipedia_fr: 'wikipediaFr',
  wikipedia_en: 'wikipediaEn',
  commons: 'commons',
  official: 'official',
  tripadvisor: 'tripadvisor',
  booking_com: 'bookingCom',
};

async function ReferencesBlock({
  references,
}: {
  references: readonly HotelExternalSourceReference[];
}): Promise<ReactElement> {
  const t = await getTranslations('hotelPage.sources.references');
  return (
    <div>
      <h3 className="text-muted mb-3 text-xs font-medium uppercase tracking-wider">
        {t('heading')}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {references.map((ref) => {
          const label = t(REF_LABEL_KEY[ref.kind]);
          return (
            <li key={ref.kind} className="flex items-baseline gap-2">
              <span aria-hidden className="text-muted">
                →
              </span>
              <a
                href={ref.url}
                rel="nofollow noopener"
                target="_blank"
                className="text-fg break-words underline-offset-2 hover:underline"
              >
                {label}
                {ref.identifier !== null ? (
                  <span className="text-muted ml-1 font-mono text-xs">({ref.identifier})</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
