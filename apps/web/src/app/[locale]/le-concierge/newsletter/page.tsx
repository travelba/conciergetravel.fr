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
 * `/le-concierge/newsletter` — newsletter sign-up + editorial
 * promise (Vague 5 P1).
 *
 * Lightweight page positioning the editorial cadence and the
 * RGPD-clean sign-up flow. Form is a placeholder (disabled inputs)
 * — Brevo double opt-in integration ships in a follow-up dedicated
 * PR (skill `email-workflow-automation`).
 *
 * JSON-LD: `Service` typed editorial publication + `BreadcrumbList`.
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
  const t = await getTranslations({ locale, namespace: 'conciergeNewsletter' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/newsletter' });
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

interface PromiseItem {
  readonly title: string;
  readonly body: string;
}

export default async function ConciergeNewsletterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeNewsletter' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/newsletter' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const promiseItems = t.raw('promise.items') as PromiseItem[];
  const sampleItems = t.raw('sampleContent.items') as string[];
  const rgpdItems = t.raw('rgpd.items') as string[];

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
    serviceType: 'EditorialPublication',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t('title'),
      itemListElement: [
        {
          '@type': 'Offer',
          name: t('title'),
          description: t('aeoAnswer', { date: freshnessDate }),
          price: '0',
          priceCurrency: 'EUR',
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

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <JsonLdScript data={serviceJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

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
        aria-labelledby="newsletter-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="newsletter-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* Editorial promise */}
      <section aria-labelledby="promise-title" className="mb-14">
        <h2 id="promise-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('promise.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {promiseItems.map((item) => (
            <article key={item.title} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-base">{item.title}</h3>
              <p className="text-muted mt-2 text-sm">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Sample content */}
      <section
        aria-labelledby="sample-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="sample-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('sampleContent.title')}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {sampleItems.map((item) => (
            <li key={item.slice(0, 30)} className="text-fg text-sm">
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Form (placeholder) */}
      <section
        aria-labelledby="newsletter-form-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="newsletter-form-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('form.title')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('form.lede')}</p>
        <form className="mt-6 flex flex-col gap-4 opacity-80">
          {/* Disabled placeholder — Brevo double opt-in integration
              ships in a follow-up PR (skill `email-workflow-automation`).
              Email fallback surfaced via the WIP disclaimer. */}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.emailPlaceholder')}</span>
            <input
              type="email"
              disabled
              placeholder={t('form.emailPlaceholder')}
              className="border-border bg-bg/60 text-fg rounded-md border px-3 py-2 outline-none disabled:cursor-not-allowed"
            />
          </label>
          <label className="text-muted flex items-start gap-2 text-xs">
            <input type="checkbox" disabled className="mt-0.5 disabled:cursor-not-allowed" />
            <span>{t('form.consent')}</span>
          </label>
          <button
            type="button"
            disabled
            className="bg-fg/40 text-bg w-fit rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            {t('form.submit')}
          </button>
          <p className="text-muted mt-2 text-xs italic">{t('form.wip')}</p>
        </form>
      </section>

      {/* RGPD */}
      <section
        aria-labelledby="rgpd-title"
        className="mb-14 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/30 p-6 md:p-8"
      >
        <h2 id="rgpd-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('rgpd.title')}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {rgpdItems.map((item) => (
            <li key={item.slice(0, 40)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                §
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
