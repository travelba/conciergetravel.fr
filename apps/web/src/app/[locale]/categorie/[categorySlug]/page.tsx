import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import {
  EDITORIAL_CATEGORIES,
  filterCategory,
  findCategory,
} from '@/server/hotels/editorial-categories';
import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';

export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    eyebrow: 'Sélection éditoriale',
    palace: 'Palace',
    stars: '★',
    seeFiche: 'Voir la fiche',
    breadcrumbHome: 'Accueil',
    breadcrumbHotels: 'Hôtels',
  },
  en: {
    eyebrow: 'Editorial selection',
    palace: 'Palace',
    stars: '★',
    seeFiche: 'View the page',
    breadcrumbHome: 'Home',
    breadcrumbHotels: 'Hotels',
  },
} as const;

export async function generateStaticParams(): Promise<{ categorySlug: string }[]> {
  return EDITORIAL_CATEGORIES.map((c) => ({ categorySlug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, categorySlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const cat = findCategory(categorySlug);
  if (cat === null) return {};

  const locale = raw;
  // Title / description selection stays locale-aware (data layer) — see ADR-0012.
  // V2 locales fall back to FR until the editorial-categories module gains
  // DE/ES/IT copy (Phase 1c-β: migrate the whole module to next-intl messages).
  const title = pickByLocale(locale, cat.metaTitleFr, cat.metaTitleEn);
  const description = pickByLocale(locale, cat.metaDescFr, cat.metaDescEn);
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/categorie/[categorySlug]', params: { categorySlug: cat.slug } },
    });

  return {
    title,
    description,
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: ogLocale(locale),
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>;
}) {
  const { locale: raw, categorySlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const category = findCategory(categorySlug);
  if (category === null) notFound();

  const locale = raw;
  setRequestLocale(locale);
  const t = T[locale];

  const allHotels = await listPublishedHotelsForIndex();
  const hotels = filterCategory(allHotels, category);
  if (hotels.length === 0) notFound();

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const h1 = pickByLocale(locale, category.h1Fr, category.h1En);
  const subtitle = pickByLocale(
    locale,
    category.subtitleFr(hotels.length),
    category.subtitleEn(hotels.length),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t.breadcrumbHome, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t.breadcrumbHotels, url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
      {
        name: pickByLocale(locale, category.labelFr, category.labelEn),
        url: `${origin}${getPathname({
          locale,
          href: { pathname: '/categorie/[categorySlug]', params: { categorySlug: category.slug } },
        })}`,
      },
    ]),
  );

  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: h1,
      items: hotels.map((h) => ({
        name: h.nameFr,
        url: `${origin}${getPathname({
          locale,
          href: { pathname: '/hotel/[slug]', params: { slug: h.slugFr } },
        })}`,
        hotel: { starRating: h.stars as 1 | 2 | 3 | 4 | 5 },
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
              {t.breadcrumbHome}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li>
            <Link href="/hotels" className="hover:underline">
              {t.breadcrumbHotels}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {pickByLocale(locale, category.labelFr, category.labelEn)}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{h1}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{subtitle}</p>
      </header>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hotels.map((h) => {
          // Slug/name selection stays locale-aware (data layer) — see ADR-0012.
          // V2 locales fall back to FR until migration 0034.
          const slug = pickByLocale(locale, h.slugFr, h.slugEn ?? h.slugFr);
          const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
          const descSource = pickLocalizedText(locale, h.descriptionFr, h.descriptionEn);
          const desc =
            descSource !== null && descSource.length > 200
              ? `${descSource.slice(0, 197).trimEnd()}…`
              : descSource;
          return (
            <li key={h.slugFr}>
              <Link
                href={{ pathname: '/hotel/[slug]', params: { slug } }}
                prefetch={false}
                className="border-border bg-bg group block h-full rounded-lg border p-5 transition hover:border-amber-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    {h.isPalace ? t.palace : `${h.stars}${t.stars}`}
                  </span>
                  <span className="text-muted text-xs">{h.city}</span>
                </div>
                <h2 className="text-fg mb-2 font-serif text-lg group-hover:text-amber-700 md:text-xl">
                  {name}
                </h2>
                {desc !== null ? <p className="text-muted line-clamp-4 text-sm">{desc}</p> : null}
                <span className="mt-3 inline-block text-xs font-medium text-amber-700 underline-offset-2 group-hover:underline">
                  {t.seeFiche} →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
