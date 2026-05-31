import type { ReactElement } from 'react';

import { EditorialCallout } from '@/components/editorial/editorial-callout';
import { EditorialGlossary } from '@/components/editorial/editorial-glossary';
import { EditorialTable } from '@/components/editorial/editorial-table';
import { EnrichedText, type EditorialLinkMap } from '@/components/editorial/enriched-text';
import { ExternalSourcesFooter } from '@/components/editorial/external-sources-footer';
import type { GuideRow } from '@/server/guides/get-guide-by-slug';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';

/**
 * Long-read editorial article rendered inside `/destination/[citySlug]`
 * when an `editorial_guides` row exists for the city slug. Mirrors the
 * production-grade rendering pattern of `/classement/[slug]` (skill
 * `editorial-long-read-rendering`):
 *
 *  1. Auto-linked sections (`<EnrichedText>` with brand/hotel/city
 *     dictionary) interleaved with the first 3 callouts.
 *  2. Comparison tables.
 *  3. Glossary (sorted alphabetically with locale-aware collation).
 *  4. Trailing callouts (rare overflow).
 *  5. EEAT external sources footer.
 *
 * The component does NOT render:
 *  - The page breadcrumb / hero — owned by the destination page.
 *  - The sticky TOC sidebar — also page-level so it can sit in the
 *    right column of the 2-col grid.
 *  - The Article JSON-LD or canonical FAQ — both live at page level
 *    so we keep a single `FAQPage` per page (ADR-0011 C1).
 *
 * Sections drop their `<h2>` into a `<section id={anchor}>` so the
 * `<TocSidebar>` `IntersectionObserver` can highlight the active
 * heading as the reader scrolls.
 *
 * Skill: editorial-long-read-rendering, seo-technical §internal-linking,
 * accessibility (semantic `<article>`, scoped headings).
 */
interface Props {
  readonly guide: GuideRow;
  readonly locale: Locale;
  readonly linkMap: EditorialLinkMap;
}

export async function CityGuideArticle({
  guide,
  locale,
  linkMap,
}: Props): Promise<ReactElement | null> {
  const sections = guide.sections;
  // Cap inlined callouts at 3 (matches the ranking page convention) so
  // the editorial pace stays readable. Any extra callout sinks into a
  // trailing block at the end of the article.
  const inlineCallouts = guide.editorial_callouts.slice(
    0,
    Math.min(3, guide.editorial_callouts.length),
  );

  const guideHeading = pickByLocale(
    locale,
    `Guide du Concierge — ${guide.name_fr}`,
    `Concierge guide — ${guide.name_en ?? guide.name_fr}`,
  );
  const guideEyebrow = pickByLocale(locale, 'Guide éditorial', 'Editorial guide');
  const tablesHeading = pickByLocale(locale, 'Tableaux comparatifs', 'Comparison tables');

  return (
    <article
      id="city-guide-article"
      aria-labelledby="city-guide-heading"
      className="border-border mt-14 border-t pt-10"
    >
      <header className="mb-8">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{guideEyebrow}</p>
        <h2 id="city-guide-heading" className="text-fg font-serif text-2xl md:text-3xl">
          {guideHeading}
        </h2>
      </header>

      {sections.length > 0 ? (
        <div className="space-y-12">
          {sections.map((section, idx) => {
            const anchor = section.key.length > 0 ? section.key : `section-${idx}`;
            const sectionTitle = pickByLocale(
              locale,
              section.title_fr,
              section.title_en.length > 0 ? section.title_en : section.title_fr,
            );
            const body = pickByLocale(
              locale,
              section.body_fr,
              section.body_en.length > 0 ? section.body_en : section.body_fr,
            );
            const callout = inlineCallouts[idx] ?? null;
            return (
              <section key={anchor} id={anchor} className="scroll-mt-24">
                <h3 className="text-fg mb-4 font-serif text-xl md:text-2xl">{sectionTitle}</h3>
                <EnrichedText body={body} locale={locale} linkMap={linkMap} />
                {callout !== null ? <EditorialCallout callout={callout} locale={locale} /> : null}
              </section>
            );
          })}
        </div>
      ) : null}

      {guide.tables.length > 0 ? (
        <section id="tableaux" className="mt-14 scroll-mt-24">
          <h3 className="text-fg mb-2 font-serif text-xl md:text-2xl">{tablesHeading}</h3>
          {guide.tables.map((tab) => (
            <EditorialTable key={tab.key} table={tab} locale={locale} />
          ))}
        </section>
      ) : null}

      <EditorialGlossary glossary={guide.glossary} locale={locale} />

      {guide.editorial_callouts.length > inlineCallouts.length ? (
        <section className="my-10 space-y-4">
          {guide.editorial_callouts.slice(inlineCallouts.length).map((c, i) => (
            <EditorialCallout key={`cb-${i}`} callout={c} locale={locale} />
          ))}
        </section>
      ) : null}

      <ExternalSourcesFooter sources={guide.external_sources} locale={locale} />
    </article>
  );
}
