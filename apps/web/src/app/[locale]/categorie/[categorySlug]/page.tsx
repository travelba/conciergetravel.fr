import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

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
import {
  EDITORIAL_CATEGORIES,
  filterCategory,
  findCategory,
} from '@/server/hotels/editorial-categories';
import { listPublishedHotelsForIndex } from '@/server/hotels/get-hotel-by-slug';

export const dynamic = 'force-dynamic';

/**
 * Empty-state predicate — when the category exists but no published
 * hotel currently matches (catalogue not yet seeded, or all hotels for
 * the predicate are unpublished). We render the page with `noindex`
 * instead of `notFound()` to avoid soft-404s (skill `seo-technical`
 * §Indexability — "the page renders so deep links resolve, but Google
 * does not index thin pages and the site's overall quality signal is
 * preserved").
 */
async function categoryHasNoHotels(category: ReturnType<typeof findCategory>): Promise<boolean> {
  if (category === null) return true;
  const allHotels = await listPublishedHotelsForIndex();
  return filterCategory(allHotels, category).length === 0;
}

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
    faqTitle: 'Questions sur cette sélection',
  },
  en: {
    eyebrow: 'Editorial selection',
    palace: 'Palace',
    stars: '★',
    seeFiche: 'View the page',
    breadcrumbHome: 'Home',
    breadcrumbHotels: 'Hotels',
    faqTitle: 'Questions about this selection',
  },
} as const;

/**
 * Per-category AEO + FAQ payload. Slug-keyed so the page render can
 * pick the matching descriptor in O(1). Keys must match
 * `EDITORIAL_CATEGORIES[].slug` exactly — any missing key falls back
 * to a generic answer derived from the H1 + count.
 *
 * Concierge voice (rules/editorial-voice.mdc) — short, expert,
 * sentence ≤ 25 words.
 */
const CATEGORY_AEO: Readonly<
  Record<
    string,
    {
      readonly aeoFr: string;
      readonly aeoEn: string;
      readonly faqFr: readonly { readonly q: string; readonly a: string }[];
      readonly faqEn: readonly { readonly q: string; readonly a: string }[];
    }
  >
