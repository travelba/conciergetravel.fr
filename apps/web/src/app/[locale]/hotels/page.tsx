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
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

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
    titleFrance: 'Hôtels 5★ et Palaces en France',
    titleWorld: 'Hôtels 5★ et Palaces dans le monde',
    subtitleFrance: (n: number) =>
      `${n} adresses éditorialement sélectionnées par notre conciergerie : Palaces parisiens, retraites alpines, refuges Côte d'Azur, vignobles bordelais et villas de Provence.`,
    subtitleWorld: (n: number) =>
      `${n} adresses sélectionnées par notre conciergerie : Palaces parisiens, retraites alpines, refuges Côte d'Azur, plus nos premières adresses à l'international — Asie, Amériques, Europe et Moyen-Orient.`,
    sectionByRegion: 'Par région',
    sectionByCountry: 'Par pays',
    sectionByBrand: 'Par groupe hôtelier',
    franceSectionTitle: 'France — par région',
    worldSectionTitle: 'Monde — par pays',
    palace: 'Palace',
    stars: '★',
    count: (n: number) => (n === 1 ? '1 adresse' : `${n} adresses`),
    seeFiche: 'Voir la fiche',
    metaTitleFrance: 'Hôtels 5★ et Palaces en France — Sélection MyConciergeHotel',
    metaTitleWorld: 'Hôtels 5★ et Palaces dans le monde — Sélection MyConciergeHotel',
    metaDescFrance:
      "Découvrez notre sélection éditoriale d'hôtels 5 étoiles et Palaces en France : Paris, Côte d'Azur, Alpes, Provence, Aquitaine. Réservation IATA, tarifs nets GDS.",
    metaDescWorld:
      "Sélection éditoriale d'hôtels 5 étoiles et Palaces — France et premières adresses internationales : Asie, Amériques, Europe et Moyen-Orient. Réservation IATA, tarifs nets GDS.",
    // AEO + FAQ surfaces (skill geo-llm-optimization). The AEO answer
    // weighs 60-70 words so it sits inside the 40-80 range required by
    // `buildAeoBlock`; freshness signal "Mise à jour" is templated
    // with the current month so LLMs flag the page as up-to-date.
    aeoQ: 'Quels hôtels 5★ et Palaces MyConciergeHotel propose-t-il en France ?',
    aeoAnswer: (count: number, freshness: string) =>
      `MyConciergeHotel sélectionne ${count} adresses 5 étoiles et Palaces en France et à l'international, regroupées par région et par marque (Cheval Blanc, Airelles, Four Seasons, Rosewood, Oetker, Dorchester). Chaque fiche est rédigée par notre conciergerie IATA et se conclut par un Conseil du Concierge — secret opérationnel concret. Réservation au tarif net GDS, paiement sécurisé Amadeus. Mise à jour ${freshness}.`,
    faqTitle: 'Le catalogue MyConciergeHotel — questions fréquentes',
    faq: [
      {
        q: 'Comment choisissez-vous les hôtels du catalogue ?',
        a: "Notre sélection est éditoriale et indépendante : un hôtel n'achète pas son entrée. Nous croisons la distinction Atout France (Palace), les étoiles Michelin de la table, le classement Forbes Travel Guide, les Michelin Keys, l'appartenance à une collection d'auteur (Relais & Châteaux, Leading Hotels of the World) et notre propre score interne (service, emplacement, signature). Chaque entrée est revue chaque trimestre par notre conciergerie.",
      },
      {
        q: 'Quels sont les principaux groupes hôteliers représentés ?',
        a: 'Le catalogue couvre 13 collections : Cheval Blanc, Airelles, Four Seasons, Rosewood, Mandarin Oriental, Raffles, The Peninsula, Oetker Collection (Le Bristol, Hôtel du Cap-Eden-Roc), Dorchester Collection (Le Meurice, Plaza Athénée), Shangri-La, Park Hyatt, Les K2 Collections (Courchevel) et Caudalie. Les adresses indépendantes — Negresco, Lutetia, Crillon, Villa La Coste — sont également présentes sans appartenance à une chaîne.',
      },
      {
        q: 'Quelle différence entre un Palace et un hôtel 5 étoiles ?',
        a: 'La mention « Palace » est une distinction officielle décernée par Atout France à seulement ~30 hôtels sur tout le territoire français, au-delà des 5 étoiles. Critères : service personnalisé, art de vivre, infrastructures (spa, restauration étoilée, conciergerie 24/7), rayonnement international. Tous les Palaces sont 5 étoiles, mais tous les 5 étoiles ne sont pas Palaces.',
      },
      {
        q: "Vos tarifs sont-ils plus chers que sur le site de l'hôtel ?",
        a: "Non. Nous sommes une agence IATA accréditée : nous accédons aux tarifs nets GDS d'Amadeus, identiques au tarif officiel public. Aucune commission ajoutée à votre charge. Notre comparateur de prix non affilié affiche en transparence les tarifs Booking, Hotels.com, Expedia pour les mêmes dates — vous voyez immédiatement le delta.",
      },
      {
        q: 'Puis-je réserver un hôtel international (Italie, Suisse, Maroc, Maldives) ?',
        a: 'Oui pour les pays ouverts dans notre catalogue international (Italie, Suisse, Maroc, Émirats arabes unis, Maldives, Thaïlande, Japon, États-Unis). Notre réseau GDS Amadeus couvre 950 000 hôtels dans le monde — au-delà du catalogue éditorial, tout hôtel listé peut être réservé sur demande via notre conciergerie.',
      },
      {
        q: 'Combien de temps pour confirmer ma réservation ?',
        a: 'En mode Amadeus (paiement direct par carte), la confirmation est instantanée. En mode conciergerie (par e-mail, hôtels non connectés GDS), votre concierge dédié vous adresse une proposition sous 24 heures ouvrées, généralement sous 4-6h.',
      },
    ] as const,
  },
  en: {
    eyebrow: 'Editorial catalog',
    titleFrance: '5★ Hotels and Palaces in France',
    titleWorld: '5★ Hotels and Palaces worldwide',
    subtitleFrance: (n: number) =>
      `${n} addresses curated by our concierge desk: Parisian Palaces, alpine retreats, Riviera havens, Bordeaux vineyards and Provence villas.`,
    subtitleWorld: (n: number) =>
      `${n} addresses curated by our concierge desk: Parisian Palaces, alpine retreats, Riviera havens, plus our first international entries across Asia, the Americas, Europe and the Middle East.`,
    sectionByRegion: 'By region',
    sectionByCountry: 'By country',
    sectionByBrand: 'By hotel group',
    franceSectionTitle: 'France — by region',
    worldSectionTitle: 'World — by country',
    palace: 'Palace',
    stars: '★',
    count: (n: number) => (n === 1 ? '1 address' : `${n} addresses`),
    seeFiche: 'View the page',
    metaTitleFrance: '5★ Hotels and Palaces in France — MyConciergeHotel Selection',
    metaTitleWorld: '5★ Hotels and Palaces worldwide — MyConciergeHotel Selection',
    metaDescFrance:
      'Discover our editorial selection of 5-star hotels and Palaces in France: Paris, French Riviera, Alps, Provence, Aquitaine. IATA booking, GDS net rates.',
    metaDescWorld:
      'Editorial selection of 5-star hotels and Palaces — France and our first international addresses across Asia, the Americas, Europe and the Middle East. IATA booking, GDS net rates.',
    aeoQ: 'Which 5-star hotels and Palaces does MyConciergeHotel cover in France?',
    aeoAnswer: (count: number, freshness: string) =>
      `MyConciergeHotel curates ${count} 5-star and Palace addresses across France and internationally, grouped by region and by collection (Cheval Blanc, Airelles, Four Seasons, Rosewood, Oetker, Dorchester). Every page is written by our IATA concierge desk and ends with a Concierge's Tip — a concrete operational secret. Booking at net GDS rates, secure Amadeus payment. Last updated ${freshness}.`,
    faqTitle: 'The MyConciergeHotel catalogue — frequently asked questions',
    faq: [
      {
        q: 'How do you choose the hotels in your catalogue?',
        a: "Our selection is editorial and independent — a hotel does not pay to be listed. We cross-reference Atout France's Palace distinction, the table's Michelin stars, the Forbes Travel Guide ranking, Michelin Keys, membership of an author collection (Relais & Châteaux, Leading Hotels of the World) and our own internal score (service, location, signature). Every entry is reviewed quarterly by our concierge team.",
      },
      {
        q: 'Which hotel groups are represented?',
        a: 'The catalogue covers 13 collections: Cheval Blanc, Airelles, Four Seasons, Rosewood, Mandarin Oriental, Raffles, The Peninsula, Oetker Collection (Le Bristol, Hôtel du Cap-Eden-Roc), Dorchester Collection (Le Meurice, Plaza Athénée), Shangri-La, Park Hyatt, Les K2 Collections (Courchevel) and Caudalie. Independent addresses — Negresco, Lutetia, Crillon, Villa La Coste — are also featured without chain affiliation.',
      },
      {
        q: 'What is the difference between a Palace and a 5-star hotel?',
        a: 'The "Palace" mention is an official distinction awarded by Atout France to roughly 30 hotels nationwide, above and beyond the 5-star rating. Criteria: bespoke service, art of living, infrastructure (spa, Michelin dining, 24/7 concierge), international reach. Every Palace is a 5-star, but not every 5-star is a Palace.',
      },
      {
        q: 'Are your rates more expensive than booking direct?',
        a: "No. We are an IATA-accredited agency: we access Amadeus GDS net rates, identical to the hotel's public published rate. No commission is added to your bill. Our non-affiliated price comparator transparently displays Booking, Hotels.com and Expedia rates for the same dates — you immediately see the delta.",
      },
      {
        q: 'Can I book an international hotel (Italy, Switzerland, Morocco, Maldives)?',
        a: 'Yes for the countries open in our international catalogue (Italy, Switzerland, Morocco, UAE, Maldives, Thailand, Japan, USA). Our Amadeus GDS network covers 950,000 hotels worldwide — beyond the editorial catalogue, any listed property can be booked on request via our concierge desk.',
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

  // generateMetadata runs before render so we sample the catalog here too.
  // The query is cached at the Supabase edge — second hit during render
  // returns in <5ms.
  const rows = await listPublishedHotelsForGrouping();
  const { foreign } = partitionByDomesticForeign(rows);
  const hasForeign = foreign.length > 0;

  const title = hasForeign ? t.metaTitleWorld : t.metaTitleFrance;
  const description = hasForeign ? t.metaDescWorld : t.metaDescFrance;
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

  const title = hasForeign ? t.titleWorld : t.titleFrance;
  const subtitle = hasForeign ? t.subtitleWorld(rows.length) : t.subtitleFrance(domestic.length);

  // ── Region clusters (France) ──────────────────────────────────────────
  const byRegion = groupByRegion(domestic);
  const regionsOrdered = [...byRegion.values()].sort((a, b) => b.hotels.length - a.hotels.length);

  // ── Country clusters (international) ──────────────────────────────────
  const byCountry = groupByCountry(foreign, locale);
  const countriesOrdered = [...byCountry.values()].sort(
    (a, b) => b.hotels.length - a.hotels.length || a.label.localeCompare(b.label, locale),
  );

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

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{title}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{subtitle}</p>
        <LastUpdatedBadge isoDate={todayIso} locale={locale} variant="inline" />
      </header>

      <HubAeoSection question={t.aeoQ} answer={aeoAnswer} headingId="hotels-aeo-title" />

      {/* Internal anchor strip — region jump-to (boosts maillage interne) */}
      {regionsOrdered.length > 0 ? (
        <nav
          aria-label={t.sectionByRegion}
          className="border-border mb-10 flex flex-wrap items-center gap-2 border-y py-3"
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
        <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">{t.franceSectionTitle}</h2>
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
                <header className="mb-6 flex items-baseline justify-between">
                  <h3 id={`${anchor}-title`} className="text-fg font-serif text-xl md:text-2xl">
                    {g.label}
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
