import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';
import { buildCloudinarySrc } from '@mch/ui';

import { RelatedItinerariesList } from '@/components/cross-links/related-itineraries-list';
import { RelatedRankingsList } from '@/components/cross-links/related-rankings-list';
import { EditorialCallout } from '@/components/editorial/editorial-callout';
import { EditorialGlossary } from '@/components/editorial/editorial-glossary';
import { EditorialTable } from '@/components/editorial/editorial-table';
import { EnrichedText } from '@/components/editorial/enriched-text';
import { ExternalSourcesFooter } from '@/components/editorial/external-sources-footer';
import { TocSidebar } from '@/components/editorial/toc-sidebar';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { buildEditorialLinkMap } from '@/server/editorial/build-link-map';
import { findItinerariesForCity } from '@/server/itineraries/find-itineraries-for-context';
import { findSiblingRankings } from '@/server/rankings/find-related-rankings';
import {
  getRankingBySlug,
  getRankingEntries,
  listPublishedRankings,
} from '@/server/rankings/get-ranking-by-slug';

// Emits per-request nonce'd JSON-LD (json-ld.tsx CSP contract + ADR-0013).
// Reading the nonce via headers() already forces dynamic rendering, so we
// declare force-dynamic explicitly rather than leave a misleading
// `revalidate` that implies nonce-broken ISR caching. Matches the hotel
// page precedent until hash-based CSP (ADR-0027) allows ISR again.
export const dynamic = 'force-dynamic';

/**
 * Defensive `[]` per nextjs-app-router skill: never throws during
 * build. Uses both fr + en locale slugs so the static slate matches
 * the public surface.
 */
export async function generateStaticParams(): Promise<{ locale: string; slug: string }[]> {
  try {
    const rankings = await listPublishedRankings();
    const out: { locale: string; slug: string }[] = [];
    for (const r of rankings) {
      out.push({ locale: 'fr', slug: r.slug });
      out.push({ locale: 'en', slug: r.slug });
    }
    return out;
  } catch {
    return [];
  }
}

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    home: 'Accueil',
    rankings: 'Classements',
    seePage: 'Voir la fiche',
    palace: 'Palace',
    stars: '★',
    faqTitle: 'Questions fréquentes',
    methodologyTitle: 'Notre méthodologie',
    rankingHeading: 'Le classement',
    outroHeading: 'Pour aller plus loin',
    updatedOn: (d: string) => `Classement révisé le ${d}.`,
    rankLabel: (n: number) => `N°${n}`,
    tablesTitle: 'Tableaux comparatifs',
  },
  en: {
    home: 'Home',
    rankings: 'Rankings',
    seePage: 'View the page',
    palace: 'Palace',
    stars: '★',
    faqTitle: 'Frequently asked questions',
    methodologyTitle: 'Our methodology',
    rankingHeading: 'The ranking',
    outroHeading: 'Going further',
    updatedOn: (d: string) => `Ranking reviewed on ${d}.`,
    rankLabel: (n: number) => `#${n}`,
    tablesTitle: 'Comparison tables',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const ranking = await getRankingBySlug(slug);
  if (ranking === null) return {};
  const locale = raw;
  // Title/description selection stays locale-aware (data layer) — see ADR-0012.
  // V2 locales fall back to FR until migration 0034.
  const title = pickByLocale(
    locale,
    ranking.meta_title_fr ?? `${ranking.title_fr} | MyConciergeHotel`,
    ranking.meta_title_en ?? `${ranking.title_en ?? ranking.title_fr} | MyConciergeHotel`,
  );
  const description = pickByLocale(
    locale,
    ranking.meta_desc_fr ?? ranking.intro_fr.slice(0, 160),
    ranking.meta_desc_en ?? ranking.intro_en?.slice(0, 160) ?? ranking.intro_fr.slice(0, 160),
  );
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/classement/[slug]', params: { slug } },
    });
  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title,
      description,
      type: 'article',
      locale: ogLocale(locale),
    },
  };
}

