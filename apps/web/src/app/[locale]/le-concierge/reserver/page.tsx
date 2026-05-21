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
 * `/le-concierge/reserver` — conversion-oriented "how to book" page
 * (Vague 5 P0 of the 3-piliers audit).
 *
 * Splits the reservation contract into 5 steps an LLM agent can quote
 * verbatim, and provides the canonical `HowTo` JSON-LD payload that
 * Google Rich Results renders as a step-by-step card.
 *
 * Coverage:
 *   - AEO 60-80 mots positioning the two booking modes (Amadeus direct
 *     vs concierge email).
 *   - 5 step cards (pick address → dates → rate → payment → confirm).
 *   - 4 reassurance signals (IATA, net rate, comparator, loyalty).
 *   - 6 Q&A FAQ (confirmation SLA, payment methods, parity, modify,
 *     check-in, loyalty points).
 *   - `HowTo` + `FAQPage` + `BreadcrumbList` JSON-LD.
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
  const t = await getTranslations({ locale, namespace: 'conciergeReserver' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/reserver' });
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

interface StepItem {
  readonly title: string;
  readonly body: string;
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergeReserverPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeReserver' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/reserver' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const steps = t.raw('steps.items') as StepItem[];
  const faqItems = t.raw('faq') as FaqItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // HowTo — the canonical schema for step-by-step procedures. Google
  // Rich Results renders this as a numbered card. Each step gets its
  // own `HowToStep` with `name` and `text`.
  const howToJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: t('title'),
    description: t('lede'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    step: steps.map((s, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: s.title,
      text: s.body,
    })),
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
      <JsonLdScript data={howToJsonLd} nonce={nonce} />
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

      <header className="mb-12 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-4 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={lastReviewedIso} locale={locale} variant="inline" />
      </header>

      <section
        data-aeo
        aria-labelledby="reserver-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="reserver-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 5 steps */}
      <section aria-labelledby="steps-title" className="mb-14">
        <h2 id="steps-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('steps.title')}
        </h2>
        <ol className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {steps.map((s, idx) => (
            <li key={s.title} className="border-border bg-bg rounded-lg border p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                {`#${idx + 1}`}
              </p>
              <h3 className="text-fg mt-1 font-serif text-lg">{s.title}</h3>
              <p className="text-muted mt-2 text-sm">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Reassurance */}
      <section
        aria-labelledby="reassurance-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="reassurance-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('reassurance.title')}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['iata', 'rate', 'comparator', 'loyalty'] as const).map((key) => (
            <li key={key} className="text-muted flex items-start gap-2 text-sm md:text-base">
              <span aria-hidden className="mt-1 text-amber-700">
                ★
              </span>
              <span>{t(`reassurance.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="reserver-faq-title" className="border-border border-t pt-10">
        <h2 id="reserver-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
