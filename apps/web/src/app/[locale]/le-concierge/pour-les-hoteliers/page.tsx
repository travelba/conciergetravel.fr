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
 * `/le-concierge/pour-les-hoteliers` — B2B page (Vague 5 P1).
 *
 * Audience: Palace + 5★ hoteliers considering joining the catalogue.
 * Surfaces the 5 partnership benefits, the 6 selection criteria
 * (mirroring `methode-editoriale`), the 4-step application process,
 * the no-pay-to-play stance, contact for partenariats@.
 *
 * JSON-LD: `Service` typed as `B2BService` with `serviceArea: FR` +
 * `provider: Organization` (shared `@id` with all concierge pages).
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
  const t = await getTranslations({ locale, namespace: 'conciergeHoteliers' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/pour-les-hoteliers' });
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

export default async function ConciergeHoteliersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeHoteliers' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/pour-les-hoteliers' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const benefits = t.raw('benefits.items') as BenefitItem[];
  const criteria = t.raw('criteria.items') as string[];
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
    serviceType: 'HotelDistribution',
    audience: {
      '@type': 'BusinessAudience',
      name: 'Palace & 5-star hoteliers',
      audienceType: 'Hotelier',
    },
    areaServed: { '@type': 'Country', name: 'FR' },
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
        aria-labelledby="hoteliers-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="hoteliers-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 5 benefits */}
      <section aria-labelledby="benefits-title" className="mb-14">
        <h2 id="benefits-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('benefits.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {benefits.map((b) => (
            <article key={b.title} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-lg">{b.title}</h3>
              <p className="text-muted mt-2 text-sm">{b.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Criteria */}
      <section
        aria-labelledby="criteria-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="criteria-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('criteria.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('criteria.lede')}</p>
        <ul className="mt-4 flex flex-col gap-2">
          {criteria.map((c) => (
            <li key={c.slice(0, 40)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                ✓
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
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

      {/* No pay-to-play */}
      <section
        aria-labelledby="no-pay-title"
        className="mb-14 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/30 p-6 md:p-8"
      >
        <h2 id="no-pay-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('noPayToPlay.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('noPayToPlay.body')}</p>
      </section>

      {/* Contact */}
      <section
        aria-labelledby="contact-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="contact-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('contact.title')}
        </h2>
        <p className="text-fg mt-3 break-all text-sm font-medium">{t('contact.email')}</p>
        <p className="text-muted mt-1 text-xs">{t('contact.responseSLA')}</p>
        <p className="text-muted mt-3 text-xs italic">{t('contact.altCanal')}</p>
      </section>

      <ConciergeSisterLinks currentSlug="hoteliers" />

      {/* FAQ */}
      <section aria-labelledby="hoteliers-faq-title" className="border-border border-t pt-10">
        <h2 id="hoteliers-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
