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
import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

type BrandScope =
  | { readonly kind: 'france-only' }
  | { readonly kind: 'multi-country'; readonly countryCount: number }
  | { readonly kind: 'single-non-france'; readonly countryLabel: string };

const T = {
  fr: {
    eyebrow: 'Groupe hôtelier',
    suffix: (scope: BrandScope): string => {
      if (scope.kind === 'france-only') return 'en France';
      if (scope.kind === 'single-non-france') return `— ${scope.countryLabel}`;
      return 'dans le monde';
    },
    subtitle: (brand: string, n: number, scope: BrandScope): string => {
      if (scope.kind === 'france-only') {
        return `Les ${n} adresses ${brand} de notre catalogue éditorial en France — sélection IATA MyConciergeHotel.`;
      }
      if (scope.kind === 'single-non-france') {
        return `Les ${n} adresses ${brand} sélectionnées par notre conciergerie au ${scope.countryLabel}.`;
      }
      return `Les ${n} adresses ${brand} sélectionnées par notre conciergerie dans ${scope.countryCount} pays.`;
    },
    palace: 'Palace',
    stars: '★',
    seeFiche: 'Voir la fiche',
    breadcrumbHome: 'Accueil',
    breadcrumbHotels: 'Hôtels',
    metaTitle: (brand: string, scope: BrandScope): string => {
      if (scope.kind === 'france-only')
        return `${brand} en France — Hôtels & Palaces | MyConciergeHotel`;
      if (scope.kind === 'single-non-france')
        return `${brand} — ${scope.countryLabel} | MyConciergeHotel`;
      return `${brand} — sélection mondiale | MyConciergeHotel`;
    },
    metaDesc: (brand: string, n: number, scope: BrandScope): string => {
      if (scope.kind === 'france-only') {
        return `Découvrez les ${n} adresses ${brand} en France de notre sélection éditoriale : Palaces, hôtels 5 étoiles. Réservation IATA, tarifs nets GDS.`;
      }
      if (scope.kind === 'single-non-france') {
        return `Découvrez les ${n} adresses ${brand} au ${scope.countryLabel}, sélectionnées par notre conciergerie. Réservation IATA, tarifs nets GDS.`;
      }
      return `Découvrez les ${n} adresses ${brand} dans ${scope.countryCount} pays, sélectionnées par notre conciergerie. Réservation IATA, tarifs nets GDS.`;
    },
    faqTitle: 'Questions sur la marque',
  },
  en: {
    eyebrow: 'Hotel group',
    suffix: (scope: BrandScope): string => {
      if (scope.kind === 'france-only') return 'in France';
      if (scope.kind === 'single-non-france') return `— ${scope.countryLabel}`;
      return 'worldwide';
    },
    subtitle: (brand: string, n: number, scope: BrandScope): string => {
      if (scope.kind === 'france-only') {
        return `The ${n} ${brand} addresses in France from our editorial catalog — MyConciergeHotel IATA selection.`;
      }
      if (scope.kind === 'single-non-france') {
        return `The ${n} ${brand} addresses in ${scope.countryLabel}, curated by our concierge desk.`;
      }
      return `The ${n} ${brand} addresses curated by our concierge desk across ${scope.countryCount} countries.`;
    },
    palace: 'Palace',
    stars: '★',
    seeFiche: 'View the page',
    breadcrumbHome: 'Home',
    breadcrumbHotels: 'Hotels',
    metaTitle: (brand: string, scope: BrandScope): string => {
      if (scope.kind === 'france-only')
        return `${brand} in France — Hotels & Palaces | MyConciergeHotel`;
      if (scope.kind === 'single-non-france')
        return `${brand} — ${scope.countryLabel} | MyConciergeHotel`;
      return `${brand} — worldwide selection | MyConciergeHotel`;
    },
    metaDesc: (brand: string, n: number, scope: BrandScope): string => {
      if (scope.kind === 'france-only') {
        return `Discover the ${n} ${brand} addresses in France from our editorial selection: Palaces, 5-star hotels. IATA booking, GDS net rates.`;
      }
      if (scope.kind === 'single-non-france') {
        return `Discover the ${n} ${brand} addresses in ${scope.countryLabel}, curated by our concierge desk. IATA booking, GDS net rates.`;
      }
      return `Discover the ${n} ${brand} addresses across ${scope.countryCount} countries, curated by our concierge desk. IATA booking, GDS net rates.`;
    },
    faqTitle: 'Questions about the brand',
  },
} as const;

