import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { pickByLocale } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { listItineraries, type ItineraryCard } from '@/server/itineraries/list-itineraries';

/**
 * `/itineraires` — itineraries hub (CDC §2 §6.1, ADR-0008 flat-slug).
 *
 * Two render modes wired to the same component:
 *
 *   - **listing** — when `listItineraries()` returns ≥ 1 published row,
 *     we render a card grid + JSON-LD `CollectionPage`.
 *   - **coming-soon** — until the first row is seeded (PR4a smoke
 *     test), the polished placeholder kept from the previous
 *     `/itineraire` route is rendered instead. Same hreflang + OG
 *     tags stay valid in both modes.
 *
 * ISR — `revalidate = 3600` (1 h), aligned on every other editorial
 * hub of the site (`/classements`, `/classements/[axe]/[valeur]`,
 * `/classement/[slug]`, `/hotel/[slug]`) and on the itinerary detail
 * page itself. A 24 h TTL was kept here while the catalogue was a
 * single seed; once published itineraries multiply (20 rows at the
 * 2026-05-25 batch), a 1 h refresh window matches editorial reality —
 * a freshly published itinerary must surface on the hub within an hour
 * of an `update … set status = 'published'`, not 24.
 *
 * Cache invalidation is also driven by Payload `afterChange` hooks
 * emitting `revalidateTag('itineraries-hub')` whenever an itinerary
 * is created, edited or unpublished (PR3).
 *
 * @see .cursor/skills/itinerary-editorial-pipeline/SKILL.md
 * @see .cursor/rules/seo-geo.mdc
 * @see docs/plan-itineraires-reprise.md §3.2.1
 */
export const revalidate = 3600;

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

  // Single Supabase round-trip (cached 1 h via `unstable_cache` in the
  // helper) — listing renders when we have rows, coming-soon otherwise.
  const itineraries = await listItineraries();
  const hasItineraries = itineraries.length > 0;

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
      { name: t('breadcrumbHub'), url },
    ]),
  );

  // ItemList only makes sense with ≥ 1 row — otherwise Google will
  // flag a 0-item ItemList as invalid Rich Result.
  const itemListJsonLd = hasItineraries
    ? JsonLd.withSchemaOrgContext(
        JsonLd.itemListJsonLd({
          name: t('title'),
          items: itineraries.map((c) => ({
            name: pickByLocale(locale, c.titleFr, c.titleEn ?? c.titleFr),
            url: `${origin}${getPathname({
              locale,
              href: { pathname: '/itineraire/[slug]', params: { slug: c.slugFr } },
            })}`,
          })),
        }),
      )
    : null;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLdScript data={collectionPageJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {itemListJsonLd !== null ? <JsonLdScript data={itemListJsonLd} nonce={nonce} /> : null}

      <nav aria-label="breadcrumb" className="text-muted mb-6 text-xs">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              {t('breadcrumbHome')}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-fg" aria-current="page">
            {t('breadcrumbHub')}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t('title')}</h1>
        <p className="text-muted mt-3 text-base md:text-lg">{t('lede')}</p>
      </header>

      <HubAeoSection
        question={t('aeoQuestion')}
        answer={t('aeoAnswer')}
        headingId="itineraires-aeo-title"
        emitJsonLd={false}
      />

      {hasItineraries ? (
        <ItinerariesListing
          locale={locale}
          itineraries={itineraries}
          totalLabel={t('listing.totalLabel', { count: itineraries.length })}
        />
      ) : (
        <ComingSoonSection
          locale={locale}
          comingSoonLabel={t('comingSoon')}
          comingSoonBody={t('comingSoonBody')}
          fallbackTitle={t('fallbackTitle')}
          fallbackInspiration={t('fallbackInspiration')}
          fallbackRankings={t('fallbackRankings')}
          fallbackDestinations={t('fallbackDestinations')}
        />
      )}

      <HubFaqSection
        heading={t('faqTitle')}
        items={(t.raw('faqItems') as { q: string; a: string }[]).map((it) => ({
          question: it.q,
          answer: it.a,
        }))}
      />
    </main>
  );
}

// ----------------------------------------------------------------------------
// Listing (≥ 1 published row)
// ----------------------------------------------------------------------------