> = {
  'palaces-paris': {
    aeoFr:
      'Paris compte douze Palaces distingués par Atout France — Bristol, Crillon, George V, Meurice, Plaza Athénée, Ritz, Royal Monceau, Shangri-La, Peninsula, Park Hyatt, Mandarin Oriental, Lutetia. MyConciergeHotel les référence tous au tarif net Amadeus, sans intermédiaire commissionné.',
    aeoEn:
      'Paris counts twelve Palaces certified by Atout France — Bristol, Crillon, George V, Meurice, Plaza Athénée, Ritz, Royal Monceau, Shangri-La, Peninsula, Park Hyatt, Mandarin Oriental, Lutetia. MyConciergeHotel lists them all at Amadeus net rates, with no commission intermediary.',
    faqFr: [
      {
        q: 'Quelle est la différence entre un Palace et un hôtel 5 étoiles à Paris ?',
        a: "Le statut Palace est une distinction Atout France attribuée à un nombre limité d'hôtels 5 étoiles répondant à des critères architecturaux, historiques et de service exceptionnels. Paris compte douze Palaces sur des dizaines de 5 étoiles. La distinction est révisée tous les cinq ans.",
      },
      {
        q: 'Quel quartier choisir pour un séjour Palace à Paris ?',
        a: "Le Triangle d'or (8e arrondissement) concentre Bristol, George V, Plaza Athénée. Place Vendôme et Tuileries (1er) accueillent Ritz, Meurice, Park Hyatt. Saint-Germain (6e) abrite Lutetia. Les Champs-Élysées proches : Royal Monceau, Peninsula. Chaque quartier offre une ambiance distincte — notre conciergerie vous oriente selon vos priorités.",
      },
      {
        q: 'Les Palaces parisiens proposent-ils des chambres communicantes pour les familles ?',
        a: "La plupart des Palaces parisiens disposent de configurations familiales — suites parentales avec chambre d'enfants attenante, ou chambres communicantes. La conciergerie sécurise le bon couplage à la réservation. Plaza Athénée, Bristol et Crillon disposent de programmes enfants dédiés (Kids Club, menus, activités).",
      },
      {
        q: "Quels Palaces parisiens disposent d'une étoile Michelin ?",
        a: "Le Bristol (Epicure, ***), Plaza Athénée (Alain Ducasse, ***), George V (Le Cinq, ***), Meurice (Alain Ducasse au Meurice, **), Crillon (L'Écrin, *), Ritz (L'Espadon, *), Mandarin Oriental (Sur Mesure par Thierry Marx, **) cumulent étoiles et tables prestigieuses. Notre conciergerie réserve les tables.",
      },
    ],
    faqEn: [
      {
        q: "What's the difference between a Palace and a 5-star hotel in Paris?",
        a: 'The Palace status is an Atout France distinction granted to a limited number of 5-star hotels meeting exceptional architectural, historical and service criteria. Paris counts twelve Palaces against dozens of 5-stars. The distinction is reviewed every five years.',
      },
      {
        q: 'Which Paris district to choose for a Palace stay?',
        a: 'The Golden Triangle (8th arrondissement) concentrates Bristol, George V, Plaza Athénée. Place Vendôme and Tuileries (1st) host Ritz, Meurice, Park Hyatt. Saint-Germain (6th) houses Lutetia. Near the Champs-Élysées: Royal Monceau, Peninsula. Each district offers a distinct atmosphere — our concierge guides you by priority.',
      },
      {
        q: 'Do Paris Palaces offer connecting rooms for families?',
        a: "Most Paris Palaces offer family configurations — parent suites with adjoining children's rooms, or connecting rooms. The concierge desk secures the right pairing at booking. Plaza Athénée, Bristol and Crillon run dedicated children's programs (Kids Club, menus, activities).",
      },
      {
        q: 'Which Paris Palaces hold Michelin stars?',
        a: "Le Bristol (Epicure, ***), Plaza Athénée (Alain Ducasse, ***), George V (Le Cinq, ***), Meurice (Alain Ducasse au Meurice, **), Crillon (L'Écrin, *), Ritz (L'Espadon, *), Mandarin Oriental (Sur Mesure by Thierry Marx, **) accumulate stars and prestigious tables. Our concierge books the tables.",
      },
    ],
  },
  'palaces-montagne': {
    aeoFr:
      "La France compte huit Palaces de montagne distingués par Atout France, concentrés à Courchevel (K2 Palace, K2 Altitude, L'Apogée, Cheval Blanc Courchevel, Les Airelles), Megève (Four Seasons Megève, Les Fermes de Marie) et Val d'Isère. Ouverture saisonnière hiver et été, signature gastronomique exigeante.",
    aeoEn:
      "France counts eight mountain Palaces certified by Atout France, concentrated in Courchevel (K2 Palace, K2 Altitude, L'Apogée, Cheval Blanc Courchevel, Les Airelles), Megève (Four Seasons Megève, Les Fermes de Marie) and Val d'Isère. Seasonal opening winter and summer, demanding gastronomic signature.",
    faqFr: [
      {
        q: 'Quelle est la saison hivernale dans les Palaces de montagne ?',
        a: "La saison hivernale court de mi-décembre à mi-avril selon l'enneigement. Les Palaces de Courchevel et Val d'Isère ouvrent généralement le 15 décembre, ferment fin mars ou mi-avril. Megève bénéficie d'une saison plus longue grâce à son altitude moyenne et son ouverture estivale (juillet-août).",
      },
      {
        q: "Les Palaces de montagne disposent-ils d'un accès ski direct ?",
        a: "La majorité des Palaces de Courchevel 1850 (K2, Cheval Blanc, Les Airelles, L'Apogée) offrent un accès ski-in/ski-out direct depuis les pistes. À Megève, l'accès se fait via voiturier ou navette privée. La conciergerie organise location de matériel, moniteurs ESF privés et réservations Saulire / Bellecôte.",
      },
      {
        q: 'Quels services hors-ski proposent les Palaces de montagne ?',
        a: "Spa intégral (Sisley, Guerlain, Caudalie selon les adresses), piscines intérieures chauffées, salles de cinéma privées, bowling (K2 Palace), discothèques, restaurants étoilés. Programmes après-ski : raquettes, motoneige, héliski, observatoire des étoiles. Garde d'enfants 24/7 et clubs enfants Mini-VIP toute la saison.",
      },
      {
        q: 'Les Palaces de montagne sont-ils ouverts en été ?',
        a: "Megève reste ouverte toute l'année. Courchevel et Val d'Isère ferment généralement de mi-avril à mi-juin et de mi-septembre à mi-décembre. Quelques adresses (Four Seasons Megève, Les Fermes de Marie) proposent une saison estivale en juillet-août, axée randonnée, golf et bien-être.",
      },
    ],
    faqEn: [
      {
        q: 'What is the winter season at mountain Palaces?',
        a: "Winter season runs mid-December to mid-April depending on snow. Courchevel and Val d'Isère Palaces typically open December 15 and close late March or mid-April. Megève has a longer season thanks to its medium altitude and summer opening (July-August).",
      },
      {
        q: 'Do mountain Palaces offer direct ski access?',
        a: "Most Courchevel 1850 Palaces (K2, Cheval Blanc, Les Airelles, L'Apogée) offer direct ski-in/ski-out access from the slopes. In Megève, access is via valet or private shuttle. The concierge desk arranges equipment rental, private ESF instructors and Saulire / Bellecôte reservations.",
      },
      {
        q: 'What non-ski services do mountain Palaces offer?',
        a: 'Full spa (Sisley, Guerlain, Caudalie depending on the address), heated indoor pools, private cinemas, bowling (K2 Palace), nightclubs, Michelin-starred restaurants. Après-ski programs: snowshoeing, snowmobile, heliskiing, stargazing. 24/7 childcare and Mini-VIP kids clubs throughout the season.',
      },
      {
        q: 'Are mountain Palaces open in summer?',
        a: "Megève stays open year-round. Courchevel and Val d'Isère typically close from mid-April to mid-June and from mid-September to mid-December. A few addresses (Four Seasons Megève, Les Fermes de Marie) run a summer season in July-August, focused on hiking, golf and wellness.",
      },
    ],
  },
  'palaces-bord-de-mer': {
    aeoFr:
      "Les Palaces du bord de mer français rassemblent Cap-Eden-Roc (Antibes), Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez, Byblos, Le Martinez (Cannes), Le Royal Évian, Hôtel Barrière Le Normandy (Deauville). Saison Côte d'Azur de mai à octobre, Atlantique de juin à septembre.",
    aeoEn:
      "French seaside Palaces include Cap-Eden-Roc (Antibes), Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez, Byblos, Le Martinez (Cannes), Le Royal Évian, Hôtel Barrière Le Normandy (Deauville). Côte d'Azur season May to October, Atlantic June to September.",
    faqFr: [
      {
        q: "Quelle est la saison touristique sur la Côte d'Azur ?",
        a: "La haute saison court de mai à fin septembre, pic en juillet-août. Mai-juin et septembre offrent les meilleurs compromis météo/affluence. Les Palaces du Cap-Ferrat et Cap d'Antibes ferment généralement de novembre à mars. Cannes et Monaco restent partiellement ouverts toute l'année grâce au tourisme d'affaires.",
      },
      {
        q: 'Les Palaces du bord de mer disposent-ils de plages privées ?',
        a: "Cap-Eden-Roc, Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez et Le Royal Évian disposent d'un accès direct mer ou d'une plage privée aménagée (matelas, parasols, restaurant de plage, sports nautiques). Le Martinez à Cannes propose une plage privée séparée du palace par la Croisette.",
      },
      {
        q: "Peut-on amarrer un yacht devant les Palaces de la Côte d'Azur ?",
        a: "Cap-Eden-Roc dispose d'un ponton privé pour yacht-tender. Cannes (Vieux-Port) et Saint-Tropez (Port) accueillent les yachts via Monaco Yachting ou les capitaineries locales. La conciergerie organise l'amarrage, les transferts et les agents yachting (Northrop & Johnson, IYC) selon la longueur du bateau.",
      },
      {
        q: 'Quels Palaces côtiers acceptent les animaux ?',
        a: 'Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez, Byblos et Le Royal Évian acceptent les chiens de petite taille, sur demande et avec supplément. Les conditions varient — taille max, accès piscine, restaurants. À préciser à la réservation auprès de notre conciergerie pour confirmation écrite avant le séjour.',
      },
    ],
    faqEn: [
      {
        q: 'What is the tourist season on the French Riviera?',
        a: "High season runs May to late September, peaking July-August. May-June and September offer the best weather/crowd balance. Cap-Ferrat and Cap d'Antibes Palaces typically close November to March. Cannes and Monaco remain partially open year-round thanks to business tourism.",
      },
      {
        q: 'Do seaside Palaces have private beaches?',
        a: 'Cap-Eden-Roc, Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez and Le Royal Évian offer direct sea access or a private beach (sunbeds, parasols, beach restaurant, water sports). Le Martinez in Cannes runs a private beach across La Croisette from the Palace.',
      },
      {
        q: 'Can I moor a yacht at Riviera Palaces?',
        a: 'Cap-Eden-Roc has a private yacht-tender dock. Cannes (Vieux-Port) and Saint-Tropez (Port) host yachts via Monaco Yachting or local harbourmasters. The concierge handles mooring, transfers and yachting agents (Northrop & Johnson, IYC) based on boat length.',
      },
      {
        q: 'Which seaside Palaces accept pets?',
        a: 'Hôtel du Cap-Ferrat, Cheval Blanc St-Tropez, Byblos and Le Royal Évian accept small dogs, on request with a supplement. Conditions vary — max size, pool access, restaurants. To be specified at booking with our concierge for written confirmation before the stay.',
      },
    ],
  },
  'palaces-vignobles': {
    aeoFr:
      'Les Palaces des vignobles français se concentrent à Bordeaux (Les Sources de Caudalie à Martillac, Château Cordeillan-Bages à Pauillac), Beaune-Bourgogne (Hostellerie Le Cèdre, Hôtel Le Cep), et Champagne (Royal Champagne à Champillon, Hôtel les Crayères à Reims). Œnotourisme intégré, tables étoilées, parcours dégustation.',
    aeoEn:
      'French vineyard Palaces are concentrated in Bordeaux (Les Sources de Caudalie at Martillac, Château Cordeillan-Bages at Pauillac), Beaune-Burgundy (Hostellerie Le Cèdre, Hôtel Le Cep), and Champagne (Royal Champagne at Champillon, Hôtel les Crayères in Reims). Integrated wine tourism, starred tables, tasting trails.',
    faqFr: [
      {
        q: 'Les hôtels viticoles organisent-ils des visites de domaines ?',
        a: "Oui, c'est leur signature. Les Sources de Caudalie organise des visites quotidiennes de Château Smith Haut Lafitte (propriétaire). Cordeillan-Bages est intégré au Château Lynch-Bages. Les Crayères pilote des dégustations Champagne (Krug, Roederer, Pol Roger). La conciergerie réserve les visites privées et l'accès aux propriétés rares.",
      },
      {
        q: 'Quelle est la meilleure période pour visiter un vignoble français ?',
        a: "Vendanges (septembre-octobre) : pic visuel mais propriétés moins disponibles. Mai-juin : floraison de la vigne, météo idéale. Avril-septembre : pleine saison touristique. Hiver : caves et tables étoilées toujours accessibles, parfait pour les œnologues purs. Les Palaces restent ouverts toute l'année à Bordeaux et Beaune.",
      },
      {
        q: "Les Palaces des vignobles disposent-ils d'un spa vinothérapie ?",
        a: "Les Sources de Caudalie est le pionnier de la vinothérapie (1999), avec spa Caudalie intégral. Royal Champagne et Hostellerie Le Cèdre proposent des soins inspirés du raisin. Les soins vinothérapie utilisent polyphénols et marc de raisin pour leurs propriétés antioxydantes. Réservation conseillée 48 h à l'avance.",
      },
      {
        q: 'Peut-on séjourner dans un château vinicole français ?',
        a: "Plusieurs Palaces viticoles sont logés dans d'authentiques châteaux : Château Cordeillan-Bages (Pauillac), Château Saint-Martin & Spa (Vence), Château de la Messardière (Saint-Tropez, Airelles). D'autres maisons-hôtes proposent des séjours dans les châteaux du Médoc, Saint-Émilion, Pomerol — formats plus intimes, accès direct à la propriété.",
      },
    ],
    faqEn: [
      {
        q: 'Do vineyard hotels organise estate tours?',
        a: "Yes, it's their signature. Les Sources de Caudalie runs daily tours of Château Smith Haut Lafitte (owner). Cordeillan-Bages is integrated with Château Lynch-Bages. Les Crayères orchestrates Champagne tastings (Krug, Roederer, Pol Roger). The concierge books private tours and access to rare properties.",
      },
      {
        q: 'What is the best time to visit a French vineyard?',
        a: 'Harvest (September-October): visual peak but properties less available. May-June: vine flowering, ideal weather. April-September: peak tourist season. Winter: cellars and starred tables still accessible, perfect for pure oenophiles. Palaces remain open year-round in Bordeaux and Beaune.',
      },
      {
        q: 'Do vineyard Palaces offer vinotherapy spas?',
        a: 'Les Sources de Caudalie pioneered vinotherapy (1999) with a full Caudalie spa. Royal Champagne and Hostellerie Le Cèdre offer grape-inspired treatments. Vinotherapy uses polyphenols and grape marc for antioxidant properties. Booking advised 48 hours ahead.',
      },
      {
        q: 'Can I stay in an authentic French wine château?',
        a: 'Several vineyard Palaces are housed in authentic châteaux: Château Cordeillan-Bages (Pauillac), Château Saint-Martin & Spa (Vence), Château de la Messardière (Saint-Tropez, Airelles). Other guesthouses offer stays in châteaux of Médoc, Saint-Émilion, Pomerol — more intimate formats, direct property access.',
      },
    ],
  },
  'palaces-france': {
    aeoFr:
      "Atout France distingue actuellement 31 Palaces sur l'ensemble du territoire français (révision quinquennale). MyConciergeHotel référence chacun avec sa fiche éditoriale dédiée, ses chambres, sa table étoilée, son spa, ses tarifs nets Amadeus. Sélection vérifiée, sans intermédiaire commissionné.",
    aeoEn:
      'Atout France currently distinguishes 31 Palaces across the French territory (five-year review). MyConciergeHotel lists each with its dedicated editorial page, rooms, starred table, spa and Amadeus net rates. Verified selection, no commission intermediary.',
    faqFr: [
      {
        q: 'Combien de Palaces existe-t-il en France ?',
        a: "Atout France distingue actuellement 31 Palaces. Le statut Palace est une distinction officielle attribuée depuis 2010 à un nombre limité d'hôtels 5 étoiles répondant à des critères architecturaux, historiques et de service exceptionnels. La liste est révisée tous les cinq ans (dernière révision 2024).",
      },
      {
        q: "Quels sont les critères pour qu'un hôtel devienne Palace ?",
        a: "Atout France évalue : qualité architecturale et historique, services 24/7, gastronomie étoilée ou de référence, spa de haut niveau, personnel polyglotte, équipements suite (Suite Présidentielle obligatoire), localisation prestigieuse. La distinction est révocable et révisée tous les cinq ans pour maintenir le niveau d'excellence.",
      },
      {
        q: 'Quelle est la différence entre Palace et 5 étoiles ?',
        a: "Le 5 étoiles est un classement officiel basé sur des critères mesurables (équipements, surfaces, services). Le Palace est une distinction supplémentaire attribuée à une sous-catégorie d'hôtels 5 étoiles répondant à des critères d'excellence absolue. Tous les Palaces sont 5 étoiles, mais peu de 5 étoiles deviennent Palace.",
      },
      {
        q: 'Les tarifs des Palaces français sont-ils plus avantageux via MyConciergeHotel ?',
        a: 'Notre licence IATA nous donne accès aux tarifs nets Amadeus GDS, identiques à ceux du site officiel de chaque Palace mais sans intermédiaire commissionné. Aucun supplément. Les avantages fidélité (LHW, Virtuoso, Amex Fine Hotels) sont conservés lorsque le client communique son numéro de membre.',
      },
    ],
    faqEn: [
      {
        q: 'How many Palaces exist in France?',
        a: 'Atout France currently distinguishes 31 Palaces. The Palace status is an official distinction granted since 2010 to a limited number of 5-star hotels meeting exceptional architectural, historical and service criteria. The list is reviewed every five years (last review 2024).',
      },
      {
        q: 'What are the criteria for a hotel to become a Palace?',
        a: 'Atout France evaluates: architectural and historical quality, 24/7 services, starred or reference gastronomy, high-end spa, multilingual staff, suite equipment (mandatory Presidential Suite), prestigious location. The distinction is revocable and reviewed every five years to maintain excellence.',
      },
      {
        q: "What's the difference between Palace and 5-star?",
        a: '5-star is an official classification based on measurable criteria (equipment, surfaces, services). Palace is an additional distinction granted to a sub-category of 5-star hotels meeting absolute excellence criteria. Every Palace is a 5-star, but few 5-stars become a Palace.',
      },
      {
        q: 'Are French Palace rates more advantageous via MyConciergeHotel?',
        a: "Our IATA licence gives us access to Amadeus GDS net rates, identical to each Palace's official site but without commission intermediary. No surcharge. Loyalty benefits (LHW, Virtuoso, Amex Fine Hotels) are preserved when the guest provides their membership number.",
      },
    ],
  },
};