function computeBrandScope(
  hotels: readonly {
    readonly countryCode: string | null;
    readonly countryLabelFr: string | null;
    readonly countryLabelEn: string | null;
  }[],
  locale: Locale,
): BrandScope {
  const codes = new Set<string>();
  let firstLabelFr: string | null = null;
  let firstLabelEn: string | null = null;
  for (const h of hotels) {
    const code = (h.countryCode ?? 'FR').toUpperCase();
    codes.add(code);
    if (firstLabelFr === null) firstLabelFr = h.countryLabelFr;
    if (firstLabelEn === null) firstLabelEn = h.countryLabelEn;
  }
  if (codes.size === 0 || (codes.size === 1 && codes.has('FR'))) {
    return { kind: 'france-only' };
  }
  if (codes.size === 1) {
    const label =
      pickByLocale(locale, firstLabelFr ?? '', firstLabelEn ?? firstLabelFr ?? '') ||
      'à l’étranger';
    return { kind: 'single-non-france', countryLabel: label };
  }
  return { kind: 'multi-country', countryCount: codes.size };
}

/**
 * Editorial descriptors per brand — fuel the AEO answer block. Kept
 * separate from `BRAND_FAMILIES` (which stays pure detection logic)
 * so editors can refine the marketing copy without touching the
 * regex layer.
 *
 * Sentence ≤ 25 words rule (rules/editorial-voice.mdc). Concierge voice
 * (expert complice, never journalistic). FR canonical, EN translation.
 */
const BRAND_DESCRIPTORS: Readonly<
  Record<string, { readonly positioningFr: string; readonly positioningEn: string }>
