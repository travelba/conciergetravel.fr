import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import { listPublishedHotelsByAffiliation } from '@/server/hotels/get-hotel-by-slug';
import { findKnownLabel, KNOWN_LABELS, type KnownLabel } from '@/server/hotels/known-labels';

/**
 * `/label/[facetSlug]` — collection page for one editorial label or
 * ranking (Relais & Châteaux, Forbes 5-Star, LHW, Michelin Keys, T+L
 * World's Best, …). Mirrors `/marque/[brandSlug]` in spirit but the
 * matching is structural (verified `affiliations[]` in the DB) rather
 * than regex-based.
 *
 * - Source of truth: `apps/web/src/server/hotels/known-labels.ts`.
 * - Matching: `h.affiliationLabelSlugs.includes(facetSlug)` OR
 *   `h.affiliationRankingSlugs.includes(facetSlug)` depending on kind.
 *
 * Skill: seo-technical, geo-llm-optimization, structured-data-schema-org.
 * ADR-0023 — Hotel affiliations vs external_sources.
 */
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    eyebrowLabel: 'Label',
    eyebrowRanking: 'Classement',
    seeFiche: 'Voir la fiche',
    breadcrumbHome: 'Accueil',
    breadcrumbHotels: 'Hôtels',
    metaTitle: (label: string) => `${label} — Hôtels & Palaces | MyConciergeHotel`,
    metaDesc: (label: string, descriptor: string, n: number) =>
      `Les ${n} adresses ${label} de notre sélection éditoriale — ${descriptor}. Réservation IATA, tarifs nets GDS.`,
    subtitle: (label: string, n: number) =>
      `Les ${n} adresses ${label} de notre catalogue éditorial — sélection IATA MyConciergeHotel.`,
    emptyTitle: 'Sélection en préparation',
    emptyBody: (label: string) =>
      `Notre conciergerie sélectionne actuellement les adresses ${label}. En attendant, consultez notre catalogue complet ou nos autres distinctions.`,
    allLabels: 'Toutes les distinctions',
    allHotels: 'Tous les hôtels',
    faqTitle: 'Questions sur la distinction',
    palace: 'Palace',
    stars: '★',
    issuedBy: 'Décerné par',
    officialSite: 'Site officiel',
  },
  en: {
    eyebrowLabel: 'Label',
    eyebrowRanking: 'Ranking',
    seeFiche: 'View the page',
    breadcrumbHome: 'Home',
    breadcrumbHotels: 'Hotels',
    metaTitle: (label: string) => `${label} — Hotels & Palaces | MyConciergeHotel`,
    metaDesc: (label: string, descriptor: string, n: number) =>
      `The ${n} ${label} addresses from our editorial selection — ${descriptor}. IATA booking, GDS net rates.`,
    subtitle: (label: string, n: number) =>
      `The ${n} ${label} addresses from our editorial catalog — MyConciergeHotel IATA selection.`,
    emptyTitle: 'Selection in progress',
    emptyBody: (label: string) =>
      `Our concierge desk is curating ${label} addresses. While we publish them, browse our full catalog or other distinctions.`,
    allLabels: 'All distinctions',
    allHotels: 'All hotels',
    faqTitle: 'Questions about the distinction',
    palace: 'Palace',
    stars: '★',
    issuedBy: 'Awarded by',
    officialSite: 'Official site',
  },
} as const;

function aeoAnswer(args: {
  readonly label: KnownLabel;
  readonly count: number;
  readonly locale: Locale;
  readonly freshnessDate: string;
}): string {
  const { label, count, locale, freshnessDate } = args;
  const descriptor = pickByLocale(locale, label.descriptorFr, label.descriptorEn);
  return pickByLocale(
    locale,
    `MyConciergeHotel référence ${count} adresse${count > 1 ? 's' : ''} ${label.label} au ${freshnessDate} — ${descriptor}. Réservation IATA, tarifs nets GDS Amadeus.`,
    `MyConciergeHotel lists ${count} ${label.label} address${count > 1 ? 'es' : ''} as of ${freshnessDate} — ${descriptor}. IATA booking, GDS net rates via Amadeus.`,
  );
}

