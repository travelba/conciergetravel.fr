import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { HotelImage } from '@mch/ui';
import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { getRecentOpenings } from '@/lib/home/recent-openings';

/**
 * `/ouvertures` (FR) / `/openings` (EN) — page éditoriale qui liste les
 * 20 dernières adresses visitées par notre conciergerie.
 *
 * Tri actuel = `priority` ascendant. Le PO a validé (2026-05-28) de
 * lever sur cette colonne tant que `opened_at` n'est pas back-fillé
 * (aujourd'hui 0/2193). Quand la colonne sera populée, on bascule sur
 * `opened_at desc` en une ligne dans `recent-openings.ts` — la fiche
 * publique de ce composant ne change pas.
 *
 * `force-dynamic` car la page lit `headers()` pour propager le nonce
 * CSP aux scripts JSON-LD inline (Hard rule — voir
 * `components/seo/json-ld.tsx`). Le cache effectif vit dans le
 * `unstable_cache` qui enveloppe `getRecentOpenings` (TTL 3600 s).
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';
const RECENT_OPENINGS_COUNT = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = await getTranslations({ locale, namespace: 'homepage.openingsPage' });
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: '/ouvertures' });
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

export default async function OuverturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'homepage.openingsPage' });

  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const openings = await getRecentOpenings(RECENT_OPENINGS_COUNT);

  const pageUrl = `${siteUrl}${getPathname({ locale, href: '/ouvertures' })}`;
  const homeUrl = `${siteUrl}${getPathname({ locale, href: '/' })}`;

  const collectionPageJsonLd = JsonLd.withSchemaOrgContext({
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#page`,
    name: t('title'),
    description: t('lead'),
    url: pageUrl,
    inLanguage: locale === 'en' ? 'en' : 'fr',
  });

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t('backToHome'), url: homeUrl },
      { name: t('title'), url: pageUrl },
    ]),
  );

  const isValidStarRating = (n: number): n is 1 | 2 | 3 | 4 | 5 =>
    n === 1 || n === 2 || n === 3 || n === 4 || n === 5;

  const itemListJsonLd =
    openings.length > 0
      ? JsonLd.withSchemaOrgContext(
          JsonLd.itemListJsonLd({
            name: t('title'),
            items: openings.map((h) => {
              const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
              const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
              return {
                name,
                url: `${siteUrl}${getPathname({
                  locale,
                  href: { pathname: '/hotel/[slug]', params: { slug } },
                })}`,
                ...(isValidStarRating(h.stars) ? { hotel: { starRating: h.stars } } : {}),
              };
            }),
          }),
        )
      : null;

  return (
    <main className="container mx-auto max-w-screen-xl px-4 py-10 sm:py-14">
      <JsonLdScript data={collectionPageJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {itemListJsonLd !== null ? <JsonLdScript data={itemListJsonLd} nonce={nonce} /> : null}

      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('backToHome')}
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
        <p className="text-muted mt-3 text-base md:text-lg">{t('lead')}</p>
      </header>

      {openings.length === 0 ? (
        <p className="text-muted py-12 text-center">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {openings.map((h) => {
            const slug = pickByLocale(locale, h.slug, h.slugEn ?? h.slug);
            const name = pickByLocale(locale, h.nameFr, h.nameEn ?? h.nameFr);
            const countryLabel = pickByLocale(
              locale,
              h.countryLabelFr,
              h.countryLabelEn !== '' ? h.countryLabelEn : h.countryLabelFr,
            );
            return (
              <li key={h.slug}>
                <article className="border-border bg-bg group h-full overflow-hidden rounded-lg border transition-shadow hover:shadow-md">
                  <Link
                    href={{ pathname: '/hotel/[slug]', params: { slug } }}
                    className="block focus-visible:outline-none"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden">
                      <HotelImage
                        cloudName={cloudName}
                        publicId={h.heroPublicId}
                        alt={name}
                        width={480}
                        height={360}
                        transforms="f_auto,q_auto:good,c_fill,g_auto,w_480,h_360"
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-muted flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                        <span className="border-border bg-bg rounded-md border px-2 py-0.5">
                          {h.isPalace ? 'Palace' : '★'.repeat(h.stars)}
                        </span>
                        <span>
                          {countryLabel.length > 0 ? `${h.city} · ${countryLabel}` : h.city}
                        </span>
                      </div>
                      <h3 className="text-fg mt-3 font-serif text-base leading-snug">{name}</h3>
                      <p className="text-muted mt-3 inline-flex items-center text-xs underline-offset-2 group-hover:underline">
                        {t('viewFiche')} →
                      </p>
                    </div>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
