import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { env } from '@/lib/env';

/**
 * `/itineraires` — hub of bespoke editorial itineraries.
 *
 * URL convention: hub *pluriel*, aligné sur `/hotels`, `/classements`,
 * `/guides`, `/marques` (plan de reprise §1.1 + §3.2.1). Le singulier
 * historique `/itineraire` est 308-redirigé vers ce hub via
 * `next.config.ts` pour préserver l'éventuel SEO (fenêtre d'exposition
 * < 1 jour, donc risque nul, mais propreté SEO impérative).
 *
 * i18n namespace: `itineraires` au niveau JSON root (et non
 * `header.itineraire`, qui produisait silencieusement des clés brutes
 * en titre + meta — pattern hotfix #72, capitalisé dans la skill
 * `nextjs-app-router` §"Namespace nesting fails silently").
 *
 * Status: route **anticipée** par la skill `itinerary-editorial-pipeline`.
 * La table `public.itineraries` existe désormais (migration 0045 + 0046)
 * et les server queries sont en place (`apps/web/src/server/itineraries/`)
 * mais le rendu listing reste à câbler dans Sprint 2 PR 2. Cette page
 * rend pour l'instant une surface "coming soon" qui :
 * - Est indexable (`200` + `CollectionPage` JSON-LD).
 * - Porte les alternates hreflang FR/EN pour rester adressable depuis
 *   les agent skills `get-itinerary` / `list-itineraries`.
 * - Fournit des fallbacks vers les surfaces vivantes
 *   (`/inspiration`, `/classements`, `/destination`).
 *
 * Une fois Sprint 2 mergé, ce composant bascule en vrai listing
 * (`listPublishedItineraries({ limit: 100 })`).
 *
 * @see .cursor/skills/itinerary-editorial-pipeline/SKILL.md
 * @see docs/plan-itineraires-reprise.md §1.1, §3.2.1
 * @see docs/adr/0014-menu-architecture-v2.md
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
  const t = await getTranslations({ locale, namespace: 'itineraires' });
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/itineraires' });

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
    // Coming-soon hub: keep indexable (it's a real hub the brand
    // commits to), but don't promote it from sitelinks until the
    // first itinerary is published. The skill's `list-itineraries`
    // tool reports zero results until then.
  };
}

export default async function ItinerairesHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'itineraires' });

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const url = `${origin}${getPathname({ locale, href: '/itineraires' })}`;

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

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
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

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-3 text-base md:text-lg">{t('lede')}</p>
      </header>

      <section
        aria-labelledby="coming-soon"
        className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
          ⏳ {t('comingSoon')}
        </p>
        <h2 id="coming-soon" className="text-fg sr-only">
          {t('comingSoon')}
        </h2>
        <p className="text-fg mt-2 max-w-prose text-base md:text-lg">{t('comingSoonBody')}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-fg font-serif text-xl sm:text-2xl">{t('fallbackTitle')}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          <li>
            <Link
              href="/inspiration"
              className="border-border bg-bg group flex items-center justify-between gap-3 rounded-md border p-4 hover:border-amber-400"
            >
              <span className="text-fg text-sm font-medium">{t('fallbackInspiration')}</span>
              <span aria-hidden className="text-muted group-hover:text-amber-700">
                →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/classements"
              className="border-border bg-bg group flex items-center justify-between gap-3 rounded-md border p-4 hover:border-amber-400"
            >
              <span className="text-fg text-sm font-medium">{t('fallbackRankings')}</span>
              <span aria-hidden className="text-muted group-hover:text-amber-700">
                →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/destination"
              className="border-border bg-bg group flex items-center justify-between gap-3 rounded-md border p-4 hover:border-amber-400"
            >
              <span className="text-fg text-sm font-medium">{t('fallbackDestinations')}</span>
              <span aria-hidden className="text-muted group-hover:text-amber-700">
                →
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
