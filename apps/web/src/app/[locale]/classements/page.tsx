import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { RankingsFacets } from '@/components/rankings/rankings-facets';
import { HubAeoSection } from '@/components/seo/hub-aeo-section';
import { HubFaqSection } from '@/components/seo/hub-faq-section';
import { JsonLdScript } from '@/components/seo/json-ld';
import { LastUpdatedBadge } from '@/components/seo/last-updated-badge';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { getPathname } from '@/i18n/navigation';
import { buildHreflangAlternates, hreflangKey, intlLocaleTag, ogLocale } from '@/i18n/runtime';
import { pickByLocale, pickLocalizedText } from '@/i18n/supported-locale';
import { env } from '@/lib/env';
import {
  listPublishedRankings,
  type PublishedRankingCard,
} from '@/server/rankings/get-ranking-by-slug';

// ADR-0007 — ISR (auth client island handles per-user UI). Mirrors
// detail page revalidation cadence.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    eyebrow: 'Classements éditoriaux',
    title: 'Nos classements d’hôtels d’exception',
    subtitle: (n: number) =>
      `${n} classements éditoriaux rédigés par notre conciergerie : les plus beaux hôtels d’exception dans le monde, par destination, par thématique, ou par distinction.`,
    metaTitle: 'Classements d’hôtels d’exception — MyConciergeHotel',
    metaDesc:
      'Découvrez nos classements éditoriaux : meilleurs Palaces, Relais & Châteaux, hôtels de luxe par destination (Paris, Italie, Japon, Maroc, Maldives…), spa, gastronomie, romantisme.',
    entriesCount: (n: number) => (n === 1 ? '1 hôtel' : `${n} hôtels`),
    seeRanking: 'Lire le classement',
    searchPlaceholder: 'Filtrer par mot-clé (ex : Paris, spa, Palace, Relais & Châteaux)…',
    emptyLabel: 'Aucun classement ne correspond à votre filtre.',
    clearLabel: 'Réinitialiser',
    // Template strings (no functions) so we can pass them across the
    // RSC ↔ Client Component boundary. `{n}` is interpolated client-side.
    resultsLabelTpl: '{n} résultats',
    facetType: 'Type',
    facetLieu: 'Destination',
    facetTheme: 'Thématique',
    facetOccasion: 'Occasion',
    subhubsLabel: 'Voir le sous-hub',
    aeoQ: 'Comment fonctionnent les classements MyConciergeHotel ?',
    aeoAnswer: (n: number, freshness: string) =>
      `MyConciergeHotel publie ${n} classements éditoriaux d’hôtels d’exception dans le monde (Palaces Atout France, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World), croisés sur quatre axes (type, destination, thématique, occasion) et un calendrier saisonnier. Chaque classement est rédigé par notre conciergerie : méthode transparente, sources nommées, aucun pay-to-play. Lecture moyenne 5-8 min, mise à jour ${freshness}.`,
    faqTitle: 'Nos classements — questions fréquentes',
    faq: [
      {
        q: 'Sur quels critères classez-vous les hôtels ?',
        a: "Notre score interne combine la distinction Atout France (Palace, 5★), les Michelin Keys, les étoiles Michelin de la table, le rang Forbes Travel Guide, l'appartenance à une collection d'auteur (Relais & Châteaux, LHW), l'avis Amadeus (sentiments agrégés), et un coefficient éditorial de notre conciergerie (service, signature, emplacement). Toutes les sources sont nommées en bas de chaque classement.",
      },
      {
        q: 'Les hôtels paient-ils pour apparaître dans un classement ?',
        a: 'Non. MyConciergeHotel est une agence IATA, pas une plateforme publicitaire. Aucun hôtel ne paie son entrée dans nos classements. Notre revenu vient des commissions sur les réservations, identiques à toutes les agences IATA, et non du référencement.',
      },
      {
        q: 'À quelle fréquence les classements sont-ils mis à jour ?',
        a: "Trimestriellement pour les classements pilier (meilleurs Palaces de France, de Paris, de la Côte d'Azur) et semestriellement pour les classements thématiques (spa, gastronomie, famille). La date de dernière revue éditoriale est affichée sous le titre de chaque classement.",
      },
      {
        q: 'Puis-je filtrer les classements par destination, thème ou occasion ?',
        a: "Oui — les facettes au-dessus de la liste permettent de croiser un type (Palace, 5★, château), une destination (Paris, Côte d'Azur, Alpes), une thématique (spa, gastronomie, design) et une occasion (lune de miel, mariage, séminaire). Les sous-hubs `/classements/{axe}/{valeur}` agrègent les classements pour un même axe.",
      },
      {
        q: "Pourquoi un classement n'apparaît pas sur la liste ?",
        a: "Soit le classement n'est pas encore publié (l'éditorial est en cours de rédaction), soit il a été archivé suite à une refonte (anti-cannibalisation). Les redirections 301 conservent toujours le lien.",
      },
      {
        q: "Comment réserver un hôtel d'un classement ?",
        a: 'Chaque entrée de classement renvoie vers la fiche hôtel complète, qui intègre le moteur de réservation (tarifs nets GDS Amadeus, paiement sécurisé, programme de fidélité). Aucun supplément ajouté.',
      },
    ] as const,
  },
  en: {
    eyebrow: 'Editorial rankings',
    title: 'Our rankings of extraordinary hotels',
    subtitle: (n: number) =>
      `${n} editorial rankings written by our concierge desk — the most extraordinary hotels in the world, by destination, theme or distinction.`,
    metaTitle: 'Hotel rankings — MyConciergeHotel',
    metaDesc:
      'Discover our editorial rankings: the finest Palaces, Relais & Châteaux, luxury hotels by destination (Paris, Italy, Japan, Morocco, the Maldives…), spa, gastronomy, romance.',
    entriesCount: (n: number) => (n === 1 ? '1 hotel' : `${n} hotels`),
    seeRanking: 'Read the ranking',
    searchPlaceholder: 'Filter by keyword (e.g. Paris, spa, Palace, Relais & Châteaux)…',
    emptyLabel: 'No ranking matches your filter.',
    clearLabel: 'Clear',
    resultsLabelTpl: '{n} results',
    facetType: 'Type',
    facetLieu: 'Destination',
    facetTheme: 'Theme',
    facetOccasion: 'Occasion',
    subhubsLabel: 'View sub-hub',
    aeoQ: 'How do the MyConciergeHotel rankings work?',
    aeoAnswer: (n: number, freshness: string) =>
      `MyConciergeHotel publishes ${n} editorial rankings of extraordinary hotels worldwide (Atout France Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World), faceted across four axes (type, destination, theme, occasion) and a seasonal calendar. Every ranking is authored by our concierge desk: transparent methodology, named sources, no pay-to-play. 5-8 min read on average, last updated ${freshness}.`,
    faqTitle: 'Our rankings — frequently asked questions',
    faq: [
      {
        q: 'On what criteria do you rank hotels?',
        a: "Our internal score combines the Atout France distinction (Palace, 5-star), Michelin Keys, the dining venue's Michelin stars, the Forbes Travel Guide rank, membership of an author collection (Relais & Châteaux, LHW), the aggregated Amadeus sentiment rating, and an editorial coefficient set by our concierge team (service, signature, location). Every source is named at the bottom of each ranking.",
      },
      {
        q: 'Do hotels pay to appear in a ranking?',
        a: 'No. MyConciergeHotel is an IATA-accredited travel agency, not an advertising platform. No hotel pays for inclusion. Our revenue comes from commissions on bookings, identical to any IATA agency, never from listing fees.',
      },
      {
        q: 'How often are rankings updated?',
        a: 'Quarterly for pillar rankings (best Palaces of France, of Paris, of the French Riviera) and biannually for thematic rankings (spa, gastronomy, family). The latest editorial review date is displayed below the title of each ranking.',
      },
      {
        q: 'Can I filter rankings by destination, theme or occasion?',
        a: 'Yes — the facets above the list let you cross-filter by type (Palace, 5-star, château), destination (Paris, French Riviera, Alps), theme (spa, gastronomy, design) and occasion (honeymoon, wedding, seminar). Sub-hubs `/classements/{axis}/{value}` aggregate the rankings for the same axis.',
      },
      {
        q: "Why doesn't a ranking show up in the list?",
        a: "Either the ranking isn't published yet (the editorial draft is in progress), or it's been archived following an anti-cannibalisation revamp. 301 redirects always preserve the link.",
      },
      {
        q: 'How do I book a hotel from a ranking?',
        a: 'Every ranking entry links to the full hotel page, which embeds the booking engine (Amadeus GDS net rates, secure payment, loyalty programme). No markup added.',
      },
    ] as const,
  },
} as const;

