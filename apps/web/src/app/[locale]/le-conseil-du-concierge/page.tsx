import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { ConciergeSisterLinks } from '@/components/concierge/concierge-sister-links';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/le-conseil-du-concierge` — dedicated USP hub (Vague 5 P1).
 *
 * The Conseil du Concierge is MyConciergeHotel's editorial signature
 * (ADR-0011) — a 50-110 word block closing every hotel page with a
 * concrete operational secret. Previously, this concept was only
 * referenced from `/le-concierge` (institutional landing) and on
 * each hotel page itself; no dedicated hub explained the structure,
 * the categories, or showcased the format.
 *
 * This page is the canonical anchor for:
 *   - LLM citations of the USP (Perplexity, ChatGPT Search, Claude)
 *     querying "what is MyConciergeHotel's Concierge Tip?"
 *   - SERP visibility on long-tail queries ("conseil concierge
 *     hôtel", "secret hôtel palace")
 *   - The Vague-3 follow-up (per-city Conseil) and Vague-5 Journal
 *     (where individual Tips will be syndicated)
 *
 * Content:
 *   - AEO 80 mots primary answer
 *   - 5 anatomy points (length, category, opener, concrete, sourced)
 *   - 6 Tip categories (room, dining, timing, access, service, wellness)
 *   - 3 anonymised sample Tips
 *   - CTA strip back to catalogue / rankings / méthode
 *
 * JSON-LD: `CreativeWork` typed as `Article` with the anatomy as
 * `mentions` array + `BreadcrumbList`. No dynamic ItemList yet —
 * a future PR will add `listHotelsWithConciergeTips()` to seed it.
 *
 * URL slug is intentionally `/le-conseil-du-concierge` (full French)
 * rather than nested under `/le-concierge/conseil` because it's
 * the canonical USP — deserves its own top-level identity for
 * Knowledge Panel anchoring.
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
  const t = await getTranslations({ locale, namespace: 'leConseilHub' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-conseil-du-concierge' });
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

interface AnatomyItem {
  readonly title: string;
  readonly body: string;
}

interface CategoryItem {
  readonly code: string;
  readonly label: string;
  readonly body: string;
}

interface SampleItem {
  readonly tipFor: string;
  readonly body: string;
}

export default async function LeConseilHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'leConseilHub' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-conseil-du-concierge' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const anatomyItems = t.raw('anatomy.items') as AnatomyItem[];
  const categoryItems = t.raw('categories.items') as CategoryItem[];
  const sampleItems = t.raw('samples.items') as SampleItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // Article — the Conseil hub IS the editorial piece explaining the
  // USP. Shares Organization @id for Knowledge Panel consolidation.
  const articleJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: t('title'),
    description: t('metaDesc'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    datePublished: '2026-04-15',
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
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: homeUrl },
      { name: t('title'), url },
    ]),
  );

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={articleJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <nav aria-label="Breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumbHome')}
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

      {/* AEO — citation surface */}
      <section
        data-aeo
        aria-labelledby="conseil-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="conseil-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 5 anatomy points */}
      <section aria-labelledby="anatomy-title" className="mb-14">
        <h2 id="anatomy-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('anatomy.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('anatomy.lede')}</p>
        <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {anatomyItems.map((item, idx) => (
            <li key={item.title} className="border-border bg-bg rounded-lg border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {`#${idx + 1}`}
              </p>
              <h3 className="text-fg mt-1 font-serif text-base">{item.title}</h3>
              <p className="text-muted mt-2 text-sm">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 6 categories */}
      <section
        aria-labelledby="categories-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="categories-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('categories.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {categoryItems.map((cat) => (
            <article key={cat.code} className="border-border bg-bg rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {cat.code}
              </p>
              <h3 className="text-fg mt-1 font-serif text-base">{cat.label}</h3>
              <p className="text-muted mt-2 text-xs">{cat.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 3 anonymised samples */}
      <section aria-labelledby="samples-title" className="mb-14">
        <h2 id="samples-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('samples.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('samples.lede')}</p>
        <div className="mt-6 flex flex-col gap-5">
          {sampleItems.map((sample, idx) => (
            <figure
              key={idx}
              className="rounded-r-lg border-l-4 border-amber-400 bg-amber-50/30 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {sample.tipFor}
              </p>
              <blockquote className="text-fg mt-2 font-serif text-base italic">
                « {sample.body} »
              </blockquote>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section
        aria-labelledby="conseil-cta-title"
        className="border-border bg-bg rounded-lg border p-6 md:p-8"
      >
        <h2 id="conseil-cta-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('cta.title')}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/hotels"
            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          >
            {t('cta.browseCatalog')} →
          </Link>
          <Link
            href="/classements"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('cta.browseRankings')} →
          </Link>
          <Link
            href="/le-concierge"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('cta.method')} →
          </Link>
        </div>
      </section>

      <ConciergeSisterLinks currentSlug="conseil" />
    </main>
  );
}