> = {
  'cheval-blanc': {
    positioningFr:
      'maison LVMH née à Courchevel en 2006 puis déployée à Paris (La Samaritaine, 2021) et Saint-Tropez (Cheval Blanc St-Tropez)',
    positioningEn:
      'LVMH house born in Courchevel in 2006, then extended to Paris (La Samaritaine, 2021) and Saint-Tropez',
  },
  airelles: {
    positioningFr:
      'collection française fondée en 1992 à Courchevel par Stéphane Courbit, désormais présente à Versailles (Le Grand Contrôle, 2021) et Saint-Tropez (Château de la Messardière, 2022)',
    positioningEn:
      'French collection founded in 1992 in Courchevel, now spanning Versailles (Le Grand Contrôle, 2021) and Saint-Tropez (Château de la Messardière, 2022)',
  },
  'four-seasons': {
    positioningFr:
      'enseigne canadienne reconnue pour son service Forbes Five-Star — en France à Paris (George V, Palace 2009) et Megève (Four Seasons Megève)',
    positioningEn:
      'Canadian flagship known for Forbes Five-Star service — in France at Paris (George V, Palace 2009) and Megève',
  },
  rosewood: {
    positioningFr:
      "collection américaine A Sense of Place fondée par Caroline Hunt — l'Hôtel de Crillon à Paris (Palace, réouvert 2017) est sa seule adresse française",
    positioningEn:
      'American "A Sense of Place" collection founded by Caroline Hunt — Hôtel de Crillon (Paris Palace, reopened 2017) is its only French address',
  },
  raffles: {
    positioningFr:
      'enseigne mythique née à Singapour en 1887 (groupe Accor) — incarnée à Paris par Le Royal Monceau – Raffles Paris (Palace, distinction 2024)',
    positioningEn:
      'legendary brand born in Singapore in 1887 (Accor group) — represented in Paris by Le Royal Monceau – Raffles Paris (Palace 2024)',
  },
  peninsula: {
    positioningFr:
      'maison hongkongaise fondée en 1928 (Hongkong & Shanghai Hotels) — The Peninsula Paris (Palace 2014) en est le seul ambassadeur français',
    positioningEn:
      'Hong Kong house founded in 1928 (Hongkong & Shanghai Hotels) — The Peninsula Paris (Palace 2014) is its only French ambassador',
  },
  'mandarin-oriental': {
    positioningFr:
      "collection asiatique fondée en 1963 — en France à Paris (Mandarin Oriental Paris, Palace 2012) et bientôt sur la Côte d'Azur",
    positioningEn:
      "Asian collection founded in 1963 — in France at Paris (Mandarin Oriental Paris, Palace 2012) and soon on the Côte d'Azur",
  },
  'shangri-la': {
    positioningFr:
      'enseigne hongkongaise née en 1971 — Shangri-La Paris (Palace 2014), ancien hôtel particulier du prince Roland Bonaparte, est son adresse française',
    positioningEn:
      'Hong Kong brand born in 1971 — Shangri-La Paris (Palace 2014), the former mansion of Prince Roland Bonaparte, is its French address',
  },
  'park-hyatt': {
    positioningFr:
      "sous-marque haut de gamme du groupe Hyatt — Park Hyatt Paris-Vendôme (Palace 2011) est l'unique adresse française de la collection",
    positioningEn:
      "Hyatt's luxury flagship — Park Hyatt Paris-Vendôme (Palace 2011) is the collection's only French address",
  },
  'oetker-collection': {
    positioningFr:
      "collection allemande Masterpiece Hotels — en France Le Bristol Paris, Hôtel du Cap-Eden-Roc, Fouquet's Paris, Château Saint-Martin & Spa, L'Apogée Courchevel",
    positioningEn:
      "German Masterpiece Hotels collection — in France Le Bristol Paris, Hôtel du Cap-Eden-Roc, Fouquet's Paris, Château Saint-Martin & Spa, L'Apogée Courchevel",
  },
  'dorchester-collection': {
    positioningFr:
      'collection britannique fondée en 1996 (Brunei Investment Agency) — Le Meurice et Plaza Athénée à Paris, deux Palaces emblématiques de la rive droite',
    positioningEn:
      'British collection founded in 1996 (Brunei Investment Agency) — Le Meurice and Plaza Athénée in Paris, two iconic Right Bank Palaces',
  },
  'les-k2': {
    positioningFr:
      "collection française née à Courchevel sous l'impulsion de la famille Capezzone — K2 Palace, K2 Altitude, K2 Djola, K2 Chogori",
    positioningEn:
      'French collection born in Courchevel under the Capezzone family — K2 Palace, K2 Altitude, K2 Djola, K2 Chogori',
  },
  caudalie: {
    positioningFr:
      'vinothérapie haut de gamme née aux Sources de Caudalie (Bordeaux, 1999) — désormais à Saint-Émilion et bientôt en Provence',
    positioningEn:
      'high-end vinotherapy born at Les Sources de Caudalie (Bordeaux, 1999) — now in Saint-Émilion and soon in Provence',
  },
};

function brandAeoAnswer(args: {
  readonly brandLabel: string;
  readonly brandSlug: string;
  readonly count: number;
  readonly cities: readonly string[];
  readonly palaceCount: number;
  readonly locale: Locale;
  readonly freshnessDate: string;
  readonly scope: BrandScope;
}): string {
  const desc = BRAND_DESCRIPTORS[args.brandSlug];
  const positioning =
    desc !== undefined ? pickByLocale(args.locale, desc.positioningFr, desc.positioningEn) : '';
  const citiesLabel = args.cities.slice(0, 4).join(', ');
  const palaceClause =
    args.palaceCount > 0
      ? pickByLocale(
          args.locale,
          `dont ${args.palaceCount} Palace${args.palaceCount > 1 ? 's' : ''} distingué${args.palaceCount > 1 ? 's' : ''} par Atout France`,
          `including ${args.palaceCount} Palace${args.palaceCount > 1 ? 's' : ''} certified by Atout France`,
        )
      : pickByLocale(args.locale, 'hôtels 5 étoiles', '5-star hotels');
  const scopeLabelFr =
    args.scope.kind === 'france-only'
      ? 'en France'
      : args.scope.kind === 'single-non-france'
        ? `au ${args.scope.countryLabel}`
        : `dans ${args.scope.countryCount} pays`;
  const scopeLabelEn =
    args.scope.kind === 'france-only'
      ? 'in France'
      : args.scope.kind === 'single-non-france'
        ? `in ${args.scope.countryLabel}`
        : `across ${args.scope.countryCount} countries`;
  const intro = pickByLocale(
    args.locale,
    `MyConciergeHotel référence ${args.count} adresse${args.count > 1 ? 's' : ''} ${args.brandLabel} ${scopeLabelFr} au ${args.freshnessDate}`,
    `MyConciergeHotel lists ${args.count} ${args.brandLabel} address${args.count > 1 ? 'es' : ''} ${scopeLabelEn} as of ${args.freshnessDate}`,
  );
  const middle =
    positioning.length > 0
      ? pickByLocale(args.locale, ` — ${positioning}`, ` — ${positioning}`)
      : '';
  const closing = pickByLocale(
    args.locale,
    `, ${palaceClause}, répartis sur ${citiesLabel}. Réservation IATA, tarifs nets GDS Amadeus.`,
    `, ${palaceClause}, across ${citiesLabel}. IATA booking, GDS net rates via Amadeus.`,
  );
  return `${intro}${middle}${closing}`;
}