function ItinerariesListing({
  locale,
  itineraries,
  totalLabel,
}: {
  locale: Locale;
  itineraries: readonly ItineraryCard[];
  totalLabel: string;
}) {
  return (
    <>
      <p className="text-muted mb-6 text-sm" aria-live="polite">
        {totalLabel}
      </p>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {itineraries.map((c) => (
          <ItineraryCardItem key={c.id} card={c} locale={locale} />
        ))}
      </ul>
    </>
  );
}

function ItineraryCardItem({ card, locale }: { card: ItineraryCard; locale: Locale }) {
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const title = pickByLocale(locale, card.titleFr, card.titleEn ?? card.titleFr);
  const desc = pickByLocale(
    locale,
    card.metaDescFr ?? '',
    card.metaDescEn ?? card.metaDescFr ?? '',
  );
  const heroSrc =
    card.heroCloudinaryId !== null && cloudName !== undefined
      ? buildSquareCardSrc(cloudName, card.heroCloudinaryId)
      : null;
  const heroAlt = pickByLocale(locale, card.heroAltFr ?? title, card.heroAltEn ?? title);

  return (
    <li className="border-border bg-bg/60 group flex flex-col overflow-hidden rounded-lg border transition hover:border-amber-400">
      <Link
        href={{ pathname: '/itineraire/[slug]', params: { slug: card.slugFr } }}
        className="flex h-full flex-col"
      >
        {heroSrc !== null ? (
          <>
            {/* Plain <img> rather than next/image: cards can be many on
                a hub page; relying on Cloudinary's `f_auto,q_auto` keeps
                the byte budget low and avoids next/image's per-instance
                request overhead. Eager-decoded above-the-fold cards are
                accepted browser-side. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc}
              alt={heroAlt}
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
              decoding="async"
              width={640}
              height={480}
            />
          </>
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <p className="text-muted text-xs uppercase tracking-[0.16em]">
            {card.destinationCity ?? card.destinationRegion ?? card.countryCode}
            {' · '}
            {card.durationMaxDays !== null && card.durationMaxDays !== card.durationMinDays
              ? `${card.durationMinDays}–${card.durationMaxDays} j`
              : `${card.durationMinDays} j`}
          </p>
          <h2 className="text-fg font-serif text-lg md:text-xl">{title}</h2>
          {desc.length > 0 ? <p className="text-muted line-clamp-3 text-sm">{desc}</p> : null}
        </div>
      </Link>
    </li>
  );
}

function buildSquareCardSrc(cloudName: string, publicId: string): string {
  const safe = publicId.split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_auto,q_auto,c_fill,g_auto,w_640,h_480/${safe}`;
}

// ----------------------------------------------------------------------------
// Coming-soon (zero published rows)
// ----------------------------------------------------------------------------

function ComingSoonSection({
  locale,
  comingSoonLabel,
  comingSoonBody,
  fallbackTitle,
  fallbackInspiration,
  fallbackRankings,
  fallbackDestinations,
}: {
  locale: Locale;
  comingSoonLabel: string;
  comingSoonBody: string;
  fallbackTitle: string;
  fallbackInspiration: string;
  fallbackRankings: string;
  fallbackDestinations: string;
}) {
  // Locale is unused at runtime today (the messages already came from
  // next-intl) but kept on the signature so we can pluralise / localise
  // copy here directly when V2 adds DE/ES/IT.
  void locale;

  return (
    <>
      <section
        aria-labelledby="coming-soon"
        className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
          ⏳ {comingSoonLabel}
        </p>
        <h2 id="coming-soon" className="text-fg sr-only">
          {comingSoonLabel}
        </h2>
        <p className="text-fg mt-2 max-w-prose text-base md:text-lg">{comingSoonBody}</p>
      </section>

      <section className="mt-12">
        <h2 className="text-fg font-serif text-xl sm:text-2xl">{fallbackTitle}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          <li>
            <Link
              href="/inspiration"
              className="border-border bg-bg group flex items-center justify-between gap-3 rounded-md border p-4 hover:border-amber-400"
            >
              <span className="text-fg text-sm font-medium">{fallbackInspiration}</span>
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
              <span className="text-fg text-sm font-medium">{fallbackRankings}</span>
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
              <span className="text-fg text-sm font-medium">{fallbackDestinations}</span>
              <span aria-hidden className="text-muted group-hover:text-amber-700">
                →
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