const TYPE_LABEL: Record<string, { fr: string; en: string }> = {
  // `all` is emitted by the ranking matrice when a classement isn't tied to
  // a single hotel "type" (e.g. "plus-beaux-hotels-france" covers Palaces +
  // 5★ + Châteaux + Villas + Maisons d'hôtes). Without an explicit label
  // the `labelOrFallback` helper capitalises the raw slug → "All", which
  // leaks English into the FR facet list. See FR-residuals audit, May 2026.
  all: { fr: 'Tous types', en: 'All types' },
  palace: { fr: 'Palaces', en: 'Palaces' },
  '5-etoiles': { fr: '5 étoiles', en: '5 stars' },
  '4-etoiles': { fr: '4 étoiles', en: '4 stars' },
  'boutique-hotel': { fr: 'Boutique-hôtels', en: 'Boutique hotels' },
  chateau: { fr: 'Châteaux', en: 'Châteaux' },
  chalet: { fr: 'Chalets', en: 'Chalets' },
  villa: { fr: 'Villas', en: 'Villas' },
  'maison-hotes': { fr: "Maisons d'hôtes", en: 'Guesthouses' },
  resort: { fr: 'Resorts', en: 'Resorts' },
  ecolodge: { fr: 'Écolodges', en: 'Ecolodges' },
};

