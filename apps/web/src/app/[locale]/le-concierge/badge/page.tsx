import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { JsonLd, buildPageMetadata } from '@mch/seo';

import { BadgeEmbedSnippet } from '@/components/concierge/badge-embed-snippet';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, routing, type Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';
import {
  CATALOGUE_COUNTRIES,
  CATALOGUE_PUBLISHED,
  formatCatalogueCount,
} from '@/lib/catalogue-stats';
import { env } from '@/lib/env';

/**
 * `/le-concierge/badge` — the "Selected by MyConciergeHotel" badge page
 * (WS-A, master plan 2026-07 — self-serve authority lever after PO
 * decision D4 deferred human outreach).
 *
 * Audience: the {@link CATALOGUE_PUBLISHED} hotels of the catalogue.
 * They embed the badge on their own (high-authority) domains with a
 * followed link back to their fiche — the only backlink lever that
 * needs no outreach.
 *
 * The page:
 *   1. AEO block (citable one-liner for AI Overviews).
 *   2. Who the badge is for (the published catalogue).
 *   3. What it certifies (8-criteria selection, no pay-to-play — points
 *      back to `/le-concierge/methode-editoriale`).
 *   4. How to embed it — copyable HTML snippet with a documented slug
 *      placeholder + both badge variants (light / dark).
 *   5. Terms of use + FAQ.
 *
 * JSON-LD: `WebPage` + `BreadcrumbList` + `FAQPage`.
 * `force-dynamic` per the CSP nonce contract on JSON-LD pages
 * (see `components/seo/json-ld.tsx`).
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * Canonical production origin baked into the copyable embed snippet and
 * the badge asset URLs. Hard-pinned (not `env.NEXT_PUBLIC_SITE_URL`) so
 * the code hoteliers copy is always correct — even when the page is
 * served from a preview or localhost during QA.
 */
const CANONICAL_ORIGIN = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

function badgePathFor(l: Locale): string {
  return getPathname({ locale: l, href: '/le-concierge/badge' });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'conciergeBadge' });
  const origin = siteOrigin();

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDesc'),
    canonical: `${origin}${badgePathFor(locale)}`,
    localeAlternates: routing.locales.map((l) => ({
      locale: l,
      url: `${origin}${badgePathFor(l)}`,
    })),
    siteName: 'MyConciergeHotel',
  });
}

interface CertifyItem {
  readonly title: string;
  readonly body: string;
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergeBadgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeBadge' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${badgePathFor(locale)}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const hotels = formatCatalogueCount(CATALOGUE_PUBLISHED, locale);
  const countries = CATALOGUE_COUNTRIES;

  const certifyItems = t.raw('certifies.items') as CertifyItem[];
  const termsItems = t.raw('terms.items') as string[];
  const faqItems = t.raw('faq') as FaqItem[];

  // ─── Embed snippet (documented slug placeholder, followed link) ──────────
  const placeholderSlug = locale === 'en' ? 'YOUR-HOTEL-SLUG' : 'VOTRE-SLUG-HOTEL';
  const badgeAlt =
    locale === 'en' ? 'Selected by MyConciergeHotel' : 'Sélectionné par MyConciergeHotel';
  const dofollowComment =
    locale === 'en'
      ? 'Selected by MyConciergeHotel — followed link (do not add rel="nofollow")'
      : 'Sélectionné par MyConciergeHotel — lien suivi (ne pas ajouter rel="nofollow")';
  const embedSnippet = [
    `<!-- ${dofollowComment} -->`,
    `<a href="${CANONICAL_ORIGIN}/hotel/${placeholderSlug}" title="${badgeAlt}">`,
    `  <img src="${CANONICAL_ORIGIN}/badge/mch-selected-badge-light.svg"`,
    `       alt="${badgeAlt}" width="360" height="112" loading="lazy" />`,
    `</a>`,
  ].join('\n');

  // ─── JSON-LD ─────────────────────────────────────────────────────────────
  const webPageJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: t('title'),
    description: t('metaDesc'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    isPartOf: { '@type': 'WebSite', '@id': `${origin}/#website` },
    about: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
    },
    dateModified: lastReviewedIso,
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
      <JsonLdScript data={webPageJsonLd} nonce={nonce} />
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

      {/* Hero badge preview */}
      <section aria-label={t('eyebrow')} className="mb-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, intrinsic dims set, no optimisation needed */}
        <img
          src="/badge/mch-selected-badge-light.svg"
          alt={badgeAlt}
          width={360}
          height={112}
          className="h-auto w-[360px] max-w-full"
        />
      </section>

