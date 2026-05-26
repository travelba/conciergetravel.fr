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
 * `/le-concierge/mice-et-seminaires` — B2B MICE intake (Vague 5 P1).
 *
 * Audience: corporate event planners, wedding planners, executive
 * assistants organising private events. Surfaces 5 event formats,
 * a non-exhaustive list of top MICE venues by region, and the quote
 * request form.
 *
 * Form is a placeholder shell (disabled inputs + email fallback to
 * mice@) — Brevo relay + `mice_quotes` persistence are deferred to
 * the same follow-up as `/api/agent/contact`.
 *
 * JSON-LD: `Service` typed for event planning + `BreadcrumbList`
 * + `FAQPage`.
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
  const t = await getTranslations({ locale, namespace: 'conciergeMice' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/mice-et-seminaires' });
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

interface FormatItem {
  readonly title: string;
  readonly body: string;
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergeMicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeMice' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/mice-et-seminaires' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const formats = t.raw('formats.items') as FormatItem[];
  const venues = t.raw('topVenues.items') as string[];
  const faqItems = t.raw('faq') as FaqItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

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
    serviceType: 'EventPlanning',
    areaServed: { '@type': 'Country', name: 'FR' },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t('formats.title'),
      itemListElement: formats.map((f) => ({
        '@type': 'Offer',
        name: f.title,
        description: f.body,
      })),
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

      <header className="mb-12 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-4 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={lastReviewedIso} locale={locale} variant="inline" />
      </header>

      <section
        data-aeo
        aria-labelledby="mice-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="mice-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 5 formats */}
      <section aria-labelledby="formats-title" className="mb-14">
        <h2 id="formats-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('formats.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {formats.map((f) => (
            <article key={f.title} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-lg">{f.title}</h3>
              <p className="text-muted mt-2 text-sm">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Top venues */}
      <section
        aria-labelledby="venues-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="venues-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('topVenues.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('topVenues.lede')}</p>
        <ul className="mt-4 flex flex-col gap-3">
          {venues.map((v) => (
            <li key={v.slice(0, 30)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                •
              </span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Form placeholder */}
      <section
        aria-labelledby="mice-form-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="mice-form-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('form.title')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('form.lede')}</p>
        <form className="mt-6 grid grid-cols-1 gap-4 opacity-80">
          {/* Disabled placeholder — same pattern as /le-concierge/contact.
              Brevo relay + `mice_quotes` table ship together in a
              follow-up PR. */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.namePlaceholder')}</span>
            <input
              type="text"
              disabled
              placeholder={t('form.namePlaceholder')}
              className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.emailPlaceholder')}</span>
            <input
              type="email"
              disabled
              placeholder={t('form.emailPlaceholder')}
              className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('form.formatPlaceholder')}</span>
              <input
                type="text"
                disabled
                placeholder={t('form.formatPlaceholder')}
                className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('form.guestsPlaceholder')}</span>
              <input
                type="text"
                disabled
                placeholder={t('form.guestsPlaceholder')}
                className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('form.datesPlaceholder')}</span>
              <input
                type="text"
                disabled
                placeholder={t('form.datesPlaceholder')}
                className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-fg font-medium">{t('form.destinationPlaceholder')}</span>
              <input
                type="text"
                disabled
                placeholder={t('form.destinationPlaceholder')}
                className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.messagePlaceholder')}</span>
            <textarea
              disabled
              rows={5}
              placeholder={t('form.messagePlaceholder')}
              className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
            />
          </label>
          <p className="text-muted mt-2 text-xs italic">{t('form.wip')}</p>
        </form>
      </section>

      {/* Contact */}
      <section
        aria-labelledby="mice-contact-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="mice-contact-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('contact.title')}
        </h2>
        <p className="text-fg mt-3 break-all text-sm font-medium">{t('contact.email')}</p>
        <p className="text-muted mt-1 text-xs">{t('contact.responseSLA')}</p>
        <p className="text-muted mt-3 text-xs italic">{t('contact.altCanal')}</p>
      </section>

      <ConciergeSisterLinks currentSlug="mice" />

      {/* FAQ */}
      <section aria-labelledby="mice-faq-title" className="border-border border-t pt-10">
        <h2 id="mice-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
