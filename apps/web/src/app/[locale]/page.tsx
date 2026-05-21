import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { InternationalComingSoon } from '@/components/destinations/international-coming-soon';
import { JsonLdScript } from '@/components/seo/json-ld';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

// The page reads `headers()` to forward the per-request CSP nonce to its
// inline JSON-LD scripts (skill: security-engineering §CSP). That dynamic
// API call also marks the page as fully dynamic; the explicit
// `force-dynamic` keeps the contract grep-able. Re-introducing ISR here
// would silently strip the nonce and the strict-dynamic CSP would block
// the structured data — see `components/seo/json-ld.tsx` for the design.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * Home `generateMetadata` — canonical, hreflang, OG.
 *
 * Without an explicit `generateMetadata` the root layout's metadata only
 * carries the brand title; the home page is the single most important
 * URL of the site and must expose:
 *   - a unique 50-60 char title and 140-160 char meta description
 *   - `alternates.canonical` (relative — middleware normalises locale)
 *   - `alternates.languages` (fr-FR, en, x-default) for hreflang signal
 *   - locale-aware Open Graph (LCP-relevant og:locale)
 *
 * Skill: seo-technical §Metadata baseline + seo-geo.mdc §Metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'homepage' });
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: '/' });
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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('homepage');
  const tCommon = await getTranslations('common');
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const agencyJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.travelAgencyJsonLd({
      name: 'MyConciergeHotel',
      url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
      description:
        'Le concierge en ligne des Palaces et hôtels 5 étoiles en France. Sélection éditoriale, conseils opérationnels par fiche, tarifs nets GDS via notre agence IATA, paiement sécurisé Amadeus, fidélité dès la première nuit.',
      iataCode: 'FR',
    }),
  );

  // WebSite + SearchAction (Google sitelinks search box).
  // Only emitted from the home page — Google requires the `WebSite` node
  // at the site root, not on every page (ADR-0014 §2.2 + seo-geo.mdc).
  const searchUrl = `${siteUrl}${getPathname({ locale, href: '/recherche' })}`;
  const websiteSearchJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: 'MyConciergeHotel',
    url: `${siteUrl}${getPathname({ locale, href: '/' })}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${searchUrl}?destination={search_term_string}`,
      },
      // `query-input` is required by Google for sitelinks search box.
      // The literal string contract is fragile but mandated by schema.org.
      'query-input': 'required name=search_term_string',
    },
  });

  // AEO block (skill: geo-llm-optimization). Short, quotable answer paired
  // with a FAQPage JSON-LD payload so AI Overviews / ChatGPT Search can
  // surface the value-prop verbatim without paraphrasing.
  const aeoQuestion = t('aeo.question');
  const aeoAnswer = t('aeo.answer');
  const homeFaqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd([{ question: aeoQuestion, answer: aeoAnswer }]),
  );

  return (
    <main className="max-w-editorial container mx-auto flex min-h-[60vh] flex-col items-start justify-center gap-6 px-4 py-16 sm:py-24">
      <JsonLdScript data={agencyJsonLd} nonce={nonce} />
      <JsonLdScript data={websiteSearchJsonLd} nonce={nonce} />
      <JsonLdScript data={homeFaqJsonLd} nonce={nonce} />
      <p className="text-muted text-xs uppercase tracking-[0.18em]">
        {tCommon('siteName')} — France
      </p>
      <h1 className="text-fg font-serif text-4xl sm:text-5xl md:text-6xl">{t('title')}</h1>
      {/*
        Secondary signal for the international expansion (Phase 7).
        Stays sober — the brand DNA is France-first, so this sits as a
        subtle eyebrow under the H1 rather than competing with the
        subtitle below.
      */}
      <p className="text-fg/70 -mt-2 font-serif text-base italic sm:text-lg">{t('intlBadge')}</p>
      <p className="text-muted max-w-prose text-lg sm:text-xl">{t('subtitle')}</p>

      <div className="text-muted mt-6 flex flex-wrap items-center gap-3 text-xs">
        <span className="border-border bg-bg rounded-md border px-3 py-1.5">{t('trust.iata')}</span>
        <span className="border-border bg-bg rounded-md border px-3 py-1.5">
          {t('trust.aspst')}
        </span>
        <span className="border-border bg-bg rounded-md border px-3 py-1.5">
          {t('trust.amadeus')}
        </span>
      </div>

      <section
        data-aeo
        aria-labelledby="home-aeo-title"
        className="border-border bg-bg mt-10 max-w-prose rounded-lg border p-5"
      >
        <h2 id="home-aeo-title" className="text-fg font-serif text-lg">
          {aeoQuestion}
        </h2>
        <p className="text-muted mt-2 text-sm">{aeoAnswer}</p>
      </section>

      <InternationalComingSoon locale={locale} />

      <p className="text-muted mt-12 text-sm">{t('comingSoon')}</p>
    </main>
  );
}