const THEME_LABEL: Record<string, { fr: string; en: string }> = {
  romantique: { fr: 'Romantique', en: 'Romantic' },
  famille: { fr: 'Famille', en: 'Family' },
  'spa-bienetre': { fr: 'Spa & bien-être', en: 'Spa & wellness' },
  gastronomie: { fr: 'Gastronomie', en: 'Gastronomy' },
  design: { fr: 'Design', en: 'Design' },
  patrimoine: { fr: 'Patrimoine', en: 'Heritage' },
  vignobles: { fr: 'Vignobles', en: 'Vineyards' },
  mer: { fr: 'Mer', en: 'Seaside' },
  montagne: { fr: 'Montagne', en: 'Mountain' },
  campagne: { fr: 'Campagne', en: 'Countryside' },
  urbain: { fr: 'Urbain', en: 'Urban' },
  'sport-golf': { fr: 'Golf', en: 'Golf' },
  'sport-tennis': { fr: 'Tennis', en: 'Tennis' },
  'sport-padel': { fr: 'Padel', en: 'Padel' },
  'sport-surf': { fr: 'Surf', en: 'Surf' },
  'sport-ski': { fr: 'Ski', en: 'Ski' },
  rooftop: { fr: 'Rooftop', en: 'Rooftop' },
  piscine: { fr: 'Piscine', en: 'Pool' },
  'kids-friendly': { fr: 'Kids-friendly', en: 'Kids-friendly' },
  insolite: { fr: 'Insolite', en: 'Unique' },
};

const OCCASION_LABEL: Record<string, { fr: string; en: string }> = {
  'week-end': { fr: 'Week-end', en: 'Weekend' },
  'lune-de-miel': { fr: 'Lune de miel', en: 'Honeymoon' },
  anniversaire: { fr: 'Anniversaire', en: 'Anniversary' },
  seminaire: { fr: 'Séminaire', en: 'Seminar' },
  mariage: { fr: 'Mariage', en: 'Wedding' },
  escapade: { fr: 'Escapade', en: 'Getaway' },
  staycation: { fr: 'Staycation', en: 'Staycation' },
  fetes: { fr: 'Fêtes', en: 'Holidays' },
  minceur: { fr: 'Minceur', en: 'Wellness retreat' },
};

function labelOrFallback(
  dict: Record<string, { fr: string; en: string }>,
  key: string,
  locale: Locale,
): string {
  const entry = dict[key];
  if (entry !== undefined) return entry[locale];
  return key.replace(/-/g, ' ').replace(/^\w/u, (c) => c.toUpperCase());
}

