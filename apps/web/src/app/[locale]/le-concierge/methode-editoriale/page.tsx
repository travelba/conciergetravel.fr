import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/le-concierge/methode-editoriale` — EEAT-grade methodology page
 * (Vague 5 P0 of the 3-piliers audit — skill `geo-llm-optimization`
 * §E-E-A-T signals: "Methodology page describing selection criteria").
 *
 * Hosts the public, citation-friendly version of the selection
 * method applied by our concierge desk:
 *
 *   1. AEO block (40-80 mots) answering "comment MyConciergeHotel
 *      sélectionne ses Palaces ?" — primary citation surface for
 *      AI Overviews and ChatGPT Search.
 *   2. Four non-negotiable principles (independence, transparency,
 *      expertise, freshness).
 *   3. The 8 selection criteria (Atout France, Michelin Keys,
 *      Michelin stars, Forbes, author collection, Amadeus reviews,
 *      internal audit, editorial signature).
 *   4. The 4-step inclusion process.
 *   5. 6 Q&A canonical FAQ.
 *   6. `Article` + `Organization.publishingPrinciples` JSON-LD —
 *      points back to itself, telling Google "this is the editorial
 *      principles page for the publisher", a major EEAT signal.
 *
 * `force-dynamic` per the CSP nonce contract on JSON-LD pages.
 *
 * @see docs/adr/0014-menu-architecture-v2.md (mega-menu 5 — Le Concierge)
 * @see .cursor/skills/geo-llm-optimization/SKILL.md §E-E-A-T signals
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'conciergeMethod' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/methode-editoriale' });
  return {
    title: t('metaTitle'),
    description: t('metaDesc'),
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDesc'),
      type: 'article',
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
    },
  };
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

interface CriterionItem {
  readonly name: string;
  readonly desc: string;
}

export default async function ConciergeMethodPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeMethod' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/methode-editoriale' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const criteria = t.raw('criteria.items') as CriterionItem[];
  const faqItems = t.raw('faq') as FaqItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // Article — the methodology IS the article. `lastReviewed` is the
  // Schema.org extension for evergreen pages (skill `geo-llm-optimization`
  // §Freshness — better than relying on `dateModified` alone for
  // pages whose content is reviewed but doesn't structurally change).
  const articleJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: t('title'),
    description: t('metaDesc'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    datePublished: '2026-04-01',
    dateModified: lastReviewedIso,
    author: {
      '@type': 'Organization',
      name: 'MyConciergeHotel',
      url: `${origin}/`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MyConciergeHotel',
      url: `${origin}/`,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  });

  // Organization with `publishingPrinciples` pointing at this page —
  // signals to Google "this URL hosts our editorial principles". Major
  // EEAT signal documented by Google in 2023 (Knowledge Panel +
  // News partner guidelines).
  const orgPrinciplesJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'MyConciergeHotel',
    url: `${origin}/`,
    publishingPrinciples: url,
    actionableFeedbackPolicy: `${origin}${getPathname({ locale, href: '/le-concierge/contact' })}`,
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: homeUrl },
      { name: t('breadcrumbConcierge'), url: conciergeUrl },
      { name: t('title'), url },
    ]),
  );

  const faqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd(faqItems.map((it) => ({ question: it.q, answer: it.a }))),
  );

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={orgPrinciplesJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={faqJsonLd} nonce={nonce} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumbHome')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/le-concierge" className="hover:underline">
              {t('breadcrumbConcierge')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {t('title')}
          </li>
        </ol>
      </nav>

      <header className="mb-12 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-4 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={lastReviewedIso} locale={locale} variant="inline" />
      </header>

      {/* AEO — primary citation surface */}
      <section
        data-aeo
        aria-labelledby="method-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="method-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 4 principles */}
      <section aria-labelledby="principles-title" className="mb-14">
        <h2 id="principles-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('principles.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {(['independence', 'transparency', 'expertise', 'freshness'] as const).map((key) => (
            <article key={key} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-lg">{t(`principles.${key}.title`)}</h3>
              <p className="text-muted mt-2 text-sm">{t(`principles.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 8 criteria */}
      <section aria-labelledby="criteria-title" className="mb-14">
        <h2 id="criteria-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('criteria.title')}
        </h2>
        <p className="text-muted mt-3 max-w-3xl text-sm md:text-base">{t('criteria.lede')}</p>
        <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {criteria.map((c, idx) => (
            <li key={c.name} className="border-border bg-bg rounded-lg border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {`#${idx + 1}`}
              </p>
              <h3 className="text-fg mt-1 font-serif text-base">{c.name}</h3>
              <p className="text-muted mt-2 text-sm">{c.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4-step process */}
      <section aria-labelledby="process-title" className="mb-14">
        <h2 id="process-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('process.title')}
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {([1, 2, 3, 4] as const).map((step) => (
            <li key={step} className="border-border bg-bg rounded-lg border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {`Étape ${step}`}
              </p>
              <h3 className="text-fg mt-1 font-serif text-lg">{t(`process.step${step}Title`)}</h3>
              <p className="text-muted mt-2 text-sm">{t(`process.step${step}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section aria-labelledby="method-faq-title" className="border-border border-t pt-10">
        <h2 id="method-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
          {t('faqTitle')}
        </h2>
        <div className="flex flex-col gap-3">
          {faqItems.map((item, idx) => (
            <details
              key={item.q}
              open={idx === 0}
              className="border-border bg-bg group rounded-lg border p-4"
            >
              <summary className="text-fg flex cursor-pointer list-none items-center justify-between gap-3 font-serif text-base [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
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
              <p className="text-muted mt-2 text-sm md:text-base">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
