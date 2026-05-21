import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { JsonLd } from '@mch/seo';

import {
  OCCASION_NAV_ENTRIES,
  SAISON_NAV_ENTRIES,
  THEME_NAV_ENTRIES,
  pickEntryLabel,
  type NavLabeledEntry,
} from '@/components/layout/nav-data';
import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/inspiration` — hub thèmes × occasions × saisons (ADR-0014 mega-menu 3).
 *
 * Aggregates the three inspiration axes declared in `axes.ts` into
 * three columns. Each link opens a ranking matrix page
 * (`/classements/[axe]/[valeur]`) that already exists.
 *
 * - JSON-LD: `CollectionPage` (the page itself) + `BreadcrumbList`.
 *   No `ItemList` here — that would compete with the per-axis pages.
 * - Pure Server Component, no I/O (all data is static from `axes.ts`).
 * - `force-dynamic` because of the CSP nonce contract on JSON-LD.
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 * @see scripts/editorial-pilot/src/rankings/axes.ts
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
  const t = await getTranslations({ locale, namespace: 'inspiration' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/inspiration' });

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

export default async function InspirationHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'inspiration' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/inspiration' })}`;

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // CollectionPage: declares the page as an editorial collection of
  // hubs. We DO NOT emit an ItemList here so this page does not
  // compete in search with the per-axis classement pages.
  const collectionPageJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    name: t('title'),
    description: t('lede'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t('title'), url },
    ]),
  );

  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const todayIso = new Date().toISOString();

  interface FaqItem {
    readonly q: string;
    readonly a: string;
  }
  const faqItems = t.raw('faqItems') as FaqItem[];

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={collectionPageJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
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
        <p className="text-muted mt-3 text-base md:text-lg">{t('lede')}</p>
        <LastUpdatedBadge isoDate={todayIso} locale={locale} variant="inline" />
      </header>

      <HubAeoSection
        question={t('aeoQuestion')}
        answer={t('aeoAnswer', { date: freshnessDate })}
        headingId="inspiration-aeo-title"
      />

      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <InspirationColumn
          title={t('themes.title')}
          lede={t('themes.lede')}
          axe="theme"
          entries={THEME_NAV_ENTRIES}
          locale={locale}
        />
        <InspirationColumn
          title={t('occasions.title')}
          lede={t('occasions.lede')}
          axe="occasion"
          entries={OCCASION_NAV_ENTRIES}
          locale={locale}
        />
        <InspirationColumn
          title={t('saisons.title')}
          lede={t('saisons.lede')}
          axe="saison"
          entries={SAISON_NAV_ENTRIES}
          locale={locale}
        />
      </div>

      <HubFaqSection
        heading={t('faqTitle')}
        items={faqItems.map((it) => ({ question: it.q, answer: it.a }))}
      />
    </main>
  );
}

interface InspirationColumnProps {
  readonly title: string;
  readonly lede: string;
  readonly axe: 'theme' | 'occasion' | 'saison';
  readonly entries: readonly NavLabeledEntry[];
  readonly locale: Locale;
}

function InspirationColumn({
  title,
  lede,
  axe,
  entries,
  locale,
}: InspirationColumnProps): ReactElement {
  return (
    <section aria-labelledby={`col-${axe}`} className="flex flex-col gap-4">
      <header>
        <h2 id={`col-${axe}`} className="text-fg font-serif text-xl sm:text-2xl">
          {title}
        </h2>
        <p className="text-muted mt-1 text-sm">{lede}</p>
      </header>
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <li key={entry.slug}>
            <Link
              href={{
                pathname: '/classements/[axe]/[valeur]',
                params: { axe, valeur: entry.slug },
              }}
              className="border-border bg-bg hover:bg-muted/5 text-fg group flex items-center justify-between rounded-md border px-4 py-2.5 text-sm transition hover:border-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span>{pickEntryLabel(entry, locale)}</span>
              <span aria-hidden className="text-muted group-hover:text-amber-700">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
