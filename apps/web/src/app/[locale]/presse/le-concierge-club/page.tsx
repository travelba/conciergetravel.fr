import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/presse/le-concierge-club` — Press kit page for Le Concierge Club.
 *
 * Pure editorial content (no auth, no DB): a journalist-friendly
 * one-pager with programme identity, philosophy, numbers, compliance,
 * press FAQ, contacts and asset request flow.
 *
 * `force-dynamic` is required because the page emits JSON-LD blocks
 * (`Article` + `FAQPage` + `BreadcrumbList`) that carry the per-request
 * CSP nonce — see `structured-data-schema-org` §CSP-nonce-contract.
 *
 * Skill: nextjs-app-router + loyalty-program + seo-technical.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const t = await getTranslations({ locale: raw, namespace: 'clubPressKit.meta' });
  const languages = buildHreflangAlternates((loc) =>
    getPathname({ locale: loc, href: '/presse/le-concierge-club' }),
  );
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getPathname({ locale: raw, href: '/presse/le-concierge-club' }),
      languages,
    },
  };
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export default async function ConciergeClubPressKitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [t, tLanding] = await Promise.all([
    getTranslations('clubPressKit'),
    getTranslations('clubLanding'),
  ]);
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const pageUrl = `${origin}${getPathname({ locale, href: '/presse/le-concierge-club' })}`;
  const programUrl = `${origin}${getPathname({ locale, href: '/le-concierge-club' })}`;

  const rawFaq = t.raw('faq') as unknown;
  const faq: ReadonlyArray<FaqItem> = Array.isArray(rawFaq)
    ? (rawFaq.filter(
        (it): it is FaqItem =>
          it !== null &&
          typeof it === 'object' &&
          'q' in it &&
          'a' in it &&
          typeof (it as FaqItem).q === 'string' &&
          typeof (it as FaqItem).a === 'string',
      ) as ReadonlyArray<FaqItem>)
    : [];

  const articleData = JsonLd.withSchemaOrgContext(
    JsonLd.articleJsonLd({
      headline: t('title'),
      description: t('lede'),
      url: pageUrl,
      // The page lives as a static one-pager — `datePublished` defaults
      // to the launch announcement date (2026-05-26). The renderer
      // updates this when the kit is refreshed.
      datePublished: '2026-05-26',
      dateModified: new Date().toISOString().slice(0, 10),
      author: { name: 'MyConciergeHotel.com', url: origin },
      publisher: {
        name: 'MyConciergeHotel.com',
      },
      inLanguage: locale === 'fr' ? 'fr-FR' : 'en',
    }),
  );

  const breadcrumbData = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: locale === 'fr' ? 'Accueil' : 'Home',
        url: `${origin}${getPathname({ locale, href: '/' })}`,
      },
      { name: tLanding('title'), url: programUrl },
      { name: t('title'), url: pageUrl },
    ]),
  );

  const faqData =
    faq.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.faqPageJsonLd(faq.map((item) => ({ question: item.q, answer: item.a }))),
        )
      : null;

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={articleData} nonce={nonce} />
      <JsonLdScript data={breadcrumbData} nonce={nonce} />
      {faqData !== null ? <JsonLdScript data={faqData} nonce={nonce} /> : null}

      <header className="mb-10">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">{t('lede')}</p>
      </header>

      <section aria-labelledby="club-press-identity" className="mb-10 grid gap-6 sm:grid-cols-2">
        <article>
          <h2 id="club-press-identity" className="text-fg font-serif text-lg">
            {t('sections.identityTitle')}
          </h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.identityBody')}</p>
        </article>
        <article>
          <h2 className="text-fg font-serif text-lg">{t('sections.philosophyTitle')}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.philosophyBody')}</p>
        </article>
        <article>
          <h2 className="text-fg font-serif text-lg">{t('sections.numbersTitle')}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.numbersBody')}</p>
        </article>
        <article>
          <h2 className="text-fg font-serif text-lg">{t('sections.complianceTitle')}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.complianceBody')}</p>
        </article>
      </section>

      {faq.length > 0 ? (
        <section aria-labelledby="club-press-faq" className="mb-12">
          <h2 id="club-press-faq" className="text-fg mb-4 font-serif text-2xl">
            {t('faqHeading')}
          </h2>
          <ul className="flex flex-col gap-3">
            {faq.map((item, idx) => (
              <li key={idx}>
                <details
                  className="border-border bg-bg rounded-md border px-4 py-3"
                  open={idx === 0}
                >
                  <summary className="text-fg cursor-pointer text-sm font-medium">{item.q}</summary>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="club-press-contacts" className="mb-12">
        <h2 id="club-press-contacts" className="text-fg mb-4 font-serif text-2xl">
          {t('contactsTitle')}
        </h2>
        <ul className="text-muted flex flex-col gap-2 text-sm leading-relaxed">
          <li>{t('contacts.press')}</li>
          <li>{t('contacts.partnerships')}</li>
          <li>{t('contacts.general')}</li>
        </ul>
      </section>

      <section aria-labelledby="club-press-assets" className="mb-12">
        <h2 id="club-press-assets" className="text-fg mb-4 font-serif text-2xl">
          {t('assetsTitle')}
        </h2>
        <p className="text-muted text-sm leading-relaxed">{t('assetsNote')}</p>
      </section>

      <p className="text-muted mt-8 text-xs">
        <Link href="/le-concierge-club" className="underline">
          {tLanding('title')}
        </Link>
      </p>
    </main>
  );
}