function formatRevisedDate(iso: string | null, locale: Locale): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(intlLocaleTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function RankingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const ranking = await getRankingBySlug(slug);
  if (ranking === null) notFound();

  const t = T[locale];
  const origin = siteOrigin();
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const canonical = `${origin}${getPathname({
    locale,
    href: { pathname: '/classement/[slug]', params: { slug } },
  })}`;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Fetch entries + internal-link map + lateral cross-links in
  // parallel. The cross-links use `ranking.axes.lieu.slug` to find
  // sibling rankings on the same lieu and itineraries that pass
  // through that lieu. Both helpers return `[]` on any error so the
  // page degrades to "no cross-link section" rather than 500.
  const lieuSlug = ranking.axes.lieu?.slug ?? null;
  const [entries, linkMap, siblingRankings, lateralItineraries] = await Promise.all([
    getRankingEntries(ranking.id),
    buildEditorialLinkMap({ excludeRankingSlug: slug }),
    findSiblingRankings({ currentSlug: slug, lieuSlug, limit: 3 }),
    lieuSlug !== null
      ? findItinerariesForCity({ citySlug: lieuSlug, limit: 3 })
      : Promise.resolve([] as Awaited<ReturnType<typeof findItinerariesForCity>>),
  ]);
  const linkMapAsMap = new Map(linkMap);

  // Title/intro/outro/factual selection stays locale-aware (data layer) — see ADR-0012.
  // V2 locales fall back to FR until migration 0034.
  const title = pickByLocale(locale, ranking.title_fr, ranking.title_en ?? ranking.title_fr);
  const intro = pickByLocale(locale, ranking.intro_fr, ranking.intro_en ?? ranking.intro_fr);
  const outro = pickByLocale(
    locale,
    ranking.outro_fr ?? '',
    ranking.outro_en ?? ranking.outro_fr ?? '',
  );
  const reviewedDate = formatRevisedDate(ranking.reviewed_at, locale);
  // CDC §2.3 — surface the AEO factual summary right under H1.
  const factualSummary = pickLocalizedText(
    locale,
    ranking.factual_summary_fr,
    ranking.factual_summary_en,
  );

  // ── JSON-LD: BreadcrumbList ──────────────────────────────────────────────
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t.home, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t.rankings, url: `${origin}${getPathname({ locale, href: '/classements' })}` },
      { name: title, url: canonical },
    ]),
  );

  // ── JSON-LD: Article ─────────────────────────────────────────────────────
  // Description preference order: factual_summary (AEO 130-150) → meta_desc → intro slice.
  // Meta description selection stays locale-aware (data layer) — see ADR-0012.
  const jsonLdDescription =
    factualSummary !== null && factualSummary.length > 0
      ? factualSummary
      : (pickByLocale(locale, ranking.meta_desc_fr, ranking.meta_desc_en) ?? intro.slice(0, 200));
  const articleJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.articleJsonLd({
      headline: title,
      url: canonical,
      description: jsonLdDescription,
      datePublished: ranking.reviewed_at ?? new Date().toISOString().slice(0, 10),
      dateModified:
        ranking.updated_at ?? ranking.reviewed_at ?? new Date().toISOString().slice(0, 10),
      author: {
        name: ranking.author_name ?? 'MyConciergeHotel Éditorial',
        ...(ranking.author_url !== null ? { url: `${origin}${ranking.author_url}` } : {}),
      },
      publisher: { name: 'MyConciergeHotel', logoUrl: `${origin}/logo.png` },
      inLanguage: hreflangKey(locale),
    }),
  );

  // ── JSON-LD: ItemList ────────────────────────────────────────────────────
  // Rich `Hotel` items so Google can render a top-list rich result.
  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: title,
      items: entries.map((e) => {
        // Hotel name + slug selection stays locale-aware (data layer) — see ADR-0012.
        // V2 locales fall back to FR until migration 0034.
        const hotelSlug = pickByLocale(locale, e.hotel_slug, e.hotel_slug_en ?? e.hotel_slug);
        return {
          name: pickByLocale(locale, e.hotel_name, e.hotel_name_en ?? e.hotel_name),
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/hotel/[slug]', params: { slug: hotelSlug } },
          })}`,
          position: e.rank,
          hotel: { starRating: e.hotel_stars as 1 | 2 | 3 | 4 | 5 },
        };
      }),
    }),
  );

  // ── JSON-LD: FAQPage ─────────────────────────────────────────────────────
  const faqItems = ranking.faq.filter((f) => {
    // FAQ question/answer selection stays locale-aware (data layer) — see ADR-0012.
    const q = pickByLocale(locale, f.question_fr, f.question_en);
    const a = pickByLocale(locale, f.answer_fr, f.answer_en);
    return q.length > 0 && a.length > 0;
  });
  const faqJsonLd =
    faqItems.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.faqPageJsonLd(
            faqItems.map((f) => ({
              // FAQ question/answer selection stays locale-aware (data layer) — see ADR-0012.
              question: pickByLocale(locale, f.question_fr, f.question_en),
              answer: pickByLocale(locale, f.answer_fr, f.answer_en),
            })),
          ),
        )
      : null;

  // Group FAQ in two buckets — contextual (per-section anchor) vs global.
  const contextualFaqByAnchor = new Map<string, typeof faqItems>();
  const globalFaq: typeof faqItems = [];
  for (const f of faqItems) {
    const anchor = f.section_anchor;
    if (typeof anchor === 'string' && anchor.length > 0) {
      const arr = contextualFaqByAnchor.get(anchor) ?? [];
      arr.push(f);
      contextualFaqByAnchor.set(anchor, arr);
    } else {
      globalFaq.push(f);
    }
  }

  // First N callouts interleave inside editorial sections; remaining
  // (rare) sit at the bottom.
  const inlineCallouts = ranking.editorial_callouts.slice(
    0,
    Math.min(3, ranking.editorial_callouts.length),
  );

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />
      {faqJsonLd !== null ? <JsonLdScript data={faqJsonLd} nonce={nonce} /> : null}

      {/* Breadcrumb — kit `.breadcrumb` */}
      <nav aria-label="Breadcrumb" className="mch-kit">
        <div className="breadcrumb">
          <Link href="/">{t.home}</Link>
          <span className="sep" aria-hidden="true">
            ›
          </span>
          <Link href="/classements">{t.rankings}</Link>
          <span className="sep" aria-hidden="true">
            ›
          </span>
          <span className="bc-current">{title}</span>
        </div>
      </nav>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-10">
        <div className="min-w-0 max-w-4xl">
          {/* Hero — kit `.rk-page-head` */}
          <header className="mch-kit mb-10">
            <div className="rk-page-head">
              <span className="eyebrow left">
                {/* TODO i18n Phase 1c-β: migrate hardcoded UI labels to next-intl messages. */}
                {pickByLocale(locale, 'Classement éditorial', 'Editorial ranking')}
              </span>
              <h1>{title}</h1>
              {/* CDC §2.3 — IA-ready factual summary (AEO surface). */}
              {factualSummary !== null && factualSummary.length > 0 ? (
                <p data-aeo="factual-summary" className="rk-summary">
                  {factualSummary}
                </p>
              ) : null}
              <div className="rk-meta">
                <LastUpdatedBadge
                  isoDate={ranking.updated_at ?? ranking.reviewed_at}
                  locale={locale}
                  variant="inline"
                />
                {/* Keep legacy "Classement révisé le …" for assistive context when distinct. */}
                {reviewedDate !== null && ranking.reviewed_at !== ranking.updated_at ? (
                  <span>{t.updatedOn(reviewedDate)}</span>
                ) : null}
              </div>
            </div>
          </header>

          {/* Intro (méthodologie) — long-form, auto-linked entities */}
          <section id="introduction" className="mb-12 scroll-mt-24">
            <h2 className="text-fg mb-3 font-serif text-xl md:text-2xl">{t.methodologyTitle}</h2>
            <EnrichedText body={intro} locale={locale} linkMap={linkMapAsMap} />
          </section>

          {/* Editorial sections (criteria, history, trends, terroir, …) */}
          {ranking.editorial_sections.length > 0 ? (
            <article className="space-y-12">
              {ranking.editorial_sections.map((section, idx) => {
                const anchor = section.key.length > 0 ? section.key : `section-${idx}`;
                // Section title/body selection stays locale-aware (data layer) — see ADR-0012.
                const sectionTitle = pickByLocale(
                  locale,
                  section.title_fr,
                  section.title_en || section.title_fr,
                );
                const body = pickByLocale(
                  locale,
                  section.body_fr,
                  section.body_en || section.body_fr,
                );
                const localFaq = contextualFaqByAnchor.get(anchor) ?? [];
                const callout = inlineCallouts[idx] ?? null;
                return (
                  <section key={anchor} id={anchor} className="scroll-mt-24">
                    <h2 className="text-fg mb-4 font-serif text-2xl md:text-3xl">{sectionTitle}</h2>
                    <EnrichedText body={body} locale={locale} linkMap={linkMapAsMap} />
                    {callout !== null ? (
                      <EditorialCallout callout={callout} locale={locale} />
                    ) : null}
                    {localFaq.length > 0 ? (
                      <div className="mt-6 space-y-2">
                        <p className="text-fg/70 text-xs font-medium uppercase tracking-wide">
                          {/* TODO i18n Phase 1c-β: migrate hardcoded UI labels to next-intl messages. */}
                          {pickByLocale(
                            locale,
                            'Questions sur cette section',
                            'Questions about this section',
                          )}
                        </p>
                        {localFaq.map((f, i) => {
                          // FAQ question/answer selection stays locale-aware (data layer) — see ADR-0012.
                          const q = pickByLocale(locale, f.question_fr, f.question_en);
                          const a = pickByLocale(locale, f.answer_fr, f.answer_en);
                          return (
                            <details
                              key={`s-faq-${anchor}-${i}`}
                              className="border-border/70 bg-bg/40 rounded border p-3"
                            >
                              <summary className="text-fg/90 cursor-pointer text-sm font-medium">
                                {q}
                              </summary>
                              <p className="text-fg/80 mt-2 text-sm leading-relaxed">{a}</p>
                            </details>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </article>
          ) : null}

          {/* Comparison tables (v2) */}
          {ranking.tables.length > 0 ? (
            <section id="tableaux" className="mt-14 scroll-mt-24">
              <h2 className="text-fg mb-2 font-serif text-2xl md:text-3xl">{t.tablesTitle}</h2>
              {ranking.tables.map((tab) => (
                <EditorialTable key={tab.key} table={tab} locale={locale} />
              ))}
            </section>
          ) : null}

          {/* Entries (TOP X) — kit `.crank` ranked cards with editorial justifications */}
          <section id="ranking" className="mch-kit mt-14 scroll-mt-24">
            <h2 className="mb-6 font-serif text-2xl text-[color:var(--noir)] md:text-3xl">
              {t.rankingHeading}
            </h2>
            <ol className="rk-list">
              {entries.map((e) => {
                // Hotel slug/name/justification/badge selection stays locale-aware (data layer) — see ADR-0012.
                // V2 locales fall back to FR until migration 0034.
                const linkSlug = pickByLocale(
                  locale,
                  e.hotel_slug,
                  e.hotel_slug_en ?? e.hotel_slug,
                );
                const name = pickByLocale(locale, e.hotel_name, e.hotel_name_en ?? e.hotel_name);
                const justification = pickByLocale(
                  locale,
                  e.justification_fr,
                  e.justification_en ?? e.justification_fr,
                );
                const badge = pickByLocale(locale, e.badge_fr, e.badge_en ?? e.badge_fr);
                const hotelHref = {
                  pathname: '/hotel/[slug]',
                  params: { slug: linkSlug },
                } as const;
                const photoSrc =
                  e.hotel_hero_image !== null && e.hotel_hero_image !== ''
                    ? buildCloudinarySrc({
                        cloudName,
                        publicId: e.hotel_hero_image,
                        transforms: 'f_auto,q_auto,c_fill,g_auto,w_680,h_510',
                      })
                    : null;
                const starLabel = e.hotel_is_palace
                  ? t.palace
                  : '★'.repeat(Math.max(0, Math.min(5, e.hotel_stars)));
                return (
                  <li
                    key={`${e.rank}-${e.hotel_slug}`}
                    id={`rank-${e.rank}`}
                    className="scroll-mt-24"
                  >
                    <article className="crank">
                      <div className="cr-num" aria-hidden="true">
                        {e.rank}
                      </div>
                      {photoSrc !== null ? (
                        <Link href={hotelHref} className="cr-photo" aria-label={name}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photoSrc} alt={name} loading="lazy" />
                        </Link>
                      ) : (
                        <span className="cr-photo" aria-hidden="true" />
                      )}
                      <div className="cr-body">
                        <div className="cr-stars" aria-hidden="true">
                          {starLabel}
                        </div>
                        <h3>
                          <Link href={hotelHref}>
                            <span className="sr-only">{t.rankLabel(e.rank)} — </span>
                            {name}
                          </Link>
                        </h3>
                        <span className="loc">
                          {e.hotel_city}
                          {' · '}
                          {e.hotel_region}
                        </span>
                        {badge !== null && badge !== undefined && badge !== '' ? (
                          <span className="cr-badge">{badge}</span>
                        ) : null}
                        {/* Auto-linked justification — neighbouring Palaces, cities, etc. */}
                        <EnrichedText
                          body={justification}
                          locale={locale}
                          linkMap={linkMapAsMap}
                          maxLinksPerParagraph={2}
                        />
                        <div className="cr-foot">
                          <Link href={hotelHref} className="cr-link">
                            {t.seePage} <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Glossary */}
          <EditorialGlossary glossary={ranking.glossary} locale={locale} />

          {/* Remaining callouts (rare) */}
          {ranking.editorial_callouts.length > inlineCallouts.length ? (
            <section className="my-10 space-y-4">
              {ranking.editorial_callouts.slice(inlineCallouts.length).map((c, i) => (
                <EditorialCallout key={`cb-${i}`} callout={c} locale={locale} />
              ))}
            </section>
          ) : null}

          {/* Outro */}
          {outro.length > 0 ? (
            <section id="conclusion" className="mt-14 scroll-mt-24">
              <h2 className="text-fg mb-3 font-serif text-2xl md:text-3xl">{t.outroHeading}</h2>
              <EnrichedText body={outro} locale={locale} linkMap={linkMapAsMap} />
            </section>
          ) : null}

          {/* Global FAQ */}
          {globalFaq.length > 0 ? (
            <section id="faq" className="mt-14 scroll-mt-24">
              <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">{t.faqTitle}</h2>
              <div className="space-y-3">
                {globalFaq.map((f, i) => {
                  // FAQ question/answer selection stays locale-aware (data layer) — see ADR-0012.
                  const q = pickByLocale(locale, f.question_fr, f.question_en);
                  const a = pickByLocale(locale, f.answer_fr, f.answer_en);
                  return (
                    <details
                      key={`g-faq-${i}`}
                      className="border-border bg-bg/60 open:bg-bg rounded-lg border p-4 marker:text-transparent"
                    >
                      <summary className="text-fg cursor-pointer font-medium">{q}</summary>
                      <p className="text-fg/90 mt-2 text-sm leading-relaxed">{a}</p>
                    </details>
                  );
                })}
              </div>
            </section>
          ) : null}

          {siblingRankings.length > 0 || lateralItineraries.length > 0 ? (
            <section id="cross-links" className="mt-14 scroll-mt-24">
              {siblingRankings.length > 0 ? (
                <RelatedRankingsList
                  locale={locale}
                  heading={pickByLocale(
                    locale,
                    `Autres classements ${ranking.axes.lieu?.label ?? ''}`.trim(),
                    `Other rankings ${ranking.axes.lieu?.label ?? ''}`.trim(),
                  )}
                  rankings={siblingRankings}
                  cta={pickByLocale(locale, 'Lire le classement', 'Read the ranking')}
                />
              ) : null}
              {lateralItineraries.length > 0 ? (
                <div className={siblingRankings.length > 0 ? 'mt-10' : ''}>
                  <RelatedItinerariesList
                    locale={locale}
                    heading={pickByLocale(
                      locale,
                      `Itinéraires Concierge ${ranking.axes.lieu?.label ?? ''}`.trim(),
                      `Concierge itineraries ${ranking.axes.lieu?.label ?? ''}`.trim(),
                    )}
                    itineraries={lateralItineraries}
                    cta={pickByLocale(locale, "Voir l'itinéraire", 'View the itinerary')}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          {/* External sources (EEAT signal) */}
          <ExternalSourcesFooter sources={ranking.external_sources} locale={locale} />
        </div>

        {/* Sticky TOC sidebar (desktop only). */}
        <aside className="hidden lg:block">
          <TocSidebar anchors={ranking.toc_anchors} locale={locale} />
        </aside>
      </div>
    </main>
  );
}
