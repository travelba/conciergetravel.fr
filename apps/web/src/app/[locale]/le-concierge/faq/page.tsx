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
 * `/le-concierge/faq` — canonical general FAQ hub (Vague 5 P0,
 * AEO-premium surface).
 *
 * Hosts 35 Q&A grouped by 6 themes (agency, booking, pricing,
 * loyalty, modify, account). Each FAQ item is also linked from the
 * sidebar of its theme so a returning user can scroll-jump directly
 * to the right section.
 *
 * Why 35 Q&A and not 5-10:
 * The skill `geo-llm-optimization` §FAQ extraction notes that
 * pages where the entire FAQ is in the DOM at load (no JS-driven
 * accordion) get cited more often by AI Overviews. We accept the
 * extra DOM weight on this single canonical hub to maximise the
 * citation surface — every Q the user / LLM might ask is here.
 *
 * JSON-LD: single canonical `FAQPage` over all 35 items (ADR-0011
 * C1 — exactly one FAQPage per page), `BreadcrumbList`, +
 * `Organization.actionableFeedbackPolicy` pointing at /contact.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const THEME_ORDER = ['agency', 'booking', 'pricing', 'loyalty', 'modify', 'account'] as const;
type Theme = (typeof THEME_ORDER)[number];

function isTheme(s: string): s is Theme {
  return (THEME_ORDER as readonly string[]).includes(s);
}

interface FaqItem {
  readonly theme: string;
  readonly q: string;
  readonly a: string;
}

interface ThemeMeta {
  readonly id: Theme;
  readonly title: string;
  readonly lede: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'conciergeFaq' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/le-concierge/faq' });
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

export default async function ConciergeFaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'conciergeFaq' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/le-concierge/faq' })}`;
  const homeUrl = `${origin}${getPathname({ locale, href: '/' })}`;
  const conciergeUrl = `${origin}${getPathname({ locale, href: '/le-concierge' })}`;

  const lastReviewedIso = t('lastReviewed');
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(lastReviewedIso));

  const allItems = t.raw('items') as FaqItem[];

  // Group items by theme — preserving the declaration order so
  // editors can re-sequence the JSON without touching the page.
  const itemsByTheme = new Map<Theme, FaqItem[]>();
  for (const theme of THEME_ORDER) {
    itemsByTheme.set(theme, []);
  }
  for (const item of allItems) {
    if (!isTheme(item.theme)) continue;
    itemsByTheme.get(item.theme)?.push(item);
  }

  const themeMetas: ThemeMeta[] = THEME_ORDER.map((id) => ({
    id,
    title: t(`themes.${id}.title`),
    lede: t(`themes.${id}.lede`),
  }));

  // ─── JSON-LD ───────────────────────────────────────────────────────────

  // FAQPage — canonical single emission across all 35 items per
  // ADR-0011 C1. Order matches the visible accordion so the JSON-LD
  // and the DOM tell the same story.
  const faqJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.faqPageJsonLd(allItems.map((it) => ({ question: it.q, answer: it.a }))),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: homeUrl },
      { name: t('breadcrumbConcierge'), url: conciergeUrl },
      { name: t('title'), url },
    ]),
  );

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={faqJsonLd} nonce={nonce} />
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

      {/* AEO — entry-point answer + freshness cue */}
      <section
        data-aeo
        aria-labelledby="faq-aeo-title"
        className="border-border bg-bg mb-12 rounded-lg border p-5"
      >
        <h2 id="faq-aeo-title" className="text-fg font-serif text-lg">
          {t('aeoQuestion')}
        </h2>
        <p className="text-muted mt-2 text-sm">{t('aeoAnswer', { date: freshnessDate })}</p>
      </section>

      {/* Theme navigation strip (scroll-spy anchors) */}
      <nav
        aria-label={t('title')}
        className="border-border bg-bg sticky top-16 z-10 mb-12 flex flex-wrap gap-2 rounded-lg border p-3"
      >
        {themeMetas.map((m) => (
          <a
            key={m.id}
            href={`#theme-${m.id}`}
            className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
          >
            {m.title}
            <span className="text-muted ml-1.5">({itemsByTheme.get(m.id)?.length ?? 0})</span>
          </a>
        ))}
      </nav>

      {/* 6 themed sections */}
      <div className="flex flex-col gap-12">
        {themeMetas.map((meta) => {
          const items = itemsByTheme.get(meta.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section
              key={meta.id}
              id={`theme-${meta.id}`}
              aria-labelledby={`theme-${meta.id}-title`}
              className="scroll-mt-32"
            >
              <header className="border-border mb-5 border-b pb-3">
                <h2
                  id={`theme-${meta.id}-title`}
                  className="text-fg font-serif text-2xl sm:text-3xl"
                >
                  {meta.title}
                </h2>
                <p className="text-muted mt-1 text-sm">{meta.lede}</p>
              </header>
              <div className="flex flex-col gap-3">
                {items.map((item, idx) => (
                  <details
                    key={item.q}
                    /*
                      Open the first item of each theme by default so
                      scroll-jumping to a theme surfaces an answer at
                      load — improves LLM extraction of theme-anchored
                      content per skill GEO §FAQ.
                    */
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
          );
        })}
      </div>

      {/* CTA strip */}
      <section
        aria-labelledby="faq-cta-title"
        className="border-border bg-muted/5 mt-14 rounded-lg border p-6 md:p-8"
      >
        <h2 id="faq-cta-title" className="text-fg font-serif text-xl sm:text-2xl">
          {pickByLocale(locale, 'Votre question n’y figure pas ?', 'Your question is not listed?')}
        </h2>
        <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
          {pickByLocale(
            locale,
            'Notre conciergerie répond sous 24h ouvrées. Choisissez le canal qui vous convient.',
            'Our concierge replies within 24 business hours. Pick the channel that suits you.',
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {/*
            Link target — defaults to the institutional `/le-concierge`
            page until PR9 (contact page) lands on main. Once both
            PRs are merged, this can switch to `/le-concierge/contact`
            (typed `Href`) in a follow-up.
          */}
          <Link
            href="/le-concierge"
            className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
          >
            {pickByLocale(locale, 'Nous contacter', 'Contact us')} →
          </Link>
          <Link
            href="/le-concierge"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {pickByLocale(locale, 'Revenir au Concierge', 'Back to the Concierge')} →
          </Link>
        </div>
      </section>
    </main>
  );
}

// Tiny inline locale picker — keeps the CTA copy out of the i18n
// JSON because the conciergeFaq namespace is already 35-item heavy
// and these 4 strings are page-only.
function pickByLocale(locale: Locale, fr: string, en: string): string {
  return locale === 'en' ? en : fr;
}