function faqItems(args: {
  readonly label: KnownLabel;
  readonly count: number;
  readonly locale: Locale;
}): readonly { readonly question: string; readonly answer: string }[] {
  const { label, count, locale } = args;
  const issuer = pickByLocale(locale, label.issuerFr, label.issuerEn);
  const descriptor = pickByLocale(locale, label.descriptorFr, label.descriptorEn);
  if (locale === 'fr') {
    return [
      {
        question: `Qu'est-ce que la distinction ${label.label} ?`,
        answer: `${label.label} est une ${descriptor}. La distinction est décernée par ${issuer} — référence vérifiable sur le site officiel ${label.officialUrl}.`,
      },
      {
        question: `Combien d'adresses ${label.label} sont disponibles via MyConciergeHotel ?`,
        answer: `Notre catalogue éditorial référence ${count} adresse${count > 1 ? 's' : ''} ${label.label}. Chaque fiche détaille la classification, les services et les tarifs nets via notre licence IATA. La distinction est conservée tant que l'hôtel reste référencé par ${issuer}.`,
      },
      {
        question: `Comment l'affiliation ${label.label} est-elle vérifiée ?`,
        answer: `Pour chaque hôtel, l'affiliation est confirmée contre la liste officielle publiée par ${issuer}. Aucune mention ${label.label} n'apparaît dans le JSON-LD Schema.org si la vérification n'a pas été faite — l'attribut \`verified: true\` est requis (cf. migration 0063 + ADR-0023).`,
      },
      {
        question: `Comment réserver un hôtel ${label.label} via MyConciergeHotel ?`,
        answer: `Notre conciergerie IATA accède directement aux tarifs nets du GDS Amadeus, identiques à ceux des sites officiels mais sans intermédiaire commissionné. Une demande de réservation déclenche un échange direct avec nos concierges hôteliers — disponibilités, surclassements, demandes spéciales.`,
      },
    ];
  }
  return [
    {
      question: `What is the ${label.label} distinction?`,
      answer: `${label.label} is an ${descriptor}. The distinction is awarded by ${issuer} — verifiable on the official website ${label.officialUrl}.`,
    },
    {
      question: `How many ${label.label} addresses are available via MyConciergeHotel?`,
      answer: `Our editorial catalog lists ${count} ${label.label} address${count > 1 ? 'es' : ''}. Each page details the classification, services and net rates via our IATA licence. The distinction is preserved as long as the hotel remains listed by ${issuer}.`,
    },
    {
      question: `How is the ${label.label} affiliation verified?`,
      answer: `For every hotel, the affiliation is confirmed against the official list published by ${issuer}. No ${label.label} mention appears in the Schema.org JSON-LD unless verification has been performed — \`verified: true\` is required (see migration 0063 + ADR-0023).`,
    },
    {
      question: `How do I book a ${label.label} hotel via MyConciergeHotel?`,
      answer: `Our IATA concierge desk accesses Amadeus GDS net rates — identical to the official sites but without commission intermediaries. A booking request triggers direct contact with our hotel concierges for availability, upgrades, and special requests.`,
    },
  ];
}