function brandFaqItems(args: {
  readonly brandLabel: string;
  readonly count: number;
  readonly cities: readonly string[];
  readonly locale: Locale;
  readonly scope: BrandScope;
}): readonly { readonly question: string; readonly answer: string }[] {
  const citiesLabel = args.cities.slice(0, 4).join(', ');
  const scopeLabelFr =
    args.scope.kind === 'france-only'
      ? 'en France'
      : args.scope.kind === 'single-non-france'
        ? `au ${args.scope.countryLabel}`
        : `dans ${args.scope.countryCount} pays`;
  const scopeLabelEn =
    args.scope.kind === 'france-only'
      ? 'in France'
      : args.scope.kind === 'single-non-france'
        ? `in ${args.scope.countryLabel}`
        : `across ${args.scope.countryCount} countries`;
  const questionScopeFr = args.scope.kind === 'france-only' ? ' en France' : '';
  const questionScopeEn = args.scope.kind === 'france-only' ? ' in France' : '';
  if (args.locale === 'fr') {
    return [
      {
        question: `Combien d'hôtels ${args.brandLabel} sont disponibles${questionScopeFr} ?`,
        answer: `MyConciergeHotel sélectionne ${args.count} adresse${args.count > 1 ? 's' : ''} ${args.brandLabel} ${scopeLabelFr}, ${args.cities.length > 1 ? `réparties entre ${citiesLabel}` : `située à ${citiesLabel}`}. Chaque fiche détaille la classification (Palace, 5 étoiles), les services et les tarifs nets disponibles via notre licence IATA.`,
      },
      {
        question: `Comment réserver un hôtel ${args.brandLabel} via MyConciergeHotel ?`,
        answer: `Notre conciergerie IATA accède directement aux tarifs nets du GDS Amadeus, identiques à ceux du site officiel ${args.brandLabel} mais sans intermédiaire commissionné. Une demande de réservation déclenche un échange direct avec nos concierges hôteliers — disponibilités, surclassements, demandes spéciales.`,
      },
      {
        question: `Quelle est la différence entre ${args.brandLabel} et un Palace indépendant ?`,
        answer: `${args.brandLabel} est une collection ou un groupe — chaque adresse partage des standards de service (formation des équipes, programme de fidélité, signature culinaire). Un Palace indépendant comme Le Negresco ou L'Hôtel suit ses propres codes, sans appartenance de groupe. Les deux sont éligibles au statut Palace Atout France.`,
      },
      {
        question: `MyConciergeHotel propose-t-il les avantages fidélité ${args.brandLabel} ?`,
        answer: `Les programmes de fidélité ${args.brandLabel} (statut, points, surclassements) sont conservés lorsque le client communique son numéro de membre lors de la réservation. Notre rôle est de garantir le tarif officiel le plus avantageux et un service de conciergerie en amont du séjour — jamais de remplacer le programme de la marque.`,
      },
    ];
  }
  return [
    {
      question: `How many ${args.brandLabel} hotels are available${questionScopeEn}?`,
      answer: `MyConciergeHotel curates ${args.count} ${args.brandLabel} address${args.count > 1 ? 'es' : ''} ${scopeLabelEn}, ${args.cities.length > 1 ? `spread across ${citiesLabel}` : `located in ${citiesLabel}`}. Each page details the classification (Palace, 5-star), services, and net rates available through our IATA licence.`,
    },
    {
      question: `How do I book a ${args.brandLabel} hotel via MyConciergeHotel?`,
      answer: `Our IATA concierge desk accesses Amadeus GDS net rates — identical to the official ${args.brandLabel} site but without commission intermediaries. A booking request triggers direct contact with our hotel concierges for availability, upgrades, and special requests.`,
    },
    {
      question: `What is the difference between ${args.brandLabel} and an independent Palace?`,
      answer: `${args.brandLabel} is a collection or group — every address shares service standards (team training, loyalty program, culinary signature). An independent Palace like Le Negresco or L'Hôtel follows its own codes, with no group affiliation. Both can hold the Atout France Palace distinction.`,
    },
    {
      question: `Does MyConciergeHotel honour ${args.brandLabel} loyalty benefits?`,
      answer: `${args.brandLabel} loyalty programs (status, points, upgrades) are preserved when guests provide their membership number at booking. Our role is to guarantee the best official rate and pre-stay concierge service — never to replace the brand's program.`,
    },
  ];
}

