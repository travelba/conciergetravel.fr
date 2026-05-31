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
 * `/le-concierge/fidelite` — loyalty programme page (Vague 5 P0).
 *
 * Hosts the public, citation-friendly description of the two-tier
 * loyalty programme (Essential automatic / Prestige subscription per
 * ADR-0005). Replaces the previous one-section block on `/le-concierge`
 * with a dedicated indexable surface.
 *
 * Coverage:
 *   - AEO 80-mots primary answer.
 *   - Two-tier card grid (Essential + Prestige) with named benefits.
 *   - Compatibility block (stacking with chain programmes).
 *   - Eligibility block.
 *   - 7 Q&A FAQ.
 *   - CTA strip (create account, browse catalogue, newsletter).
 *
 * JSON-LD: `Service` with `Offer`-typed sub-services per tier,
 * `BreadcrumbList`, `FAQPage`.
 *
 * Mirrors the `/api/agent/loyalty` envelope shipped in PR4 — the page
 * and the agentic endpoint share the same conceptual model, ensuring
 * an LLM that fetches via `loyalty` skill gets the same content as a
 * human visitor.
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
  const t = await getTranslations({ locale, namespace: 'conciergeLoyalty' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/fidelite' });
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
      type: 'website',
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
    },
  };
}

interface BenefitItem {
  readonly title: string;
  readonly body: string;
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergeLoyaltyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeLoyalty' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/fidelite' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const essentielBenefits = t.raw('tiers.essentiel.benefits') as BenefitItem[];
  const prestigeBenefits = t.raw('tiers.prestige.benefits') as BenefitItem[];
  const compatibilityItems = t.raw('compatibility.items') as string[];
  const faqItems = t.raw('faq') as FaqItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // Service — the loyalty programme as a service offered to MyConciergeHotel
  // customers. `hasOfferCatalog` exposes the two tiers as sub-offers,
  // letting schema-aware consumers (Google Knowledge Panel, LLM agents)
  // discover the structure without parsing the page.
  const serviceJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'Service',
    '@id': `${url}#service`,
    name: t('title'),
    description: t('lede'),
    url,
    provider: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
    },
    serviceType: 'LoyaltyProgram',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t('title'),
      itemListElement: [
        {
          '@type': 'Offer',
          name: t('tiers.essentiel.name'),
          description: t('tiers.essentiel.lede'),
          price: '0',
          priceCurrency: 'EUR',
          eligibleCustomerType: 'Registered',
        },
        {
          '@type': 'Offer',
          name: t('tiers.prestige.name'),
          description: t('tiers.prestige.lede'),
          // Price intentionally absent — tier Prestige tarif not yet
          // published per ADR-0005 (programme deferred). Once published,
          // add `price` + `priceCurrency` here.
          eligibleCustomerType: 'Subscriber',
        },
      ],
    },
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
      <JsonLdScript data={serviceJsonLd} nonce={nonce} />
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

      {/* PR-E — Banner pointing at the current Club programme. The
          historical two-tier loyalty doc (ADR-0005) lives on for SEO
          continuity but the active funnel is `/le-concierge-club`
          (ADR-0019). The banner makes the discoverability path
          explicit since the footer no longer surfaces this URL. */}
      <aside
        aria-labelledby="loyalty-club-banner-title"
        className="mb-10 rounded-lg border border-amber-300 bg-amber-50/40 p-5 dark:bg-amber-900/10"
      >
        <p id="loyalty-club-banner-title" className="text-fg font-serif text-base md:text-lg">
          {t('clubBanner.title')}
        </p>
        <p className="text-muted mt-2 text-sm md:text-base">
          {t('clubBanner.body')}{' '}
          <Link
            href="/le-concierge-club"
            className="text-fg font-medium underline decoration-amber-500 decoration-2 underline-offset-2"
          >
            {t('clubBanner.linkLabel')}
          </Link>
          .
        </p>
      </aside>

      <header className="mb-12 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-4 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={lastReviewedIso} locale={locale} variant="inline" />
      </header>

      <section
        data-aeo
        aria-labelledby="loyalty-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="loyalty-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* Two tiers — side-by-side cards */}
      <section aria-labelledby="tiers-title" className="mb-14">
        <h2 id="tiers-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('tiers.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Essentiel */}
          <article className="border-border bg-bg flex flex-col rounded-lg border p-6">
            <header className="border-border mb-4 border-b pb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {t('tiers.essentiel.tagline')}
              </p>
              <h3 className="text-fg mt-1 font-serif text-2xl">{t('tiers.essentiel.name')}</h3>
              <p className="text-muted mt-3 text-sm">{t('tiers.essentiel.lede')}</p>
            </header>
            <ul className="flex flex-col gap-4">
              {essentielBenefits.map((b) => (
                <li key={b.title} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 text-amber-700">
                    ★
                  </span>
                  <div>
                    <p className="text-fg text-sm font-medium">{b.title}</p>
                    <p className="text-muted mt-1 text-sm">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* Prestige */}
          <article className="border-border bg-muted/5 flex flex-col rounded-lg border p-6">
            <header className="border-border mb-4 border-b pb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {t('tiers.prestige.tagline')}
              </p>
              <h3 className="text-fg mt-1 font-serif text-2xl">{t('tiers.prestige.name')}</h3>
              <p className="text-muted mt-3 text-sm">{t('tiers.prestige.lede')}</p>
            </header>
            <ul className="flex flex-col gap-4">
              {prestigeBenefits.map((b) => (
                <li key={b.title} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 text-amber-700">
                    ★
                  </span>
                  <div>
                    <p className="text-fg text-sm font-medium">{b.title}</p>
                    <p className="text-muted mt-1 text-sm">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* Compatibility with chain programmes */}
      <section
        aria-labelledby="compatibility-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="compatibility-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('compatibility.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
          {t('compatibility.lede')}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {compatibilityItems.map((item) => (
            <li key={item.slice(0, 30)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Eligibility */}
      <section aria-labelledby="eligibility-title" className="mb-14 max-w-3xl">
        <h2 id="eligibility-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('eligibility.title')}
        </h2>
        <dl className="mt-4 flex flex-col gap-4">
          <div>
            <dt className="text-fg text-sm font-medium">{t('tiers.essentiel.name')}</dt>
            <dd className="text-muted mt-1 text-sm">{t('eligibility.essentiel')}</dd>
          </div>
          <div>
            <dt className="text-fg text-sm font-medium">{t('tiers.prestige.name')}</dt>
            <dd className="text-muted mt-1 text-sm">{t('eligibility.prestige')}</dd>
          </div>
        </dl>
      </section>

      {/* CTA strip */}
      <section
        aria-labelledby="cta-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="cta-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('cta.title')}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/compte/inscription"
            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          >
            {t('cta.createAccount')} →
          </Link>
          <Link
            href="/marques"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('cta.browseCatalog')} →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="loyalty-faq-title" className="border-border border-t pt-10">
        <h2 id="loyalty-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