/**
 * Worldwide companion target rendered as a "Voir aussi monde" inline
 * callout for the 5 Atout-France-bound Palace categories. Returns the
 * typed `<Link>` ready to render — encapsulates the per-slug pathname
 * shape (some are static, some are templated) so the JSX stays a
 * single conditional render. PR-D, ADR-0021 Vague 4.
 *
 * The Palace label itself is a French ministerial distinction
 * (legitimate context — CDC §2.1 + `editorial-voice`), but the
 * categorical promise of every Palace page ("luxe bord de mer /
 * vignobles / montagne / capitale") deserves a worldwide pendant so
 * the user never experiences the catalogue as France-only by accident.
 *
 * Targets are deliberately conservative — every entry resolves to a
 * route enforced by `nav-data.ts` and the `menu-no-404` E2E spec, so
 * the callout never 404s.
 */
function renderWorldwideCompanion(categorySlug: string, locale: Locale): ReactElement | null {
  const labelClass =
    'text-fg hover:bg-muted/10 inline-flex items-center gap-1 underline decoration-dotted underline-offset-2';
  switch (categorySlug) {
    case 'palaces-france':
      return (
        <Link href="/hotels" className={labelClass}>
          {pickByLocale(
            locale,
            'Tous nos hôtels d\u2019exception dans le monde',
            'All our extraordinary hotels worldwide',
          )}{' '}
          →
        </Link>
      );
    case 'palaces-paris':
      return (
        <Link href="/destination" className={labelClass}>
          {pickByLocale(
            locale,
            'Capitales du monde — New York, Tokyo, Dubaï, Marrakech\u2026',
            'World capitals — New York, Tokyo, Dubai, Marrakech\u2026',
          )}{' '}
          →
        </Link>
      );
    case 'palaces-bord-de-mer':
      return (
        <Link
          href={{ pathname: '/destination/[citySlug]', params: { citySlug: 'bali' } }}
          className={labelClass}
        >
          {pickByLocale(
            locale,
            'Resorts bord de mer à Bali, aux Maldives, à Mykonos\u2026',
            'Seaside resorts in Bali, the Maldives, Mykonos\u2026',
          )}{' '}
          →
        </Link>
      );
    case 'palaces-montagne':
      return (
        <Link
          href={{ pathname: '/guide/[citySlug]', params: { citySlug: 'suisse' } }}
          className={labelClass}
        >
          {pickByLocale(
            locale,
            'Resorts de montagne en Suisse, au Bhoutan, dans les Rocheuses\u2026',
            'Mountain resorts in Switzerland, Bhutan, the Rockies\u2026',
          )}{' '}
          →
        </Link>
      );
    case 'palaces-vignobles':
      return (
        <Link
          href={{ pathname: '/marque/[brandSlug]', params: { brandSlug: 'six-senses' } }}
          className={labelClass}
        >
          {pickByLocale(
            locale,
            'Hôtels viticoles dans le monde — Toscane, Douro, Napa Valley\u2026',
            'Vineyard hotels worldwide — Tuscany, Douro, Napa Valley\u2026',
          )}{' '}
          →
        </Link>
      );
    default:
      return null;
  }
}

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
  const isEmpty = await categoryHasNoHotels(cat);

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
    // Empty-state pages render an explanation + a CTA back to the parent
    // hub. They MUST stay out of the Google index until the catalogue is
    // seeded (skill `seo-technical` §Indexability — thin pages dilute the
    // domain's overall quality signal). `follow: true` keeps the
    // categorical links discoverable.
    ...(isEmpty ? { robots: { index: false, follow: true } } : {}),
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
  // Empty state: render `noindex` (set in `generateMetadata`) instead of
  // `notFound()`. The page advertises that no hotel matches yet and
  // links back to `/hotels` so the user / crawler keeps a useful path.
  // This avoids soft-404s while the catalogue is being seeded.
  const isEmpty = hotels.length === 0;

  const origin = siteOrigin();
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const categoryAeoDesc = CATEGORY_AEO[category.slug];
  const worldwideCompanion = renderWorldwideCompanion(category.slug, locale);
  void intlLocaleTag; // reserved for future freshness signal

  const h1 = pickByLocale(locale, category.h1Fr, category.h1En);
  const subtitle = isEmpty
    ? pickByLocale(
        locale,
        `Aucune adresse encore publiée dans cette catégorie. Explorez nos autres sélections en attendant.`,
        `No address published yet in this category. Browse our other selections in the meantime.`,
      )
    : pickByLocale(locale, category.subtitleFr(hotels.length), category.subtitleEn(hotels.length));

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

  // Skip the ItemList when empty: emitting `Schema.ItemList` with zero
  // items dilutes the structured-data signal and may trigger Google
  // Rich Results "empty list" warnings.
  const itemListJsonLd = isEmpty
    ? null
    : JsonLd.withSchemaOrgContext(
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
            {pickByLocale(locale, category.labelFr, category.labelEn)}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-3xl">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t.eyebrow}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl md:text-5xl">{h1}</h1>
        <p className="text-muted mt-3 text-sm md:text-base">{subtitle}</p>
      </header>

      {/* Worldwide companion callout — only the 5 Palace France categories
          surface this. Renders an inline "Voir aussi monde" link so the
          user never reads the page as France-bounded by accident
          (PR-D, ADR-0021 Vague 4). */}
      {!isEmpty && worldwideCompanion !== null ? (
        <aside
          aria-label={pickByLocale(locale, 'Équivalent worldwide', 'Worldwide companion')}
          className="border-border bg-muted/5 mb-10 rounded-lg border px-4 py-3 text-sm md:px-5 md:py-4"
        >
          <span className="text-muted mr-2">
            {pickByLocale(locale, 'Voir aussi dans le monde :', 'See also worldwide:')}
          </span>
          {worldwideCompanion}
        </aside>
      ) : null}

      {!isEmpty && categoryAeoDesc !== undefined ? (
        <HubAeoSection
          question={pickByLocale(
            locale,
            `Combien d'adresses dans la sélection « ${pickByLocale(locale, category.labelFr, category.labelEn)} » ?`,
            `How many addresses in the "${pickByLocale(locale, category.labelFr, category.labelEn)}" selection?`,
          )}
          answer={pickByLocale(locale, categoryAeoDesc.aeoFr, categoryAeoDesc.aeoEn)}
          headingId="category-aeo-title"
          emitJsonLd={false}
        />
      ) : null}

      {isEmpty ? (
        <section
          aria-labelledby="empty-state-title"
          className="border-border bg-muted/5 rounded-lg border p-6 md:p-8"
        >
          <h2 id="empty-state-title" className="text-fg font-serif text-xl">
            {pickByLocale(
              locale,
              'La sélection est en cours de constitution',
              'Selection in progress',
            )}
          </h2>
          <p className="text-muted mt-3 max-w-prose text-sm md:text-base">
            {pickByLocale(
              locale,
              `Notre conciergerie n'a pas encore publié d'adresse correspondant à cette catégorie. En attendant, explorez nos autres sélections — Palaces parisiens, Côte d'Azur, vignobles, montagnes — ou nos classements éditoriaux.`,
              `Our concierge desk has not yet published an address for this category. In the meantime, browse our other selections — Parisian Palaces, French Riviera, vineyards, mountains — or our editorial rankings.`,
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/hotels"
              className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Voir tous les hôtels', 'See all hotels')} →
            </Link>
            <Link
              href="/classements"
              className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {pickByLocale(locale, 'Voir nos classements', 'See our rankings')} →
            </Link>
          </div>
        </section>
      ) : (
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
      )}

      {!isEmpty && categoryAeoDesc !== undefined ? (
        <HubFaqSection
          heading={t.faqTitle}
          items={(locale === 'fr' ? categoryAeoDesc.faqFr : categoryAeoDesc.faqEn).map((it) => ({
            question: it.q,
            answer: it.a,
          }))}
        />
      ) : null}
    </main>
  );
}
