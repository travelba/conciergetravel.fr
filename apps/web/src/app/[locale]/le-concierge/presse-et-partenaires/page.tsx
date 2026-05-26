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
 * `/le-concierge/presse-et-partenaires` — press room (Vague 5 P2).
 *
 * Surface for press inquiries (interviews, podcast, conference
 * invitations) and editorial partnerships (co-published articles
 * with luxury / lifestyle media).
 *
 * Lightweight content compared to the EEAT / conversion-critical
 * pages — kit média placeholders (downloads to ship in a follow-up
 * once asset bundles are uploaded to Cloudinary) + 5 sample press
 * mentions + partnership conditions + contact `presse@`.
 *
 * JSON-LD: `WebPage` with `Organization.sameAs[]` (press mentions
 * listed as the agency's web mentions — improves Knowledge Panel
 * authority signals).
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
  const t = await getTranslations({ locale, namespace: 'conciergePresse' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/presse-et-partenaires' });
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

interface KitItem {
  readonly title: string;
  readonly body: string;
}

export default async function ConciergePressePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergePresse' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/presse-et-partenaires' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const kitItems = t.raw('kit.items') as KitItem[];
  const pressItems = t.raw('press.items') as string[];
  const partnershipsItems = t.raw('partnerships.items') as string[];

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  const webPageJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: t('title'),
    description: t('metaDesc'),
    url,
    inLanguage: locale === 'en' ? 'en' : 'fr',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${origin}#website`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'MyConciergeHotel',
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
      <JsonLdScript data={webPageJsonLd} nonce={nonce} />
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
        aria-labelledby="press-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="press-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* Media kit */}
      <section aria-labelledby="kit-title" className="mb-14">
        <h2 id="kit-title" className="text-fg font-serif text-2xl sm:text-3xl">
          {t('kit.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('kit.lede')}</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {kitItems.map((item) => (
            <article key={item.title} className="border-border bg-bg rounded-lg border p-5">
              <h3 className="text-fg font-serif text-base">{item.title}</h3>
              <p className="text-muted mt-2 text-sm">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Press mentions */}
      <section
        aria-labelledby="press-title"
        className="border-border bg-muted/5 mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="press-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('press.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('press.lede')}</p>
        <ul className="mt-4 flex flex-col gap-2">
          {pressItems.map((item) => (
            <li key={item.slice(0, 40)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                ⊕
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-4 text-xs italic">{t('press.note')}</p>
      </section>

      {/* Partnerships */}
      <section aria-labelledby="partnerships-title" className="mb-14">
        <h2 id="partnerships-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('partnerships.title')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">{t('partnerships.lede')}</p>
        <ul className="mt-4 flex flex-col gap-2">
          {partnershipsItems.map((item) => (
            <li key={item.slice(0, 40)} className="text-muted flex items-start gap-2 text-sm">
              <span aria-hidden className="mt-1 text-amber-700">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-fg mt-4 text-sm">{t('partnerships.contact')}</p>
      </section>

      {/* Press contact */}
      <section
        aria-labelledby="press-contact-title"
        className="border-border bg-bg mb-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="press-contact-title" className="text-fg font-serif text-xl sm:text-2xl">
          {t('contact.title')}
        </h2>
        <p className="text-fg mt-3 break-all text-sm font-medium">{t('contact.email')}</p>
        <p className="text-muted mt-1 text-xs">{t('contact.responseSLA')}</p>
        <p className="text-muted mt-3 text-xs italic">{t('contact.altCanal')}</p>
      </section>

      <ConciergeSisterLinks currentSlug="presse" />
    </main>
  );
}
