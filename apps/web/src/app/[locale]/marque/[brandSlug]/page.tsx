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
import {
  brandScopeCitiesLabel,
  brandScopeSuffix,
  computeBrandScope,
  type BrandScope,
} from '@/lib/brand-scope';
import { env } from '@/lib/env';
import {
  listPublishedHotelsByAffiliation,
  listPublishedHotelsForIndex,
} from '@/server/hotels/get-hotel-by-slug';
import { detectBrand, KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';

export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

const T = {
  fr: {
    eyebrow: 'Groupe hôtelier',
    subtitle: (brand: string, n: number, suffix: string) =>
      `Les ${n} adresses ${brand} ${suffix} de notre catalogue éditorial — sélection IATA MyConciergeHotel.`,
    palace: 'Palace',
    stars: '★',
    seeFiche: 'Voir la fiche',
    breadcrumbHome: 'Accueil',
    breadcrumbHotels: 'Hôtels',
    metaTitle: (brand: string, suffix: string) =>
      `${brand} ${suffix} — Hôtels & Palaces | MyConciergeHotel`,
    metaDesc: (brand: string, n: number, suffix: string) =>
      `Découvrez les ${n} adresses ${brand} ${suffix} de notre sélection éditoriale : Palaces, hôtels 5 étoiles. Réservation IATA, tarifs nets GDS.`,
    faqTitle: 'Questions sur la marque',
  },
  en: {
    eyebrow: 'Hotel group',
    subtitle: (brand: string, n: number, suffix: string) =>
      `The ${n} ${brand} addresses ${suffix} from our editorial catalog — MyConciergeHotel IATA selection.`,
    palace: 'Palace',
    stars: '★',
    seeFiche: 'View the page',
    breadcrumbHome: 'Home',
    breadcrumbHotels: 'Hotels',
    metaTitle: (brand: string, suffix: string) =>
      `${brand} ${suffix} — Hotels & Palaces | MyConciergeHotel`,
    metaDesc: (brand: string, n: number, suffix: string) =>
      `Discover the ${n} ${brand} addresses ${suffix} from our editorial selection: Palaces, 5-star hotels. IATA booking, GDS net rates.`,
    faqTitle: 'Questions about the brand',
  },
} as const;

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
  // ── International collections (ADR-0021 — added 2026-05-28) ────────────
  aman: {
    positioningFr:
      "collection fondée en 1988 par Adrian Zecha à Phuket — désormais 35+ resorts d'auteur de Tokyo à Venise, du Bhoutan aux Caraïbes, signature minimaliste asiatique et zéro logo extérieur",
    positioningEn:
      'collection founded in 1988 by Adrian Zecha in Phuket — now 35+ author resorts from Tokyo to Venice, Bhutan to the Caribbean, with a minimalist Asian signature and zero outdoor branding',
  },
  belmond: {
    positioningFr:
      'groupe LVMH (depuis 2018) — palaces, trains de légende (Venice Simplon-Orient-Express, Royal Scotsman, Belmond Andean Explorer) et péniches privées en Italie, France, Pérou, Afrique du Sud, Botswana',
    positioningEn:
      'LVMH group (since 2018) — palaces, legendary trains (Venice Simplon-Orient-Express, Royal Scotsman, Belmond Andean Explorer) and private barges across Italy, France, Peru, South Africa, Botswana',
  },
  'six-senses': {
    positioningFr:
      'collection wellness & nature fondée en 1995 (groupe IHG depuis 2019) — 25+ resorts engagés sustainability à Bali, Maldives, Suisse (Crans-Montana), Portugal (Douro Valley), Bhoutan',
    positioningEn:
      'wellness & nature collection founded in 1995 (IHG group since 2019) — 25+ sustainability-focused resorts in Bali, the Maldives, Switzerland (Crans-Montana), Portugal (Douro Valley), Bhutan',
  },
  bulgari: {
    positioningFr:
      'collection hôtelière du joaillier romain Bulgari (LVMH, opérée par Marriott) — Milan, Londres, Tokyo, Dubaï, Bali, Pékin, Shanghai, Moscou, Rome (depuis 2023) et bientôt Maldives',
    positioningEn:
      'hotel collection of Roman jeweller Bulgari (LVMH, operated by Marriott) — Milan, London, Tokyo, Dubai, Bali, Beijing, Shanghai, Moscow, Rome (since 2023), and soon the Maldives',
  },
  'auberge-resorts': {
    positioningFr:
      'collection américaine fondée en 1981 dans la Napa Valley (Auberge du Soleil) — 25+ adresses signature aux États-Unis (Calistoga, Aspen, Telluride), au Mexique (Esperanza, Etéreo), en Caraïbes (The Dunlin) et au Costa Rica (Hacienda AltaGracia)',
    positioningEn:
      'American collection founded in 1981 in Napa Valley (Auberge du Soleil) — 25+ signature addresses across the US (Calistoga, Aspen, Telluride), Mexico (Esperanza, Etéreo), the Caribbean (The Dunlin) and Costa Rica (Hacienda AltaGracia)',
  },
  // ── French + Asian author collections ──────────────────────────────────
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
  readonly scope: BrandScope;
  readonly locale: Locale;
  readonly freshnessDate: string;
  readonly suffix: string;
}): string {
  const { scope } = args;
  const desc = BRAND_DESCRIPTORS[args.brandSlug];
  const positioning =
    desc !== undefined ? pickByLocale(args.locale, desc.positioningFr, desc.positioningEn) : '';
  const citiesLabel = brandScopeCitiesLabel(scope, 4);
  // Atout France's Palace label is FR-only by design (it's a French
  // ministerial distinction), so the "X Palaces" clause only fires
  // when the scope actually includes France hotels.
  const includesFrance =
    scope.kind === 'france-only' ||
    (scope.kind === 'multi-country' && scope.countryCodes.includes('FR'));
  const palaceClause =
    scope.palaceCount > 0 && includesFrance
      ? pickByLocale(
          args.locale,
          `dont ${scope.palaceCount} Palace${scope.palaceCount > 1 ? 's' : ''} distingué${scope.palaceCount > 1 ? 's' : ''} par Atout France`,
          `including ${scope.palaceCount} Palace${scope.palaceCount > 1 ? 's' : ''} certified by Atout France`,
        )
      : pickByLocale(args.locale, 'hôtels 5 étoiles', '5-star hotels');
  const intro = pickByLocale(
    args.locale,
    `MyConciergeHotel référence ${scope.count} adresse${scope.count > 1 ? 's' : ''} ${args.brandLabel} ${args.suffix} au ${args.freshnessDate}`,
    `MyConciergeHotel lists ${scope.count} ${args.brandLabel} address${scope.count > 1 ? 'es' : ''} ${args.suffix} as of ${args.freshnessDate}`,
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
  readonly scope: BrandScope;
  readonly locale: Locale;
  readonly suffix: string;
}): readonly { readonly question: string; readonly answer: string }[] {
  const { scope } = args;
  const citiesLabel = brandScopeCitiesLabel(scope, 4);
  const includesFrance =
    scope.kind === 'france-only' ||
    (scope.kind === 'multi-country' && scope.countryCodes.includes('FR'));
  if (args.locale === 'fr') {
    const palaceFaqFr = includesFrance
      ? {
          question: `Quelle est la différence entre ${args.brandLabel} et un Palace indépendant ?`,
          answer: `${args.brandLabel} est une collection ou un groupe — chaque adresse partage des standards de service (formation des équipes, programme de fidélité, signature culinaire). Un Palace indépendant comme Le Negresco ou L'Hôtel suit ses propres codes, sans appartenance de groupe. Les deux sont éligibles au statut Palace Atout France.`,
        }
      : {
          question: `Comment ${args.brandLabel} se positionne-t-il face à ses concurrents internationaux ?`,
          answer: `${args.brandLabel} appartient à la sphère des collections d'auteur — au même titre que Belmond, Aman, Six Senses ou Rosewood. Chaque maison du groupe partage des standards de service (formation, programme de fidélité, signature culinaire) tout en cultivant un sense of place propre à sa destination. Critères croisés Forbes Travel Guide, Michelin Keys, LHW.`,
        };
    return [
      {
        question: `Combien d'hôtels ${args.brandLabel} sont disponibles ${args.suffix} ?`,
        answer: `MyConciergeHotel sélectionne ${scope.count} adresse${scope.count > 1 ? 's' : ''} ${args.brandLabel} ${args.suffix}, ${scope.cities.length > 1 ? `réparties entre ${citiesLabel}` : `située à ${citiesLabel}`}. Chaque fiche détaille la classification (Palace, 5 étoiles, ranking Forbes / Michelin Keys), les services et les tarifs nets disponibles via notre licence IATA.`,
      },
      {
        question: `Comment réserver un hôtel ${args.brandLabel} via MyConciergeHotel ?`,
        answer: `Notre conciergerie IATA accède directement aux tarifs nets du GDS Amadeus, identiques à ceux du site officiel ${args.brandLabel} mais sans intermédiaire commissionné. Une demande de réservation déclenche un échange direct avec nos concierges hôteliers — disponibilités, surclassements, demandes spéciales.`,
      },
      palaceFaqFr,
      {
        question: `MyConciergeHotel propose-t-il les avantages fidélité ${args.brandLabel} ?`,
        answer: `Les programmes de fidélité ${args.brandLabel} (statut, points, surclassements) sont conservés lorsque le client communique son numéro de membre lors de la réservation. Notre rôle est de garantir le tarif officiel le plus avantageux et un service de conciergerie en amont du séjour — jamais de remplacer le programme de la marque.`,
      },
    ];
  }
  const palaceFaqEn = includesFrance
    ? {
        question: `What is the difference between ${args.brandLabel} and an independent Palace?`,
        answer: `${args.brandLabel} is a collection or group — every address shares service standards (team training, loyalty program, culinary signature). An independent Palace like Le Negresco or L'Hôtel follows its own codes, with no group affiliation. Both can hold the Atout France Palace distinction.`,
      }
    : {
        question: `How does ${args.brandLabel} compare to its international peers?`,
        answer: `${args.brandLabel} sits among the author-collection world — alongside Belmond, Aman, Six Senses or Rosewood. Each house in the group shares service standards (training, loyalty program, culinary signature) while cultivating its destination's sense of place. Cross-checked against Forbes Travel Guide, Michelin Keys and LHW.`,
      };
  return [
    {
      question: `How many ${args.brandLabel} hotels are available ${args.suffix}?`,
      answer: `MyConciergeHotel curates ${scope.count} ${args.brandLabel} address${scope.count > 1 ? 'es' : ''} ${args.suffix}, ${scope.cities.length > 1 ? `spread across ${citiesLabel}` : `located in ${citiesLabel}`}. Each page details the classification (Palace, 5-star, Forbes / Michelin Keys ranking), services, and net rates available through our IATA licence.`,
    },
    {
      question: `How do I book a ${args.brandLabel} hotel via MyConciergeHotel?`,
      answer: `Our IATA concierge desk accesses Amadeus GDS net rates — identical to the official ${args.brandLabel} site but without commission intermediaries. A booking request triggers direct contact with our hotel concierges for availability, upgrades, and special requests.`,
    },
    palaceFaqEn,
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

  // Two-source resolution (2026-05-29):
  //  - DB-filtered affiliations (`@>` JSONB index) catches every row that
  //    carries a verified `affiliations[].kind = 'brand'` matching this
  //    facet — including P2 scaffolds that live past the PostgREST cap
  //    of `listPublishedHotelsForIndex`. This is the canonical signal.
  //  - The legacy `detectBrand` regex catches rows that haven't been
  //    annotated yet (only seven historical FR brands still rely on it).
  // The two sets are unioned by slug, deduped by `slugFr` so a hotel
  // detected by both paths counts once.
  const [affiliated, paged] = await Promise.all([
    listPublishedHotelsByAffiliation({ facetSlug: brand.slug, kind: 'brand' }),
    listPublishedHotelsForIndex(2500),
  ]);
  const namesMatched = paged.filter((h) => detectBrand(h.nameFr)?.slug === brand.slug);
  const dedup = new Map<string, (typeof affiliated)[number]>();
  for (const h of affiliated) dedup.set(h.slugFr, h);
  for (const h of namesMatched) if (!dedup.has(h.slugFr)) dedup.set(h.slugFr, h);
  const brandHotels = Array.from(dedup.values());
  const count = brandHotels.length;
  // ADR-0021 Vague 2 — derive the editorial scope from the actual
  // country distribution so the H1 / meta / AEO / FAQ never claim
  // "in France" for a brand whose published catalogue lives in Asia,
  // the Caribbean or the Maldives.
  const scope = computeBrandScope(brandHotels);
  // ⚠ The local variable is named `activeLocale` (not `locale`) to defeat
  // a Turbopack production-build minifier bug. When a local `locale`
  // variable coexists with the destructuring pattern `{ locale: raw }`
  // above, Turbopack fails to rewrite object-shorthand uses of `locale`
  // in the bundled output, leading to `ReferenceError: locale is not
  // defined` at request time. Verified by reading the minified chunk in
  // `.next/server/chunks/ssr/...marque...page_tsx_*.js`. Renaming the
  // local breaks the name collision and the shorthand expansion works.
  const activeLocale: Locale = raw;
  const t = T[activeLocale];
  // Empty-state → fall back to the brand label without a country
  // suffix so the metadata still renders. The default export already
  // handles the noindex empty state separately.
  const suffix = scope !== null ? brandScopeSuffix(scope, activeLocale) : '';
  const buildCanonicalPath = (l: Locale): string =>
    getPathname({
      locale: l,
      href: { pathname: '/marque/[brandSlug]', params: { brandSlug: brand.slug } },
    });

  return {
    title: t.metaTitle(brand.label, suffix),
    description: t.metaDesc(brand.label, count, suffix),
    alternates: {
      canonical: buildCanonicalPath(activeLocale),
      languages: buildHreflangAlternates(buildCanonicalPath),
    },
    openGraph: {
      title: t.metaTitle(brand.label, suffix),
      description: t.metaDesc(brand.label, count, suffix),
      type: 'website',
      locale: ogLocale(activeLocale),
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

  // ⚠ Renamed from `locale` to `activeLocale` to defeat a Turbopack
  // production-build minifier bug: when a local `locale` variable
  // coexists with the destructuring pattern `{ locale: raw }` above,
  // Turbopack fails to rewrite object-shorthand uses of `locale` in
  // inlined helper calls (`brandAeoAnswer({ ..., locale, freshness... })`).
  // The minified chunk emits the shorthand `locale` literally even
  // though the binding has been renamed, producing `ReferenceError:
  // locale is not defined` at request time. Verified by reading
  // `.next/server/chunks/ssr/...marque...page_tsx_*.js`. Renaming
  // breaks the collision and the shorthand expansion works.
  const activeLocale: Locale = raw;
  setRequestLocale(activeLocale);

  // Same two-source resolution as `generateMetadata` — see comments
  // there for the rationale. The two queries run in parallel.
  const [affiliated, paged] = await Promise.all([
    listPublishedHotelsByAffiliation({ facetSlug: brand.slug, kind: 'brand' }),
    listPublishedHotelsForIndex(2500),
  ]);
  const namesMatched = paged.filter((h) => detectBrand(h.nameFr)?.slug === brand.slug);
  const dedup = new Map<string, (typeof affiliated)[number]>();
  for (const h of affiliated) dedup.set(h.slugFr, h);
  for (const h of namesMatched) if (!dedup.has(h.slugFr)) dedup.set(h.slugFr, h);
  const hotels = Array.from(dedup.values());
  // Empty state: render `noindex` (set in `generateMetadata`) instead of
  // `notFound()`. Keeps the URL discoverable for the menu while the
  // catalogue grows, and avoids soft-404 pollution in Search Console.
  const isEmpty = hotels.length === 0;

  const t = T[activeLocale];
  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  // ADR-0021 Vague 2 — derive scope (france-only / single-non-france /
  // multi-country) from the brand's published rows. Drives the H1
  // suffix, AEO copy, FAQ copy and `ItemList.name`. Empty state keeps
  // an empty suffix so the page still renders (handled below).
  const scope = computeBrandScope(hotels);
  const suffix = scope !== null ? brandScopeSuffix(scope, activeLocale) : '';
  const freshnessDate = new Intl.DateTimeFormat(intlLocaleTag(activeLocale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const aeoQuestion = pickByLocale(
    activeLocale,
    `Combien d'hôtels ${brand.label} sont disponibles ${suffix} via MyConciergeHotel ?`,
    `How many ${brand.label} hotels are available ${suffix} via MyConciergeHotel?`,
  );
  const aeoAnswer =
    scope !== null
      ? brandAeoAnswer({
          brandLabel: brand.label,
          brandSlug: brand.slug,
          scope,
          locale: activeLocale,
          freshnessDate,
          suffix,
        })
      : '';
  const faqItems =
    scope !== null
      ? brandFaqItems({
          brandLabel: brand.label,
          scope,
          locale: activeLocale,
          suffix,
        })
      : [];

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
        name: brand.label,
        url: `${origin}${getPathname({
          locale: activeLocale,
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
          name: `${brand.label} ${suffix}`,
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
          {brand.label}
          {suffix.length > 0 ? ` ${suffix}` : ''}
        </h1>
        <p className="text-muted mt-3 text-sm md:text-base">
          {isEmpty
            ? pickByLocale(
                activeLocale,
                `Aucune adresse ${brand.label} encore publiée dans notre catalogue. Le catalogue s'enrichit régulièrement — explorez nos autres marques ou nos sélections éditoriales en attendant.`,
                `No ${brand.label} address published yet in our catalog. The catalog is growing — browse our other brands or editorial selections in the meantime.`,
              )
            : t.subtitle(brand.label, hotels.length, suffix)}
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
            {pickByLocale(activeLocale, 'Sélection en préparation', 'Selection in progress')}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {pickByLocale(
              activeLocale,
              `Notre conciergerie sélectionne actuellement les adresses ${brand.label}. En attendant la publication, consultez notre index des groupes hôteliers ou notre catalogue complet.`,
              `Our concierge desk is selecting ${brand.label} addresses. While we publish them, browse our hotel-group index or our full catalog.`,
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/marques"
              className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(activeLocale, 'Toutes les marques', 'All brands')} →
            </Link>
            <Link
              href="/hotels"
              className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(activeLocale, 'Tous les hôtels', 'All hotels')} →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((h) => {
              // Slug/name selection stays locale-aware (data layer) — see ADR-0012.
              // V2 locales fall back to FR until migration 0034.
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
          {faqItems.length > 0 ? <HubFaqSection heading={t.faqTitle} items={faqItems} /> : null}
        </>
      )}
    </main>
  );
}
