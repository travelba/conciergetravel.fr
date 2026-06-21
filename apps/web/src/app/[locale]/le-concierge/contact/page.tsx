import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { submitContactRequest } from '@/server/contact/contact-request';

/**
 * `/le-concierge/contact` — institutional contact page (Vague 5 P0
 * of the 3-piliers audit). Required by RGPD / French Code du tourisme
 * for transparent identification of the editor.
 *
 * Coverage:
 *   - Three contact channels (phone, email, form) with hours/SLA.
 *   - Editor identity (legal block — company name, IATA, APST, DPO).
 *   - Form placeholder (no live submit yet — points to the
 *     `/api/agent/contact` endpoint planned in PR11 for the agentic
 *     surface; for now displays a "WIP" disclaimer with the email
 *     fallback).
 *   - 6 Q&A FAQ (reply time, languages, emergency, agency vs
 *     platform, GDPR rights, spontaneous hotel applications).
 *   - `ContactPage` + `Organization` + `FAQPage` + `BreadcrumbList`
 *     JSON-LD.
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
  const t = await getTranslations({ locale, namespace: 'conciergeContact' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/contact' });
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

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

type ContactStatus = 'sent' | 'rate_limited' | 'error';

function parseStatus(value: string | string[] | undefined): ContactStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'sent' || raw === 'rate_limited' || raw === 'error' ? raw : null;
}

export default async function ConciergeContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeContact' });

  const sp = await searchParams;
  const status = parseStatus(sp['status']);
  const submittedRef = typeof sp['ref'] === 'string' ? sp['ref'] : undefined;

  const contactPath = getPathname({ locale, href: '/le-concierge/contact' });

  /**
   * Server action — progressive-enhancement submit (works without client JS).
   * Validates + persists via `submitContactRequest`, then redirects back with
   * a `status` (+`ref`) query so the banner renders. Honeypot `website` is
   * silently treated as success. See R1.5 in PROJET-MASTER-PLAN.md.
   */
  async function submitContactAction(formData: FormData): Promise<void> {
    'use server';
    const honeypot = String(formData.get('website') ?? '');
    if (honeypot.length > 0) {
      redirect(`${contactPath}?status=sent`);
    }

    const hdrs = await headers();
    const forwarded = hdrs.get('x-forwarded-for') ?? '';
    const clientIp = forwarded.split(',')[0]?.trim();

    const phoneRaw = String(formData.get('phone') ?? '').trim();

    const result = await submitContactRequest({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      subject: String(formData.get('subject') ?? ''),
      message: String(formData.get('message') ?? ''),
      locale,
      source: 'contact_page',
      ...(phoneRaw.length > 0 ? { phone: phoneRaw } : {}),
      ...(clientIp !== undefined && clientIp.length > 0 ? { clientIp } : {}),
    });

    if (result.ok) {
      redirect(`${contactPath}?status=sent&ref=${encodeURIComponent(result.value.requestRef)}`);
    }
    if (result.error.kind === 'duplicate') {
      redirect(`${contactPath}?status=sent&ref=${encodeURIComponent(result.error.requestRef)}`);
    }
    if (result.error.kind === 'rate_limited') {
      redirect(`${contactPath}?status=rate_limited`);
    }
    redirect(`${contactPath}?status=error`);
  }

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/contact' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const faqItems = t.raw('faq') as FaqItem[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // ContactPage — Schema.org canonical type for contact-purpose pages.
  // The `mainEntityOfPage` Organization is what gets surfaced in the
  // Google Knowledge Panel (`contactPoint` array).
  const contactPageJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'ContactPage',
    '@id': `${url}#contactpage`,
    name: t('title'),
    description: t('lede'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    mainEntity: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
      url: `${origin}/`,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          telephone: t('channels.phone.value'),
          email: t('channels.email.value'),
          availableLanguage: ['French', 'English'],
          hoursAvailable: 'Mo-Sa 09:00-19:00',
          areaServed: 'FR',
        },
        {
          '@type': 'ContactPoint',
          contactType: 'data protection officer',
          email: 'dpo@myconciergehotel.com',
          areaServed: 'FR',
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
    <main className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <JsonLdScript data={contactPageJsonLd} nonce={nonce} />
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
        aria-labelledby="contact-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="contact-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* 3 channels */}
      <section aria-labelledby="channels-title" className="mb-14">
        <h2 id="channels-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('channels.title')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {(['phone', 'email', 'form'] as const).map((key) => (
            <article key={key} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-lg">{t(`channels.${key}.title`)}</h3>
              <p className="text-muted mt-2 text-sm">{t(`channels.${key}.body`)}</p>
              <p className="text-fg mt-3 break-all text-sm font-medium">
                {t(`channels.${key}.value`)}
              </p>
              {key !== 'form' ? (
                <p className="text-muted mt-1 text-xs">{t(`channels.${key}.hours`)}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* Contact form — live (R1.5) */}
      <section
        aria-labelledby="form-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="form-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('form.title')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('form.lede')}</p>

        {status === 'sent' ? (
          <div
            data-testid="contact-success"
            role="status"
            className="mt-6 rounded-md border border-green-600/30 bg-green-600/10 p-4 text-sm text-green-800 dark:text-green-300"
          >
            <p className="font-medium">{t('form.success')}</p>
            {submittedRef !== undefined ? (
              <p className="mt-1 font-mono text-xs tracking-wide">
                {t('form.successRef', { ref: submittedRef })}
              </p>
            ) : null}
          </div>
        ) : null}
        {status === 'rate_limited' ? (
          <div
            data-testid="contact-error"
            role="alert"
            className="mt-6 rounded-md border border-amber-600/30 bg-amber-600/10 p-4 text-sm text-amber-800 dark:text-amber-300"
          >
            {t('form.rateLimited')}
          </div>
        ) : null}
        {status === 'error' ? (
          <div
            data-testid="contact-error"
            role="alert"
            className="mt-6 rounded-md border border-red-600/30 bg-red-600/10 p-4 text-sm text-red-800 dark:text-red-300"
          >
            {t('form.error')}
          </div>
        ) : null}

        <form
          action={submitContactAction}
          data-testid="contact-form"
          className="mt-6 grid grid-cols-1 gap-4"
        >
          {/* Honeypot — visually hidden, off the tab order. Bots fill it. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.namePlaceholder')}</span>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              data-testid="contact-name"
              placeholder={t('form.namePlaceholder')}
              className="border-border bg-bg text-fg focus:ring-current/20 rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.emailPlaceholder')}</span>
            <input
              type="email"
              name="email"
              required
              maxLength={200}
              data-testid="contact-email"
              placeholder={t('form.emailPlaceholder')}
              className="border-border bg-bg text-fg focus:ring-current/20 rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.subjectPlaceholder')}</span>
            <input
              type="text"
              name="subject"
              required
              maxLength={200}
              data-testid="contact-subject"
              placeholder={t('form.subjectPlaceholder')}
              className="border-border bg-bg text-fg focus:ring-current/20 rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('form.messagePlaceholder')}</span>
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              data-testid="contact-message"
              placeholder={t('form.messagePlaceholder')}
              className="border-border bg-bg text-fg focus:ring-current/20 rounded-md border px-3 py-2 outline-none focus:ring-2"
            />
          </label>
          <p className="text-muted text-xs">{t('form.consent')}</p>
          <button
            type="submit"
            data-testid="contact-submit"
            className="bg-fg text-bg hover:bg-fg/90 inline-flex w-fit items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition"
          >
            {t('form.submit')}
          </button>
        </form>
      </section>

      {/* Legal identity */}
      <section aria-labelledby="legal-title" className="mb-14">
        <h2 id="legal-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('legal.title')}
        </h2>
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[max-content_1fr]">
          {(['company', 'address', 'iata', 'guarantee', 'dpo', 'press'] as const).map((key) => (
            <div key={key} className="contents">
              <dt className="text-muted text-xs uppercase tracking-wider">{key}</dt>
              <dd className="text-fg text-sm">{t(`legal.${key}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* FAQ */}
      <section aria-labelledby="contact-faq-title" className="border-border border-t pt-10">
        <h2 id="contact-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
