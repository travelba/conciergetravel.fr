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
 * `/guide/maldives` — first international country guide (Vague 6
 * template). Specialised route under the `/guide/[citySlug]` segment
 * — Next.js prefers static segments over dynamic, so this file
 * intercepts before the existing redirect handler.
 *
 * Editorial template for the remaining 7 country guides (Suisse,
 * Maroc, EAU, Maldives, Thaïlande, Japon, USA) — same shape:
 *   - AEO 80 mots + factual summary 130-150 chars
 *   - 6 regional sections with highlights / bestFor / Concierge tip
 *     (each Tip is a 50-110-word operational secret matching the
 *     ADR-0011 voice)
 *   - 6 practical info blocks (when, how, driving, formalities,
 *     language, concierge)
 *   - 7 Q&A FAQ
 *   - JSON-LD: `Article` + `Place` (country) + `BreadcrumbList` +
 *     `FAQPage`
 *
 * Hotel inventory: not surfaced inline here — every named hotel
 * links to its `/hotel/[slug]` fiche where the booking widget lives.
 * Once the country-level POI infrastructure ships (Vague 3), we'll
 * add a hotel `ItemList` JSON-LD scoped to Italy.
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
  const t = await getTranslations({ locale, namespace: 'guideMaldives' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/guide/maldives' });
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

interface RegionItem {
  readonly name: string;
  readonly highlights: string;
  readonly bestFor: string;
  readonly concierge: string;
}

interface PracticalItem {
  readonly title: string;
  readonly body: string;
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function GuideMaldivesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guideMaldives' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/guide/maldives' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const destinationsUrl = `${origin}${getPathname({ locale, href: '/destination' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const regions = t.raw('regions.items') as RegionItem[];
  const practical = t.raw('practical.items') as PracticalItem[];
  const faqItems = t.raw('faq') as FaqItem[];
  const factualSummary = t('factualSummary');

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // Article — the guide IS the editorial piece. Shares Organization
  // @id with all other Vague-5 pages for Knowledge Panel consolidation.
  const articleJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: t('title'),
    description: factualSummary,
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    datePublished: '2026-05-01',
    dateModified: lastReviewedIso,
    author: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    about: {
      '@type': 'Country',
      name: 'Maldives',
      identifier: 'MV',
    },
  });

  // Place — Italy as a destination entity. Connects the editorial
  // piece to the geographic anchor used by Google + LLM crawlers
  // when surfacing destination queries.
  const placeJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Country',
    '@id': `${url}#place`,
    name: 'Maldives',
    alternateName: 'Maldives',
    identifier: 'MV',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'MV',
    },
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: homeUrl },
      { name: t('breadcrumbDestinations'), url: destinationsUrl },
      { name: t('title'), url },
    ]),
  );

  const faqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd(faqItems.map((it) => ({ question: it.q, answer: it.a }))),
  );

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={placeJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={faqJsonLd} nonce={nonce} />

      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumbHome')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/destination" className="hover:underline">
              {t('breadcrumbDestinations')}
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
        {/* CDC §2.3 — IA-ready factual summary (AEO surface). */}
        <p
          data-aeo="factual-summary"
          className="text-fg/85 mt-4 max-w-3xl border-l-2 border-amber-300/60 pl-4 text-sm md:text-base"
        >
          {factualSummary}
        </p>
        <p className="text-muted mt-4 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={lastReviewedIso} locale={locale} variant="inline" />
      </header>

      {/* AEO — primary citation surface */}
      <section
        data-aeo
        aria-labelledby="guidemaldives-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="guidemaldives-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 6 regional sections */}
      <section aria-labelledby="regions-title" className="mb-14">
        <h2 id="regions-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('regions.title')}
        </h2>
        <div className="mt-8 flex flex-col gap-10">
          {regions.map((region, idx) => (
            <article
              key={region.name}
              id={`region-${idx + 1}`}
              className="border-border scroll-mt-24 border-b pb-10 last:border-b-0 last:pb-0"
            >
              <header className="mb-4 flex items-baseline gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-amber-700">
                  {`#${idx + 1}`}
                </span>
                <h3 className="text-fg font-serif text-xl sm:text-2xl">{region.name}</h3>
              </header>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider">Adresses phares</p>
                  <p className="text-fg/85 mt-2 text-sm">{region.highlights}</p>
                </div>
                <div>
                  <p className="text-muted text-xs uppercase tracking-wider">Pour quel séjour</p>
                  <p className="text-fg/85 mt-2 text-sm">{region.bestFor}</p>
                </div>
              </div>
              {/* Concierge tip — ADR-0011 voice, rendered as a featured
                  block with amber accent matching the Conseil styling
                  on hotel pages. */}
              <figure className="mt-5 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/30 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                  Le Conseil du Concierge
                </p>
                <blockquote className="text-fg mt-2 font-serif text-base italic">
                  {region.concierge}
                </blockquote>
              </figure>
            </article>
          ))}
        </div>
      </section>

      {/* Practical info */}
      <section
        aria-labelledby="practical-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="practical-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('practical.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {practical.map((item) => (
            <article key={item.title}>
              <h3 className="text-fg font-serif text-base">{item.title}</h3>
              <p className="text-muted mt-2 text-sm">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="guidemaldives-faq-title" className="border-border border-t pt-10">
        <h2 id="guidemaldives-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
