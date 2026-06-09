import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import { intlLocaleTag } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import {
  groupByCountry,
  groupByRegion,
  listPublishedHotelsForGrouping,
  partitionByDomesticForeign,
  type HotelGroupRow,
} from '@/server/destinations/cities';
import { buildCountryDirectoryList } from '@/server/annuaire/country-slugs';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';
import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';

// CSP nonce read forces dynamic rendering — same contract as the
// destination directory. Catalog stays edge-cached at the CDN layer.
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    eyebrow: 'Catalogue éditorial',
    title: 'Hôtels d\u2019exception dans le monde',
    subtitle: (n: number) =>
      `${n} adresses sélectionnées par notre conciergerie à travers ${CATALOGUE_COUNTRIES} pays : Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys et boutique-hôtels d\u2019auteur — Asie, Amériques, Europe, Moyen-Orient et Afrique.`,
    sectionByRegion: 'Par région',
    sectionByCountry: 'Par pays',
    sectionByBrand: 'Par groupe hôtelier',
    franceSectionTitle: 'France — par région',
    worldSectionTitle: 'Monde — par pays',
    palace: 'Palace',
    stars: '★',
    count: (n: number) => (n === 1 ? '1 adresse' : `${n} adresses`),
    seeFiche: 'Voir la fiche',
    seeDirectory: 'Annuaire complet',
    directoryHint:
      'Besoin de la liste exhaustive d\u2019une ville ou d\u2019un pays ? Parcourez l\u2019annuaire par pays ci-dessous — chaque pays ouvre la liste complète, ville par ville.',
    metaTitle: 'Hôtels d\u2019exception dans le monde — Sélection du Concierge',
    metaDesc: `Notre sélection éditoriale couvre ${CATALOGUE_PUBLISHED} hôtels d\u2019exception dans ${CATALOGUE_COUNTRIES} pays : Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, boutique-hôtels. Réservation IATA, tarifs nets GDS.`,
    // AEO + FAQ surfaces (skill geo-llm-optimization). The AEO answer
    // weighs 60-70 words so it sits inside the 40-80 range required by
    // `buildAeoBlock`; freshness signal "Mise à jour" is templated
    // with the current month so LLMs flag the page as up-to-date.
    aeoQ: 'Quels hôtels d\u2019exception MyConciergeHotel sélectionne-t-il dans le monde ?',
    aeoAnswer: (count: number, freshness: string) =>
      `MyConciergeHotel sélectionne ${count} hôtels d\u2019exception à travers ${CATALOGUE_COUNTRIES} pays — Palaces (Atout France), Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World et maisons d\u2019auteur (Aman, Belmond, Six Senses, Cheval Blanc, Mandarin Oriental, Four Seasons). Chaque fiche est rédigée par notre conciergerie IATA et se conclut par un Conseil du Concierge — secret opérationnel concret. Réservation au tarif net GDS, paiement sécurisé Amadeus. Mise à jour ${freshness}.`,
    faqTitle: 'Le catalogue MyConciergeHotel — questions fréquentes',
    faq: [
      {
        q: 'Comment choisissez-vous les hôtels du catalogue ?',
        a: "Notre sélection est éditoriale et indépendante : un hôtel n'achète pas son entrée. Nous croisons la distinction Atout France (Palace), les étoiles Michelin de la table, le classement Forbes Travel Guide, les Michelin Keys, l'appartenance à une collection d'auteur (Relais & Châteaux, Leading Hotels of the World, Small Luxury Hotels) et notre propre score interne (service, emplacement, signature). Chaque entrée est revue chaque trimestre par notre conciergerie.",
      },
      {
        q: 'Quels sont les principaux groupes hôteliers représentés ?',
        a: 'Le catalogue couvre les grandes collections internationales : Aman, Belmond, Six Senses, Bulgari, Mandarin Oriental, Four Seasons, Rosewood, Park Hyatt, Raffles, The Peninsula, Shangri-La, Oetker Collection, Dorchester Collection ; les maisons françaises Cheval Blanc, Airelles, Les K2, Caudalie ; ainsi que les indépendants iconiques (Negresco, Lutetia, Crillon, Villa La Coste, Reid\u2019s Palace, Hôtel du Cap-Eden-Roc).',
      },
      {
        q: 'Quelle différence entre un Palace et un hôtel 5 étoiles ?',
        a: 'La mention « Palace » est une distinction officielle décernée par Atout France à environ 30 hôtels du territoire français, au-delà des 5 étoiles. Critères : service personnalisé, art de vivre, infrastructures (spa, restauration étoilée, conciergerie 24/7), rayonnement international. Tous les Palaces sont 5 étoiles, mais tous les 5 étoiles ne sont pas Palaces. À l\u2019international, les distinctions équivalentes sont les Forbes Five Star et les Michelin Keys.',
      },
      {
        q: "Vos tarifs sont-ils plus chers que sur le site de l'hôtel ?",
        a: "Non. Nous sommes une agence IATA accréditée : nous accédons aux tarifs nets GDS d'Amadeus, identiques au tarif officiel public. Aucune commission ajoutée à votre charge. Notre comparateur de prix non affilié affiche en transparence les tarifs Booking, Hotels.com, Expedia pour les mêmes dates — vous voyez immédiatement le delta.",
      },
      {
        q: 'Dans quels pays pouvez-vous réserver ?',
        a: `Notre catalogue éditorial couvre ${CATALOGUE_COUNTRIES} pays : France (Paris, Côte d\u2019Azur, Alpes, Provence, Aquitaine, Bourgogne, Corse), Italie, Suisse, Espagne, Portugal, Grèce, Maroc, Émirats arabes unis, Maldives, Thaïlande, Indonésie (Bali), Japon, États-Unis, Mexique, Brésil et bien d\u2019autres. Au-delà de notre sélection éditoriale, notre réseau GDS Amadeus couvre plus de 950 000 hôtels dans le monde, réservables sur demande via notre conciergerie.`,
      },
      {
        q: 'Combien de temps pour confirmer ma réservation ?',
        a: 'En mode Amadeus (paiement direct par carte), la confirmation est instantanée. En mode conciergerie (par e-mail, hôtels non connectés GDS), votre concierge dédié vous adresse une proposition sous 24 heures ouvrées, généralement sous 4-6h.',
      },
    ] as const,
  },
  en: {
    eyebrow: 'Editorial catalog',
    title: 'Extraordinary hotels worldwide',
    subtitle: (n: number) =>
      `${n} addresses curated by our concierge desk across ${CATALOGUE_COUNTRIES} countries: Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys and boutique signature houses — Asia, the Americas, Europe, the Middle East and Africa.`,
    sectionByRegion: 'By region',
    sectionByCountry: 'By country',
    sectionByBrand: 'By hotel group',
    franceSectionTitle: 'France — by region',
    worldSectionTitle: 'World — by country',
    palace: 'Palace',
    stars: '★',
    count: (n: number) => (n === 1 ? '1 address' : `${n} addresses`),
    seeFiche: 'View the page',
    seeDirectory: 'Full directory',
    directoryHint:
      'Need the exhaustive list for a city or a country? Browse the directory by country below — each country opens the complete list, city by city.',
    metaTitle: 'Extraordinary hotels worldwide — The Concierge\u2019s Selection',
    metaDesc: `Our editorial selection covers ${CATALOGUE_PUBLISHED} extraordinary hotels across ${CATALOGUE_COUNTRIES} countries: Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, boutique houses. IATA booking, GDS net rates.`,
    aeoQ: 'Which extraordinary hotels does MyConciergeHotel cover worldwide?',
    aeoAnswer: (count: number, freshness: string) =>
      `MyConciergeHotel curates ${count} extraordinary hotels across ${CATALOGUE_COUNTRIES} countries — Palaces (Atout France), Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World and signature houses (Aman, Belmond, Six Senses, Cheval Blanc, Mandarin Oriental, Four Seasons). Every page is written by our IATA concierge desk and ends with a Concierge's Tip — a concrete operational secret. Booking at net GDS rates, secure Amadeus payment. Last updated ${freshness}.`,
    faqTitle: 'The MyConciergeHotel catalogue — frequently asked questions',
    faq: [
      {
        q: 'How do you choose the hotels in your catalogue?',
        a: "Our selection is editorial and independent — a hotel does not pay to be listed. We cross-reference Atout France's Palace distinction, the table's Michelin stars, the Forbes Travel Guide ranking, Michelin Keys, membership of an author collection (Relais & Châteaux, Leading Hotels of the World, Small Luxury Hotels) and our own internal score (service, location, signature). Every entry is reviewed quarterly by our concierge team.",
      },
      {
        q: 'Which hotel groups are represented?',
        a: 'The catalogue covers the major international collections: Aman, Belmond, Six Senses, Bulgari, Mandarin Oriental, Four Seasons, Rosewood, Park Hyatt, Raffles, The Peninsula, Shangri-La, Oetker Collection, Dorchester Collection; French signature houses Cheval Blanc, Airelles, Les K2, Caudalie; plus iconic independents (Negresco, Lutetia, Crillon, Villa La Coste, Reid\u2019s Palace, Hôtel du Cap-Eden-Roc).',
      },
      {
        q: 'What is the difference between a Palace and a 5-star hotel?',
        a: 'The "Palace" mention is an official distinction awarded by Atout France to roughly 30 hotels on French territory, above and beyond the 5-star rating. Criteria: bespoke service, art of living, infrastructure (spa, Michelin dining, 24/7 concierge), international reach. Every Palace is a 5-star, but not every 5-star is a Palace. Internationally, the equivalent distinctions are Forbes Five Star and Michelin Keys.',
      },
      {
        q: 'Are your rates more expensive than booking direct?',
        a: "No. We are an IATA-accredited agency: we access Amadeus GDS net rates, identical to the hotel's public published rate. No commission is added to your bill. Our non-affiliated price comparator transparently displays Booking, Hotels.com and Expedia rates for the same dates — you immediately see the delta.",
      },
      {
        q: 'Which countries can you book?',
        a: `Our editorial catalogue covers ${CATALOGUE_COUNTRIES} countries: France (Paris, French Riviera, Alps, Provence, Aquitaine, Burgundy, Corsica), Italy, Switzerland, Spain, Portugal, Greece, Morocco, UAE, Maldives, Thailand, Indonesia (Bali), Japan, USA, Mexico, Brazil and many more. Beyond our editorial selection, our Amadeus GDS network covers 950,000+ hotels worldwide, bookable on request via our concierge desk.`,
      },
      {
        q: 'How long does it take to confirm my booking?',
        a: 'In Amadeus mode (direct card payment), confirmation is instant. In concierge mode (by email, for hotels not connected to the GDS), your dedicated concierge sends you an offer within 24 business hours, usually within 4-6h.',
      },
    ] as const,
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = T[locale];

  const title = t.metaTitle;
  const description = t.metaDesc;
  const buildCanonicalPath = (l: Locale): string => getPathname({ locale: l, href: '/hotels' });
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

/**
 * Localised name/slug/description picker for a `HotelGroupRow`. Mirrors
 * the helpers that live in `cities.ts` for the destination hubs — kept
 * inline here because the index card surfaces a slightly different shape
 * (no excerpt truncation, just the description used by the card body).
 */
interface RenderableHotel {
  readonly key: string;
  readonly name: string;
  readonly slug: string;
  readonly city: string;
  readonly description: string | null;
  readonly stars: number;
  readonly isPalace: boolean;
}

function toRenderable(row: HotelGroupRow, locale: Locale): RenderableHotel {
  const slug = pickByLocale(locale, row.slug, row.slug_en ?? row.slug);
  const name = pickByLocale(locale, row.name, row.name_en ?? row.name);
  const descRaw = pickLocalizedText(locale, row.description_fr, row.description_en);
  const description =
    descRaw !== null && descRaw.length > 160 ? `${descRaw.slice(0, 157).trimEnd()}…` : descRaw;
  return {
    key: row.slug,
    name,
    slug,
    city: row.city,
    description,
    stars: row.stars,
    isPalace: row.is_palace,
  };
}

export default async function HotelsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const t = T[locale];
  const rows = await listPublishedHotelsForGrouping();
  const { domestic, foreign } = partitionByDomesticForeign(rows);
  const hasForeign = foreign.length > 0;
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const title = t.title;
  const subtitle = t.subtitle(rows.length);

  // ── Region clusters (France) ──────────────────────────────────────────
  const byRegion = groupByRegion(domestic);
  const regionsOrdered = [...byRegion.values()].sort((a, b) => b.hotels.length - a.hotels.length);

  // ── Country clusters (international) ──────────────────────────────────
  const byCountry = groupByCountry(foreign, locale);
  const countriesOrdered = [...byCountry.values()].sort(
    (a, b) => b.hotels.length - a.hotels.length || a.label.localeCompare(b.label, locale),
  );

  // Map ISO code → derived annuaire slug (ADR-0026). Reuses the directory
  // aggregator so the slug logic stays in lock-step with `/hotels/[pays]`.
  const countrySlugByCode = new Map(
    buildCountryDirectoryList(rows, locale).map((c) => [c.code, c.slug] as const),
  );
  const franceDirectorySlug = countrySlugByCode.get('FR') ?? null;

  // ── Cluster by brand for the secondary navigation strip ──────────────
  // Brand collections still feed off the full catalog — chain affiliations
  // are global (Aman, Mandarin Oriental, Rosewood, …).
  const brandCounts = new Map<string, { label: string; count: number }>();
  for (const h of rows) {
    const brand = detectBrand(h.name);
    if (brand === null) continue;
    const cur = brandCounts.get(brand.slug);
    brandCounts.set(brand.slug, { label: brand.label, count: (cur?.count ?? 0) + 1 });
  }
  const brandsWithEntries = KNOWN_BRANDS.filter((b) => (brandCounts.get(b.slug)?.count ?? 0) >= 2);

  // ── ItemList JSON-LD (full catalog) ──────────────────────────────────
  // Rich `Hotel` ListItem variant for the first 30 entries — surfaces
  // starRating + the Palace marker in the carousel rich result.
  const itemListJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.itemListJsonLd({
      name: title,
      items: rows.map((h) => {
        const stars = h.stars;
        const isValidStarRating = (n: number): n is 1 | 2 | 3 | 4 | 5 =>
          n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
        const slug = pickByLocale(locale, h.slug, h.slug_en ?? h.slug);
        return {
          name: pickByLocale(locale, h.name, h.name_en ?? h.name),
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/hotel/[slug]', params: { slug } },
          })}`,
          ...(isValidStarRating(stars) ? { hotel: { starRating: stars } } : {}),
        };
      }),
    }),
  );

  // Breadcrumb JSON-LD (Accueil › Hôtels) — BreadcrumbList was missing on
  // this catalogue hub (audit 2026-06). Mirrors the pattern on the other
  // hubs so Google can render the breadcrumb rich result.
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: locale === 'fr' ? 'Accueil' : 'Home',
        url: `${origin}${getPathname({ locale, href: '/' })}`,
      },
      { name: title, url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
    ]),
  );

  // Build the AEO answer with current month freshness signal — read by
  // LLM crawlers as a recency cue ("Mise à jour novembre 2026" per
  // skill `geo-llm-optimization` §AEO block). Today's date is
  // formatted in the user's locale so an EN consumer sees the EN
  // month name, an FR consumer the FR month.
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const aeoAnswer = t.aeoAnswer(rows.length, freshnessDate);
  // Triple freshness sync — visible badge + AEO inline cue + (later)
  // sitemap lastmod. Using "today" here because the catalogue list
  // recomputes on every dynamic render — the answer is always current
  // by construction.
  const todayIso = new Date().toISOString();

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={itemListJsonLd} nonce={nonce} />
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />

      <header className="mch-kit mb-10">
        <div className="rk-page-head">
          <span className="eyebrow left">{t.eyebrow}</span>
          <h1>{title}</h1>
          <p className="rk-lede">{subtitle}</p>
          <div className="rk-meta">
            <LastUpdatedBadge isoDate={todayIso} locale={locale} variant="inline" />
          </div>
        </div>
      </header>

      {/* emitJsonLd={false}: the canonical FAQPage is the multi-Q
          <HubFaqSection> below (ADR-0011 C1 — one FAQPage per page). */}
      <HubAeoSection
        question={t.aeoQ}
        answer={aeoAnswer}
        headingId="hotels-aeo-title"
        emitJsonLd={false}
      />

      {/* Internal anchor strip — region jump-to (boosts maillage interne) */}
      {regionsOrdered.length > 0 ? (
        <nav
          aria-label={t.sectionByRegion}
          className="border-border mb-6 flex flex-wrap items-center gap-2 border-y py-3"
        >
          <span className="text-muted text-xs font-semibold uppercase tracking-wide">
            {t.sectionByRegion} :
          </span>
          {regionsOrdered.map((g) => (
            <a
              key={g.region}
              href={`#region-${encodeURIComponent(g.region)}`}
              className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
            >
              {g.region}
              <span className="text-muted ml-1.5">({g.hotels.length})</span>
            </a>
          ))}
          {hasForeign ? (
            <a
              href="#section-world"
              className="border-border bg-bg hover:bg-muted/10 ml-2 rounded-full border px-3 py-1 text-xs"
            >
              {t.sectionByCountry}
              <span className="text-muted ml-1.5">({foreign.length})</span>
            </a>
          ) : null}
        </nav>
      ) : null}

      {/* Top countries strip — now a discovery surface for the per-country
          annuaire (ADR-0026). Each chip links to `/hotels/[pays]`, the
          exhaustive country directory grouped by city, instead of an
          in-page anchor. France gets its own directory chip too. */}
      {countriesOrdered.length > 0 || franceDirectorySlug !== null ? (
        <>
          <p className="text-muted mb-3 text-sm">{t.directoryHint}</p>
          <nav
            aria-label={t.sectionByCountry}
            className="border-border mb-10 flex flex-wrap items-center gap-2 border-b pb-3"
          >
            <span className="text-muted text-xs font-semibold uppercase tracking-wide">
              {t.sectionByCountry} :
            </span>
            {franceDirectorySlug !== null && domestic.length > 0 ? (
              <Link
                href={{ pathname: '/hotels/[pays]', params: { pays: franceDirectorySlug } }}
                prefetch={false}
                className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
              >
                France
                <span className="text-muted ml-1.5">({domestic.length})</span>
              </Link>
            ) : null}
            {countriesOrdered.slice(0, 30).map((g) => {
              const slug = countrySlugByCode.get(g.code);
              const inner = (
                <>
                  {g.label}
                  <span className="text-muted ml-1.5">({g.hotels.length})</span>
                </>
              );
              return slug !== undefined ? (
                <Link
                  key={g.code}
                  href={{ pathname: '/hotels/[pays]', params: { pays: slug } }}
                  prefetch={false}
                  className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
                >
                  {inner}
                </Link>
              ) : (
                <a
                  key={g.code}
                  href={`#country-${g.code.toLowerCase()}`}
                  className="border-border bg-bg hover:bg-muted/10 rounded-full border px-3 py-1 text-xs"
                >
                  {inner}
                </a>
              );
            })}
            {countriesOrdered.length > 30 ? (
              <span className="text-muted ml-1 text-xs">
                {pickByLocale(
                  locale,
                  `+ ${countriesOrdered.length - 30} autres`,
                  `+ ${countriesOrdered.length - 30} more`,
                )}
              </span>
            ) : null}
          </nav>
        </>
      ) : null}

      {/* Brand collections — strong internal linking signal */}
      {brandsWithEntries.length > 0 ? (
        <nav
          aria-label={t.sectionByBrand}
          className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {brandsWithEntries.map((b) => {
            const info = brandCounts.get(b.slug);
            return (
              <Link
                key={b.slug}
                href={{ pathname: '/marque/[brandSlug]', params: { brandSlug: b.slug } }}
                className="border-border bg-bg hover:bg-muted/10 rounded-lg border px-4 py-3"
                prefetch={false}
              >
                <span className="text-fg block font-medium">{b.label}</span>
                <span className="text-muted text-xs">{t.count(info?.count ?? 0)}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {/* ── France — par région ───────────────────────────────────────── */}
      {hasForeign && regionsOrdered.length > 0 ? (
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 className="text-fg font-serif text-2xl md:text-3xl">{t.franceSectionTitle}</h2>
          {franceDirectorySlug !== null ? (
            <Link
              href={{ pathname: '/hotels/[pays]', params: { pays: franceDirectorySlug } }}
              prefetch={false}
              className="whitespace-nowrap text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
            >
              {t.seeDirectory} →
            </Link>
          ) : null}
        </div>
      ) : null}

      {regionsOrdered.map((g) => (
        <section
          key={g.region}
          id={`region-${encodeURIComponent(g.region)}`}
          aria-labelledby={`region-${encodeURIComponent(g.region)}-title`}
          className="mb-14 scroll-mt-24"
        >
          <header className="mb-6 flex items-baseline justify-between">
            <h3
              id={`region-${encodeURIComponent(g.region)}-title`}
              className="text-fg font-serif text-xl md:text-2xl"
            >
              {g.region}
            </h3>
            <span className="text-muted text-sm">{t.count(g.hotels.length)}</span>
          </header>

          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.hotels.map((row) => {
              const h = toRenderable(row, locale);
              return (
                <li key={h.key}>
                  <Link
                    href={{ pathname: '/hotel/[slug]', params: { slug: h.slug } }}
                    prefetch={false}
                    className="border-border bg-bg group block h-full rounded-lg border p-5 transition hover:border-amber-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                        {h.isPalace ? t.palace : `${h.stars}${t.stars}`}
                      </span>
                      <span className="text-muted text-xs">{h.city}</span>
                    </div>
                    <h4 className="text-fg mb-2 font-serif text-lg group-hover:text-amber-700 md:text-xl">
                      {h.name}
                    </h4>
                    {h.description !== null ? (
                      <p className="text-muted line-clamp-3 text-sm">{h.description}</p>
                    ) : null}
                    <span className="mt-3 inline-block text-xs font-medium text-amber-700 underline-offset-2 group-hover:underline">
                      {t.seeFiche} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* ── Monde — par pays ──────────────────────────────────────────── */}
      {hasForeign ? (
        <section
          id="section-world"
          aria-labelledby="section-world-title"
          className="mt-4 scroll-mt-24"
        >
          <header className="border-border mb-8 max-w-3xl border-t pt-10">
            <h2 id="section-world-title" className="text-fg font-serif text-2xl md:text-3xl">
              {t.worldSectionTitle}
            </h2>
            <p className="text-muted mt-2 text-sm">{t.count(foreign.length)}</p>
          </header>

          {countriesOrdered.map((g) => {
            const anchor = `country-${g.code.toLowerCase()}`;
            return (
              <section
                key={g.code}
                id={anchor}
                aria-labelledby={`${anchor}-title`}
                className="mb-14 scroll-mt-24"
              >
                <header className="mb-6 flex items-baseline justify-between gap-3">
                  <h3 id={`${anchor}-title`} className="text-fg font-serif text-xl md:text-2xl">
                    {g.label}
                  </h3>
                  <span className="flex items-baseline gap-3">
                    {(() => {
                      const slug = countrySlugByCode.get(g.code);
                      return slug !== undefined ? (
                        <Link
                          href={{ pathname: '/hotels/[pays]', params: { pays: slug } }}
                          prefetch={false}
                          className="whitespace-nowrap text-xs font-medium text-amber-700 underline-offset-2 hover:underline"
                        >
                          {t.seeDirectory} →
                        </Link>
                      ) : null;
                    })()}
                    <span className="text-muted text-sm">{t.count(g.hotels.length)}</span>
                  </span>
                </header>

                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {g.hotels.map((row) => {
                    const h = toRenderable(row, locale);
                    return (
                      <li key={h.key}>
                        <Link
                          href={{ pathname: '/hotel/[slug]', params: { slug: h.slug } }}
                          prefetch={false}
                          className="border-border bg-bg group block h-full rounded-lg border p-5 transition hover:border-amber-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                              {h.isPalace ? t.palace : `${h.stars}${t.stars}`}
                            </span>
                            <span className="text-muted text-xs">
                              {h.city} · {g.label}
                            </span>
                          </div>
                          <h4 className="text-fg mb-2 font-serif text-lg group-hover:text-amber-700 md:text-xl">
                            {h.name}
                          </h4>
                          {h.description !== null ? (
                            <p className="text-muted line-clamp-3 text-sm">{h.description}</p>
                          ) : null}
                          <span className="mt-3 inline-block text-xs font-medium text-amber-700 underline-offset-2 group-hover:underline">
                            {t.seeFiche} →
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </section>
      ) : null}

      <HubFaqSection
        heading={t.faqTitle}
        items={t.faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
    </main>
  );
}