export async function generateStaticParams(): Promise<{ brandSlug: string }[]> {
  return KNOWN_BRANDS.map((b) => ({ brandSlug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; brandSlug: string }>;
}): Promise<Metadata> {
  const { locale: raw, brandSlug } = await params;
  if (!isRoutingLocale(raw)) return {};
  const brand = KNOWN_BRANDS.find((b) => b.slug === brandSlug);
  if (brand === undefined) return {};

  const allHotels = await listPublishedHotelsForIndex();
  const brandHotels = allHotels.filter((h) => detectBrand(h.nameFr)?.slug === brand.slug);
  const count = brandHotels.length;
  const locale: Locale = raw;
  // Explicit lookup instead of `T[locale]`. The dynamic index combined
  // with the `as const` typing on `T` triggered a Turbopack production-
  // build `ReferenceError: locale is not defined` on this server
  // component (the local Node build was fine). Confirmed in Vercel
  // runtime logs for /marque/* across two consecutive prod deploys.
  const t = locale === 'fr' ? T.fr : T.en;
  const scope = computeBrandScope(brandHotels, locale);
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/marque/[brandSlug]', params: { brandSlug: brand.slug } },
    });

  return {
    title: t.metaTitle(brand.label, scope),
    description: t.metaDesc(brand.label, count, scope),
    alternates: {
      canonical: buildCanonicalPath(locale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t.metaTitle(brand.label, scope),
      description: t.metaDesc(brand.label, count, scope),
      type: 'website',
      locale: ogLocale(locale),
    },
    // Brand exists but no published hotel yet → keep the URL resolvable
    // but mark `noindex, follow` to avoid soft-404s while Google still
    // discovers categorical links. Skill `seo-technical` §Indexability.
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ locale: string; brandSlug: string }>;
}) {
  const { locale: raw, brandSlug } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const brand = KNOWN_BRANDS.find((b) => b.slug === brandSlug);
  if (brand === undefined) notFound();

  const locale: Locale = raw;
  setRequestLocale(locale);

  const allHotels = await listPublishedHotelsForIndex();
  const hotels = allHotels.filter((h) => detectBrand(h.nameFr)?.slug === brand.slug);
  // Empty state: render `noindex` (set in `generateMetadata`) instead of
  // `notFound()`. Keeps the URL discoverable for the menu while the
  // catalogue grows, and avoids soft-404 pollution in Search Console.
  const isEmpty = hotels.length === 0;

  // Explicit lookup — see `generateMetadata` for the production-build
  // rationale.
  const t = locale === 'fr' ? T.fr : T.en;
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // AEO + FAQ context — count by city (sorted desc) and Palace count.
  // Stable order is critical: the same brand page hit twice must
  // produce the same answer string for LLM caching and snapshot tests.
  const cityCounts = new Map<string, number>();
  let palaceCount = 0;
  for (const h of hotels) {
    cityCounts.set(h.city, (cityCounts.get(h.city) ?? 0) + 1);
    if (h.isPalace) palaceCount += 1;
  }
  const sortedCities = Array.from(cityCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city);
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const scope = computeBrandScope(hotels, locale);
  const scopeFrLabel =
    scope.kind === 'france-only'
      ? 'en France'
      : scope.kind === 'single-non-france'
        ? `au ${scope.countryLabel}`
        : `dans ${scope.countryCount} pays`;
  const scopeEnLabel =
    scope.kind === 'france-only'
      ? 'in France'
      : scope.kind === 'single-non-france'
        ? `in ${scope.countryLabel}`
        : `across ${scope.countryCount} countries`;
  const aeoQuestion = pickByLocale(
    locale,
    `Combien d'hôtels ${brand.label} sont disponibles ${scopeFrLabel} via MyConciergeHotel ?`,
    `How many ${brand.label} hotels are available ${scopeEnLabel} via MyConciergeHotel?`,
  );
  const aeoAnswer = isEmpty
    ? ''
    : brandAeoAnswer({
        brandLabel: brand.label,
        brandSlug: brand.slug,
        count: hotels.length,
        cities: sortedCities,
        palaceCount,
        locale,
        freshnessDate,
        scope,
      });
  const faqItems = isEmpty
    ? []
    : brandFaqItems({
        brandLabel: brand.label,
        count: hotels.length,
        cities: sortedCities,
        locale,
        scope,
      });

  // ── BreadcrumbList JSON-LD ───────────────────────────────────────────
  const breadcrumbJsonLd = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      { name: t.breadcrumbHome, url: `${origin}${getPathname({ locale, href: '/' })}` },
      { name: t.breadcrumbHotels, url: `${origin}${getPathname({ locale, href: '/hotels' })}` },
      {
        name: brand.label,
        url: `${origin}${getPathname({
          locale,
          href: { pathname: '/marque/[brandSlug]', params: { brandSlug: brand.slug } },
        })}`,
      },
    ]),
  );

  // ── ItemList JSON-LD (the brand's catalog) ───────────────────────────
  // Skip the ItemList when empty: a zero-item Schema.ItemList dilutes
  // the structured-data signal and can trigger Rich Results warnings.
  const itemListJsonLd = isEmpty
    ? null
    : JsonLd.withSchemaOrgContext(
        JsonLd.itemListJsonLd({
          name: `${brand.label} ${t.suffix(scope)}`,
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
      {itemListJsonLd !== null ? <JsonLdScript data={itemListJsonLd} nonce={nonce} /> : null}

      {/* Breadcrumb visible — additional internal-link signal */}
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
            {brand.label}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">
          {brand.label} {t.suffix(scope)}
        </h1>
        <p className="text-muted mt-3 text-sm md:text-base">
          {isEmpty
            ? pickByLocale(
                locale,
                `Aucune adresse ${brand.label} encore publiée dans notre catalogue. Le catalogue s'enrichit régulièrement — explorez nos autres marques ou nos sélections éditoriales en attendant.`,
                `No ${brand.label} address published yet in our catalog. The catalog is growing — browse our other brands or editorial selections in the meantime.`,
              )
            : t.subtitle(brand.label, hotels.length, scope)}
        </p>
      </header>

      {!isEmpty ? (
        <HubAeoSection
          question={aeoQuestion}
          answer={aeoAnswer}
          headingId="brand-aeo-title"
          emitJsonLd={false}
        />
      ) : null}

      {isEmpty ? (
        <section
          aria-labelledby="empty-state-title"
          className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
        >
          <h2 id="empty-state-title" className="text-fg font-serif text-xl">
            {pickByLocale(locale, 'Sélection en préparation', 'Selection in progress')}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {pickByLocale(
              locale,
              `Notre conciergerie sélectionne actuellement les adresses ${brand.label}. En attendant la publication, consultez notre index des groupes hôteliers ou notre catalogue complet.`,
              `Our concierge desk is selecting ${brand.label} addresses. While we publish them, browse our hotel-group index or our full catalog.`,
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/marques"
              className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Toutes les marques', 'All brands')} →
            </Link>
            <Link
              href="/hotels"
              className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Tous les hôtels', 'All hotels')} →
            </Link>
          </div>
        </section>
      ) : (
        <>
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
          {faqItems.length > 0 ? <HubFaqSection heading={t.faqTitle} items={faqItems} /> : null}
        </>
      )}
    </main>
  );
}