function buildFacets(
  rankings: ReadonlyArray<PublishedRankingCard>,
  locale: Locale,
  t: (typeof T)[Locale],
) {
  const counts = {
    type: new Map<string, number>(),
    lieu: new Map<string, { label: string; count: number }>(),
    theme: new Map<string, number>(),
    occasion: new Map<string, number>(),
  };

  for (const r of rankings) {
    for (const ty of r.axes.types) counts.type.set(ty, (counts.type.get(ty) ?? 0) + 1);
    for (const th of r.axes.themes) counts.theme.set(th, (counts.theme.get(th) ?? 0) + 1);
    for (const o of r.axes.occasions) counts.occasion.set(o, (counts.occasion.get(o) ?? 0) + 1);
    if (r.axes.lieu !== undefined) {
      const slug = r.axes.lieu.slug;
      const cur = counts.lieu.get(slug) ?? { label: r.axes.lieu.label, count: 0 };
      counts.lieu.set(slug, { label: cur.label, count: cur.count + 1 });
    }
  }

  return [
    {
      id: 'type' as const,
      label: t.facetType,
      options: Array.from(counts.type.entries())
        .map(([value, count]) => ({
          value,
          label: labelOrFallback(TYPE_LABEL, value, locale),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    },
    {
      id: 'lieu' as const,
      label: t.facetLieu,
      options: Array.from(counts.lieu.entries())
        .map(([value, v]) => ({ value, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count),
    },
    {
      id: 'theme' as const,
      label: t.facetTheme,
      options: Array.from(counts.theme.entries())
        .map(([value, count]) => ({
          value,
          label: labelOrFallback(THEME_LABEL, value, locale),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    },
    {
      id: 'occasion' as const,
      label: t.facetOccasion,
      options: Array.from(counts.occasion.entries())
        .map(([value, count]) => ({
          value,
          label: labelOrFallback(OCCASION_LABEL, value, locale),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  const t = T[locale];
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({ locale: l, href: '/classements' });
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDesc,
      type: 'website',
      locale: ogLocale(locale),
    },
  };
}

export default async function RankingsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  const t = T[locale];
  // Defensive: degrade to an empty hub when Supabase is unreachable
  // (CI prerender, transient DB outage). Skill: nextjs-app-router.
  let rankings: readonly PublishedRankingCard[];
  try {
    rankings = await listPublishedRankings();
  } catch {
    rankings = [];
  }
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const cards = rankings.map((r) => ({
    slug: r.slug,
    title: pickByLocale(locale, r.titleFr, r.titleEn ?? r.titleFr),
    subtitle: pickLocalizedText(locale, r.factualSummaryFr, r.factualSummaryEn),
    entryCount: r.entryCount,
    // Pre-rendered to avoid passing a function across the RSC ↔ Client
    // Component boundary (Next.js refuses).
    entryCountLabel: t.entriesCount(r.entryCount),
    kind: r.kind,
    types: r.axes.types,
    lieuSlug: r.axes.lieu?.slug ?? null,
    lieuLabel: r.axes.lieu?.label ?? null,
    themes: r.axes.themes,
    occasions: r.axes.occasions,
  }));
  const facets = buildFacets(rankings, locale, t);

  // Latest updated_at across all rankings → drives `dateModified`
  // on the CollectionPage JSON-LD and the badge below the H1.
  const latestUpdate = rankings.reduce<string | null>((acc, r) => {
    if (r.updatedAt === null) return acc;
    if (acc === null) return r.updatedAt;
    return r.updatedAt > acc ? r.updatedAt : acc;
  }, null);

  const collectionJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.collectionPageJsonLd({
      name: t.title,
      url: `${origin}${getPathname({ locale, href: '/classements' })}`,
      description: t.metaDesc,
      ...(latestUpdate !== null ? { dateModified: latestUpdate } : {}),
      itemList: {
        name: t.title,
        items: cards.map((c) => ({
          name: c.title,
          url: `${origin}${getPathname({
            locale,
            href: { pathname: '/classement/[slug]', params: { slug: c.slug } },
          })}`,
        })),
      },
      inLanguage: hreflangKey(locale),
    }),
  );

  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        // TODO i18n Phase 1c-β: migrate hardcoded breadcrumb labels to
        // next-intl messages. The `pickByLocale` keeps DE/ES/IT aligned
        // with the FR data fallback policy until those messages exist.
        name: pickByLocale(locale, 'Accueil', 'Home'),
        url: `${origin}${getPathname({ locale, href: '/' })}`,
      },
      {
        name: pickByLocale(locale, 'Classements', 'Rankings'),
        url: `${origin}${getPathname({ locale, href: '/classements' })}`,
      },
    ]),
  );

  // Freshness signal embedded in the AEO answer — locale-aware month
  // formatting matches the visible badge below the H1 (triple-sync
  // per skill `geo-llm-optimization` §Freshness).
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(latestUpdate !== null ? new Date(latestUpdate) : new Date());
  const aeoAnswer = t.aeoAnswer(rankings.length, freshnessDate);

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10 sm:py-14">
      <JsonLdScript data={breadcrumbJsonLd} nonce={nonce} />
      <JsonLdScript data={collectionJsonLd} nonce={nonce} />

      <header className="mb-8 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{t.title}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{t.subtitle(rankings.length)}</p>
        <LastUpdatedBadge isoDate={latestUpdate} locale={locale} variant="inline" />
      </header>

      <HubAeoSection question={t.aeoQ} answer={aeoAnswer} headingId="classements-aeo-title" />

      <RankingsFacets
        rankings={cards}
        facets={facets}
        seeRankingLabel={t.seeRanking}
        searchPlaceholder={t.searchPlaceholder}
        emptyLabel={t.emptyLabel}
        clearLabel={t.clearLabel}
        resultsLabelTpl={t.resultsLabelTpl}
        subhubsLabel={t.subhubsLabel}
      />

      <HubFaqSection
        heading={t.faqTitle}
        items={t.faq.map((f) => ({ question: f.q, answer: f.a }))}
      />
    </main>
  );
}
