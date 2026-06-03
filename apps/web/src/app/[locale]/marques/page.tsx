import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

/**
 * `/marques` — index of all hotel brands surfaced by the catalogue.
 *
 * Renders a card per `KNOWN_BRANDS` entry, with the per-brand count of
 * published hotels and a `ItemList` JSON-LD enumerating the brand
 * detail URLs (`/marque/[brandSlug]`).
 *
 * Brands with 0 published hotels are still rendered (visible in the
 * grid but flagged as `empty`) so the UX stays predictable as the
 * catalogue grows.
 *
 * @see docs/adr/0014-menu-architecture-v2.md §2.1 — mega-menu 1 col 3
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
  const t = await getTranslations({ locale, namespace: 'brands' });
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: '/marques' });

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

export default async function BrandsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'brands' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // Compute per-brand counts in a single pass over the published catalogue.
  // Widened to 2500 — large chains (Ritz-Carlton ~100, Four Seasons ~98)
  // can extend past the default 200-row cap.
  const allHotels = await listPublishedHotelsForIndex(2500);
  const counts = new Map<string, number>();
  for (const h of allHotels) {
    // Union of name-regex (legacy) and structured `affiliations[]`
    // (migration 0063). Each hotel counts at most once per brand slug
    // even when both detections agree.
    const matched = new Set<string>();
    const detected = detectBrand(h.nameFr);
    if (detected !== null) matched.add(detected.slug);
    for (const s of h.affiliationBrandSlugs) matched.add(s);
    for (const slug of matched) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  // Render brands by descending count so the most-populated families
  // (Oetker, Dorchester, Cheval Blanc) appear first — same heuristic as
  // the Booking / Hotels.com brand pages.
  const brands = KNOWN_BRANDS.map((b) => ({
    ...b,
    count: counts.get(b.slug) ?? 0,
  })).sort((a, b) => b.count - a.count);

  // Freshness signal (locale-aware month) embedded both in the visible
  // badge and in the AEO answer string — skill `geo-llm-optimization`
  // §Freshness triple-sync.
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

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('breadcrumbHome'), url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t('breadcrumbHotels'), url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
      { name: t('title'), url: `${origin}${getPathname({ locale, href: '/marques' })}` },
    ]),
  );

  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: t('title'),
      items: brands.map((b) => ({
        name: b.label,
        url: `${origin}${getPathname({
          locale,
          href: { pathname: '/marque/[brandSlug]', params: { brandSlug: b.slug } },
        })}`,
      })),
    }),
  );

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />

      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumbHome')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/hotels" className="hover:underline">
              {t('breadcrumbHotels')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {t('title')}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-3 text-base">{t('lede')}</p>
        <LastUpdatedBadge isoDate={todayIso} locale={locale} variant="inline" />
      </header>

      <HubAeoSection
        question={t('aeoQuestion')}
        answer={t('aeoAnswer', { count: brands.length, date: freshnessDate })}
        headingId="brands-aeo-title"
        emitJsonLd={false}
      />

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <li key={b.slug}>
            <Link
              href={{ pathname: '/marque/[brandSlug]', params: { brandSlug: b.slug } }}
              prefetch={false}
              className="border-border bg-bg group block h-full rounded-lg border p-5 transition hover:border-amber-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  {t('eyebrow')}
                </span>
                <span className="text-muted text-xs">{b.count > 0 ? `${b.count}` : '—'}</span>
              </div>
              <h2 className="text-fg mb-2 font-serif text-xl group-hover:text-amber-700">
                {b.label}
              </h2>
              <p className="text-muted text-sm">
                {b.count > 0 ? t('viewBrand', { brand: b.label }) : t('empty')}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <HubFaqSection
        heading={t('faqTitle')}
        items={faqItems.map((it) => ({ question: it.q, answer: it.a }))}
      />
    </main>
  );
}
