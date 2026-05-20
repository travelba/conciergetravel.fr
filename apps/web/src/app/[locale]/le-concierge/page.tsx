import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/le-concierge` — institutional EEAT page (ADR-0014 mega-menu 5).
 *
 * - Hosts the canonical `TravelAgency` + `Organization` JSON-LD
 *   declarations for the site (the home page also emits a
 *   `TravelAgency` node, but with `url = '/'`; this page is the
 *   `@id` resolution target for the LLM crawlers thanks to `sameAs`
 *   + `mainEntityOfPage`).
 * - Lists the three commitments (IATA, GDS net rate, Amadeus secure
 *   payment), the editorial method, the loyalty programme, the
 *   Conseil du Concierge signature, the pro section, and a FAQ.
 * - FAQ is emitted both visually and as `FAQPage` JSON-LD (≥ 5 Q&A
 *   — see rule `seo-geo` §AEO).
 *
 * Rendering: `force-dynamic` (CSP nonce contract — JSON-LD inside the
 * page) per skill `structured-data-schema-org` §CSP-nonce-contract.
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    breadcrumbHome: 'Accueil',
  },
  en: {
    breadcrumbHome: 'Home',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'concierge' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge' });

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
    },
  };
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'concierge' });
  const tStatic = T[locale];

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const faqItems = t.raw('faq.items') as FaqItem[];

  // ─── JSON-LD payloads ──────────────────────────────────────────────────

  const travelAgencyJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.travelAgencyJsonLd({
      name: 'MyConciergeHotel',
      url,
      description: t('lede'),
      iataCode: 'FR',
      contactEmail: 'contact@myconciergehotel.com',
      sameAs: [
        // sameAs entries authenticate the agency across the open web;
        // each URL here MUST be a profile we control. Empty for now
        // — Phase 2 adds Linkedin/Crunchbase/Trustpilot.
      ],
    }),
  );

  const faqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd(faqItems.map((item) => ({ question: item.q, answer: item.a }))),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: tStatic.breadcrumbHome, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t('title'), url },
    ]),
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={travelAgencyJsonLd} nonce={nonce} />
      <JsonLdScript data={faqJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {tStatic.breadcrumbHome}
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
      </header>

      {/* ── Trust signals — 3 columns ───────────────────────────────────── */}
      <section aria-labelledby="trust-title" className="mb-14">
        <h2 id="trust-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('trust.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <TrustCard title={t('trust.iataTitle')} body={t('trust.iataBody')} />
          <TrustCard title={t('trust.gdsTitle')} body={t('trust.gdsBody')} />
          <TrustCard title={t('trust.amadeusTitle')} body={t('trust.amadeusBody')} />
        </div>
      </section>

      {/* ── Editorial method — 3 steps ──────────────────────────────────── */}
      <section aria-labelledby="method-title" className="mb-14">
        <h2 id="method-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('method.title')}
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <MethodStep step={1} title={t('method.step1Title')} body={t('method.step1Body')} />
          <MethodStep step={2} title={t('method.step2Title')} body={t('method.step2Body')} />
          <MethodStep step={3} title={t('method.step3Title')} body={t('method.step3Body')} />
        </ol>
      </section>

      {/* ── Conseil du Concierge — signature highlight ──────────────────── */}
      <section
        aria-labelledby="tip-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
          ⭐ {t('tip.title')}
        </p>
        <p className="text-fg mt-2 max-w-prose text-base md:text-lg">{t('tip.body')}</p>
        <Link
          href="/hotels"
          className="text-fg mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          {t('tip.cta')}
        </Link>
      </section>

      {/* ── Loyalty ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="loyalty-title" className="mb-14 max-w-3xl">
        <h2 id="loyalty-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('loyalty.title')}
        </h2>
        <p className="text-muted mt-3 text-base">{t('loyalty.body')}</p>
      </section>

      {/* ── For pros ────────────────────────────────────────────────────── */}
      <section aria-labelledby="pro-title" className="mb-14">
        <h2 id="pro-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('pro.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <TrustCard title={t('pro.hotelierTitle')} body={t('pro.hotelierBody')} />
          <TrustCard title={t('pro.miceTitle')} body={t('pro.miceBody')} />
          <TrustCard title={t('pro.pressTitle')} body={t('pro.pressBody')} />
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('faq.title')}
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          {/*
            First item rendered open by default — LLM crawlers sometimes
            skip closed `<details>` (skill `seo-technical` §FAQ).
          */}
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

// ─── Subcomponents ───────────────────────────────────────────────────────

function TrustCard({ title, body }: { readonly title: string; readonly body: string }) {
  return (
    <div className="border-border bg-bg rounded-lg border p-5">
      <h3 className="text-fg font-serif text-lg">{title}</h3>
      <p className="text-muted mt-2 text-sm">{body}</p>
    </div>
  );
}

function MethodStep({
  step,
  title,
  body,
}: {
  readonly step: number;
  readonly title: string;
  readonly body: string;
}) {
  return (
    <li className="border-border bg-bg rounded-lg border p-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-700">
        Étape {step}
      </p>
      <h3 className="text-fg font-serif text-lg">{title}</h3>
      <p className="text-muted mt-2 text-sm">{body}</p>
    </li>
  );
}
