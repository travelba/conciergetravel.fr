import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { CityGuideArticle } from '@/components/destination/city-guide-article';
import type { EditorialLinkMap } from '@/components/editorial/enriched-text';
import { TocSidebar } from '@/components/editorial/toc-sidebar';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { hreflangKey } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import type { GuideRow } from '@/server/guides/get-guide-by-slug';

/**
 * Standalone editorial guide page for `region`, `cluster` and (non
 * hand-built) `country` scopes served under `/destination/<slug>`.
 *
 * Unlike a `city` guide — which is inlined *below* a hotel hub in
 * `destination/[citySlug]/page.tsx` — these scopes have no matching
 * `getDestinationBySlug` row (they aren't a single city), so before this
 * component they 404'd despite carrying 10-12 fully bilingual sections.
 * This renders them as a self-contained long-read: header + AEO factual
 * summary + the shared `<CityGuideArticle>` body + sticky `<TocSidebar>`
 * + the guide's global FAQ, plus `Article` + `Place` + `BreadcrumbList`
 * + `FAQPage` JSON-LD.
 *
 * The page owns the chrome (breadcrumb / H1 / TOC / FAQ / JSON-LD);
 * `<CityGuideArticle>` only renders the section body (single source of
 * truth for the long-read rendering, shared with city guides).
 *
 * Phase 1.5 — surfaces the 21 region/cluster guides previously dark
 * (see AGENTS.md §4bis + ADR-0015). Country scope is wired here too but
 * gated upstream (the 8 hand-built `/guide/<country>` pages stay
 * canonical; FR-only country rows are excluded until their EN pass).
 */
interface Props {
  readonly guide: GuideRow;
  readonly locale: Locale;
  readonly linkMap: EditorialLinkMap;
  readonly pageUrl: string;
  readonly origin: string;
  readonly nonce: string | undefined;
}

export async function StandaloneGuidePage({
  guide,
  locale,
  linkMap,
  pageUrl,
  origin,
  nonce,
}: Props): Promise<ReactElement> {
  const t = await getTranslations('destinationPage');

  const name = pickByLocale(locale, guide.name_fr, guide.name_en ?? guide.name_fr);
  const summary = pickByLocale(locale, guide.summary_fr, guide.summary_en ?? guide.summary_fr);

  const eyebrow = pickByLocale(locale, 'Guide du Concierge', 'Concierge guide');

  // Global FAQ rows (no `section_anchor`) become the page-level FAQ —
  // one `FAQPage` per page (ADR-0011 C1). Section-anchored rows live
  // next to their heading inside the article body.
  const globalFaq = guide.faq
    .filter(
      (f) =>
        (typeof f.section_anchor !== 'string' || f.section_anchor.length === 0) &&
        pickByLocale(locale, f.question_fr, f.question_en).length > 0 &&
        pickByLocale(locale, f.answer_fr, f.answer_en).length > 0,
    )
    .map((f) => ({
      question: pickByLocale(locale, f.question_fr, f.question_en),
      answer: pickByLocale(locale, f.answer_fr, f.answer_en),
    }));

  const latestUpdateIso = guide.updated_at ?? guide.reviewed_at ?? new Date().toISOString();

  // `Place` entity — region/cluster map to AdministrativeArea, country
  // to Country, so LLM crawlers get a stable geographic anchor.
  const placeType = guide.scope === 'country' ? 'Country' : 'AdministrativeArea';
  const placeJsonLd = JsonLd.withSchemaOrgContext({
    '@type': placeType,
    '@id': `${pageUrl}#place`,
    name,
    address: {
      '@type': 'PostalAddress',
      addressCountry: guide.country_code,
    },
  });

  const articleJsonLd = JsonLd.withSchemaOrgContext({
    ...JsonLd.articleJsonLd({
      headline: pickByLocale(
        locale,
        `Guide du Concierge — ${guide.name_fr}`,
        `Concierge guide — ${guide.name_en ?? guide.name_fr}`,
      ),
      url: pageUrl,
      description: summary,
      datePublished: guide.reviewed_at ?? guide.updated_at ?? new Date().toISOString().slice(0, 10),
      dateModified: guide.updated_at ?? guide.reviewed_at ?? new Date().toISOString().slice(0, 10),
      author: {
        name: guide.author_name ?? 'MyConciergeHotel Éditorial',
        ...(guide.author_url !== null ? { url: `${origin}${guide.author_url}` } : {}),
      },
      publisher: { name: 'MyConciergeHotel', logoUrl: `${origin}/logo.png` },
      inLanguage: hreflangKey(locale),
    }),
    '@id': `${pageUrl}#guide-article`,
    isPartOf: { '@id': `${pageUrl}#place` },
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumb.home'), url: `${origin}/` },
      { name: t('breadcrumb.destinations'), url: `${origin}/destination` },
      { name, url: pageUrl },
    ]),
  );

  const faqJsonLd =
    globalFaq.length > 0 ? JsonLd.withSchemaOrgContext(JsonLd.faqPageJsonLd(globalFaq)) : null;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={placeJsonLd} nonce={nonce} />
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {faqJsonLd !== null ? <JsonLdScript data={faqJsonLd} nonce={nonce} /> : null}

      <nav aria-label={t('breadcrumb.destinations')} className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/destination" className="hover:underline">
              {t('breadcrumb.destinations')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-10">
        <div className="min-w-0">
          <header className="mb-10">
            <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{eyebrow}</p>
            <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{name}</h1>
            {summary.length > 0 ? (
              <p
                data-aeo="factual-summary"
                className="text-fg/85 mt-4 max-w-3xl border-l-2 border-amber-300/60 pl-4 text-base sm:text-lg"
              >
                {summary}
              </p>
            ) : null}
            <LastUpdatedBadge isoDate={latestUpdateIso} locale={locale} variant="inline" />
          </header>

          <CityGuideArticle guide={guide} locale={locale} linkMap={linkMap} />

          {globalFaq.length > 0 ? (
            <section
              aria-labelledby="standalone-guide-faq-title"
              className="border-border mt-12 border-t pt-10"
            >
              <h2
                id="standalone-guide-faq-title"
                className="text-fg mb-6 font-serif text-2xl sm:text-3xl"
              >
                {pickByLocale(locale, 'Questions fréquentes', 'Frequently asked questions')}
              </h2>
              <div className="flex flex-col gap-3">
                {globalFaq.map((item, idx) => (
                  <details
                    key={item.question}
                    open={idx === 0}
                    className="border-border bg-bg group rounded-lg border p-4"
                  >
                    <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-base [&::-webkit-details-marker]:hidden">
                      <span>{item.question}</span>
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="h-4 w-4 opacity-60 transition group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <p className="text-muted mt-2 text-sm md:text-base">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        {guide.toc_anchors.length > 0 ? (
          <aside className="hidden lg:block">
            <TocSidebar anchors={guide.toc_anchors} locale={locale} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