      {/* AEO — primary citation surface */}
      <section
        data-aeo
        aria-labelledby="badge-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="badge-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">
          {t('aeoAnswer', { date: freshnessDate, hotels, countries })}
        </p>
      </section>

      {/* Audience */}
      <section aria-labelledby="badge-audience-title" className="mb-14">
        <h2 id="badge-audience-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('audience.title')}
        </h2>
        <p className="text-muted mt-3 max-w-3xl text-sm md:text-base">
          {t('audience.body', { hotels, countries })}
        </p>
      </section>

      {/* What it certifies */}
      <section aria-labelledby="badge-certifies-title" className="mb-14">
        <h2 id="badge-certifies-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('certifies.title')}
        </h2>
        <p className="text-muted mt-3 max-w-3xl text-sm md:text-base">{t('certifies.lede')}</p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {certifyItems.map((c) => (
            <article key={c.title} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-lg">{c.title}</h3>
              <p className="text-muted mt-2 text-sm">{c.body}</p>
            </article>
          ))}
        </div>
        <p className="text-muted mt-4 text-sm">
          <Link
            href="/le-concierge/methode-editoriale"
            className="text-fg underline underline-offset-4"
          >
            {t('related.methodTitle')} →
          </Link>
        </p>
      </section>

      {/* How to embed */}
      <section
        aria-labelledby="badge-embed-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="badge-embed-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('embed.title')}
        </h2>
        <p className="text-muted mt-3 max-w-3xl text-sm md:text-base">{t('embed.lede')}</p>

        {/* Both variants */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <figure className="border-border bg-bg flex flex-col items-center gap-3 rounded-lg border p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG asset */}
            <img
              src="/badge/mch-selected-badge-light.svg"
              alt={badgeAlt}
              width={360}
              height={112}
              className="h-auto w-full max-w-[320px]"
            />
            <figcaption className="text-muted text-xs uppercase tracking-wider">
              {t('embed.previewLightLabel')}
            </figcaption>
          </figure>
          <figure className="border-border flex flex-col items-center gap-3 rounded-lg border bg-[#3a352d] p-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG asset */}
            <img
              src="/badge/mch-selected-badge-dark.svg"
              alt={badgeAlt}
              width={360}
              height={112}
              className="h-auto w-full max-w-[320px]"
            />
            <figcaption className="text-xs uppercase tracking-wider text-[#cabf9d]">
              {t('embed.previewDarkLabel')}
            </figcaption>
          </figure>
        </div>

        {/* Copyable snippet */}
        <h3 className="text-fg mt-8 font-serif text-lg">{t('embed.snippetLabel')}</h3>
        <div className="mt-3">
          <BadgeEmbedSnippet
            snippet={embedSnippet}
            copyLabel={t('embed.copy')}
            copiedLabel={t('embed.copied')}
          />
        </div>

        {/* Placeholder documentation */}
        <div className="mt-6 space-y-2">
          <h3 className="text-fg font-serif text-base">{t('embed.placeholderTitle')}</h3>
          <p className="text-muted text-sm">{t('embed.placeholderNote')}</p>
          <p className="text-muted text-sm italic">{t('embed.exampleNote')}</p>
          <p className="text-muted text-sm">{t('embed.darkVariantNote')}</p>
        </div>

        <div className="mt-6 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/30 p-4">
          <p className="text-muted text-sm">{t('embed.dofollowNote')}</p>
          <p className="text-muted mt-2 text-sm">{t('embed.altReminder')}</p>
        </div>
      </section>

      {/* Terms of use */}
      <section
        aria-labelledby="badge-terms-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="badge-terms-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('terms.title')}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {termsItems.map((item) => (
            <li key={item.slice(0, 40)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Related */}
      <section aria-labelledby="badge-related-title" className="border-border mb-14 border-t pt-10">
        <h2
          id="badge-related-title"
          className="text-muted mb-6 text-xs font-medium uppercase tracking-[0.18em]"
        >
          {t('related.title')}
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/le-concierge/methode-editoriale"
              className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
            >
              <h3 className="text-fg font-serif text-base">{t('related.methodTitle')}</h3>
              <p className="text-muted mt-1.5 text-xs leading-relaxed">{t('related.methodLede')}</p>
            </Link>
          </li>
          <li>
            <Link
              href="/le-concierge/pour-les-hoteliers"
              className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
            >
              <h3 className="text-fg font-serif text-base">{t('related.hoteliersTitle')}</h3>
              <p className="text-muted mt-1.5 text-xs leading-relaxed">
                {t('related.hoteliersLede')}
              </p>
            </Link>
          </li>
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="badge-faq-title" className="border-border border-t pt-10">
        <h2 id="badge-faq-title" className="text-fg mb-6 font-serif text-2xl sm:text-3xl">
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