export async function generateStaticParams(): Promise<{ facetSlug: string }[]> {
  return KNOWN_LABELS.map((l) => ({ facetSlug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; facetSlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, facetSlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const label = findKnownLabel(facetSlug);
  if (label === null) return {};

  // DB-filtered JSONB query — single GIN-indexed read, no PostgREST cap.
  const hotels = await listPublishedHotelsByAffiliation({
    facetSlug: label.slug,
    kind: label.kind,
  });
  const count = hotels.length;

  const activeLocale: Locale = raw;
  const t = T[activeLocale];
  const descriptor = pickByLocale(activeLocale, label.descriptorFr, label.descriptorEn);
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/label/[facetSlug]', params: { facetSlug: label.slug } },
    });

  return {
    title: t.metaTitle(label.label),
    description: t.metaDesc(label.label, descriptor, count),
    alternates: {
      canonical: buildCanonicalPath(activeLocale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t.metaTitle(label.label),
      description: t.metaDesc(label.label, descriptor, count),
      type: 'website',
      locale: ogLocale(activeLocale),
    },
    // Same `noindex, follow` pattern as `/marque/[brandSlug]` when the
    // catalogue is empty — the URL stays resolvable so the menu link
    // doesn't break, but Search Console doesn't index a soft-404.
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function LabelPage({
  params,
}: {
  params: Promise<{ locale: string; facetSlug: string }>;
}) {
  const { locale: raw, facetSlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const label = findKnownLabel(facetSlug);
  if (label === null) notFound();

  const activeLocale: Locale = raw;
  setRequestLocale(activeLocale);

  // Same DB-filtered read as `generateMetadata`.
  const hotels = await listPublishedHotelsByAffiliation({
    facetSlug: label.slug,
    kind: label.kind,
  });
  const isEmpty = hotels.length === 0;

  const t = T[activeLocale];
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(activeLocale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const aeoQuestion = pickByLocale(
    activeLocale,
    `Combien d'hôtels ${label.label} sont disponibles via MyConciergeHotel ?`,
    `How many ${label.label} hotels are available via MyConciergeHotel?`,
  );
  const aeoText = isEmpty
    ? ''
    : aeoAnswer({ label, count: hotels.length, locale: activeLocale, freshnessDate });
  const faqs = isEmpty ? [] : faqItems({ label, count: hotels.length, locale: activeLocale });

  // ── BreadcrumbList JSON-LD ───────────────────────────────────────────
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: t.breadcrumbHome,
        url: `${origin}${getPathname({ locale: activeLocale, href: '/' })}`,
      },
      {
        name: t.breadcrumbHotels,
        url: `${origin}${getPathname({ locale: activeLocale, href: '/hotels' })}`,
      },
      {
        name: label.label,
        url: `${origin}${getPathname({
          locale: activeLocale,
          href: { pathname: '/label/[facetSlug]', params: { facetSlug: label.slug } },
        })}`,
      },
    ]),
  );

  // ── ItemList JSON-LD — list the canonical hotel URLs. Skip when empty
  //    to avoid Rich Results warnings on a zero-item ItemList.
  const itemListJsonLd = isEmpty
    ? null
    : JsonLd.withSchemaOrgContext(
        JsonLd.itemListJsonLd({
          name: label.label,
          items: hotels.map((h) => ({
            name: h.nameFr,
            url: `${origin}${getPathname({
              locale: activeLocale,
              href: { pathname: '/hotel/[slug]', params: { slug: h.slugFr } },
            })}`,
            hotel: { starRating: h.stars as 1 | 2 | 3 | 4 | 5 },
          })),
        }),
      );

  const eyebrow = label.kind === 'label' ? t.eyebrowLabel : t.eyebrowRanking;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      {itemListJsonLd !== null ? <JsonLdScript data={itemListJsonLd} nonce={nonce} /> : null}

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
            {label.label}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{label.label}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">
          {isEmpty ? t.emptyBody(label.label) : t.subtitle(label.label, hotels.length)}
        </p>
        <p className="text-muted mt-4 text-xs">
          <span className="font-medium">{t.issuedBy} :</span>{' '}
          {pickByLocale(activeLocale, label.issuerFr, label.issuerEn)} ·{' '}
          <a
            href={label.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {t.officialSite} ↗
          </a>
        </p>
      </header>

      {!isEmpty ? (
        <HubAeoSection
          question={aeoQuestion}
          answer={aeoText}
          headingId="label-aeo-title"
          emitJsonLd={false}
        />
      ) : null}

      {isEmpty ? (
        <section
          aria-labelledby="empty-state-title"
          className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
        >
          <h2 id="empty-state-title" className="text-fg font-serif text-xl">
            {t.emptyTitle}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {t.emptyBody(label.label)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/hotels"
              className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {t.allHotels} →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((h) => {
              const slug = pickByLocale(activeLocale, h.slugFr, h.slugEn ?? h.slugFr);
              const name = pickByLocale(activeLocale, h.nameFr, h.nameEn ?? h.nameFr);
              const descSource = pickLocalizedText(activeLocale, h.descriptionFr, h.descriptionEn);
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
                    {desc !== null ? (
                      <p className="text-muted line-clamp-4 text-sm">{desc}</p>
                    ) : null}
                    <span className="mt-3 inline-block text-xs font-medium text-amber-700 underline-offset-2 group-hover:underline">
                      {t.seeFiche} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {faqs.length > 0 ? <HubFaqSection heading={t.faqTitle} items={faqs} /> : null}
        </>
      )}
    </main>
  );
}
