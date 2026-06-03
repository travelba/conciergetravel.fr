/**
 * Chain-aware ranking BATCH runner — Phase 3 (cross-chain rankings, wave 2).
 *
 * The original `run-chain-ranking.ts` shipped the first 8 chains (Aman,
 * Four Seasons, Mandarin Oriental, Six Senses, Cheval Blanc, Belmond,
 * Rosewood, Park Hyatt) from pre-dumped `out/chain-hotels/<chain>.json`
 * files and left the Supabase push to the agent.
 *
 * This batch runner closes the remaining viable chains in the curated
 * catalogue. It is fully self-contained:
 *   - Reads the full catalogue from `out/hotels-catalog.json` (2219
 *     rows, refreshed 2026-05-31) and filters per chain by a name
 *     regex — no per-chain JSON dump needed.
 *   - Generates each ranking via `generateRankingV2` (with a per-slug
 *     cache in `data/rankings-cache/<slug>/`, same convention as the
 *     matrix bulk runner — re-runs skip cached slugs unless --force).
 *   - Pushes directly to Supabase via `pushRankingV2` (DATABASE_URL),
 *     same path the matrix bulk runner uses. The `is_published` ratchet
 *     in pushRankingV2 means a re-push never downgrades a live page.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/rankings/run-chain-rankings-batch.ts \
 *     [--only=top-raffles-hotels-monde,top-bulgari-hotels-monde] \
 *     [--concurrency=2] \
 *     [--force] \
 *     [--dry-run] \
 *     [--draft] \
 *     [--no-push]
 */

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateRankingV2, type GeneratedRankingV2 } from './generate-ranking-v2.js';
import { GeneratedRankingV2Schema } from './generate-ranking-v2.js';
import { loadHotelsCatalog, type HotelCatalogRow } from './load-hotels-catalog.js';
import { pushRankingV2 } from './push-ranking-v2.js';
import type { RankingSeed } from './rankings-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const CACHE_ROOT = path.resolve(PILOT_ROOT, 'data/rankings-cache');
const RUNLOG_PATH = path.resolve(CACHE_ROOT, '_chain-batch-runlog.jsonl');

// ─── Chain specs (wave 2) ────────────────────────────────────────────

interface ChainSpec {
  readonly slug: string;
  /**
   * Case-insensitive regex matched against `hotels.name`. Optional when a
   * custom `match` predicate is supplied (e.g. tier + country association
   * rankings that cannot be matched by hotel name).
   */
  readonly nameRegex?: RegExp;
  /**
   * Custom eligibility predicate. Takes precedence over `nameRegex` when
   * present. Used by the association rankings (Relais & Châteaux, Small
   * Luxury Hotels) which filter on `luxury_tier` + `country_code`.
   */
  readonly match?: (h: HotelCatalogRow) => boolean;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly targetLength: number;
  readonly keywordsFr: readonly string[];
}

function eligibilityOf(spec: ChainSpec): (h: HotelCatalogRow) => boolean {
  if (spec.match) return spec.match;
  const re = spec.nameRegex;
  if (re) return (h) => re.test(h.name);
  throw new Error(`ChainSpec ${spec.slug} has neither nameRegex nor match.`);
}

export const CHAIN_SPECS_WAVE2: readonly ChainSpec[] = [
  {
    slug: 'top-ritz-carlton-hotels-monde',
    nameRegex: /ritz.?carlton/iu,
    titleFr: 'Top Ritz-Carlton — les adresses signature de la collection mondiale',
    titleEn: 'Top Ritz-Carlton — the signature addresses of the worldwide collection',
    targetLength: 45,
    keywordsFr: [
      'Ritz-Carlton — référence du service luxe Marriott, héritage César Ritz',
      'flagships urbains et resorts balnéaires : Half Moon Bay, Abama Tenerife, Kyoto, Bali',
      'Club Level, Ritz-Carlton Spa, gastronomie locale et tables étoilées',
      'mariages, MICE, séjours famille avec Ritz Kids',
      'clientèle internationale fidèle, programme Marriott Bonvoy haut de gamme',
    ],
  },
  {
    slug: 'top-st-regis-hotels-monde',
    nameRegex: /st\.? ?regis/iu,
    titleFr: 'Top St. Regis — héritage Astor et service majordome dans le monde',
    titleEn: 'Top St. Regis — Astor heritage and butler service worldwide',
    targetLength: 40,
    keywordsFr: [
      'St. Regis — fondé par John Jacob Astor IV, New York 1904',
      'Butler Service signature disponible 24h/24 dans chaque suite',
      'rituels maison : champagne sabrage, afternoon tea, Bloody Mary (le Red Snapper)',
      'adresses iconiques : Rome, Venise, Bora Bora, Maldives, Aspen',
      "clientèle UHNWI, lunes de miel, événements d'apparat",
    ],
  },
  {
    slug: 'top-anantara-hotels-monde',
    nameRegex: /anantara/iu,
    titleFr: "Top Anantara — l'art de vivre asiatique et les resorts immersifs",
    titleEn: 'Top Anantara — Asian art de vivre and immersive resorts',
    targetLength: 39,
    keywordsFr: [
      'Anantara — du sanskrit "sans fin", immersion culturelle et nature',
      'destinations signature : Thaïlande, Maldives, Oman (désert), Émirats, Italie',
      'expériences : dîner Dining by Design, spa, safaris et excursions sur-mesure',
      'resorts desert (Qasr Al Sarab) et îles privées (Kihavah Maldives)',
      'clientèle quête de dépaysement, lunes de miel, familles aisées',
    ],
  },
  {
    slug: 'top-waldorf-astoria-hotels-monde',
    nameRegex: /waldorf/iu,
    titleFr: 'Top Waldorf Astoria — le grand luxe Hilton héritier de New York',
    titleEn: "Top Waldorf Astoria — Hilton's grand luxury, New York heritage",
    targetLength: 31,
    keywordsFr: [
      'Waldorf Astoria — institution new-yorkaise née en 1893, fleuron Hilton',
      'adresses landmark : Beverly Hills, Amsterdam, Maldives Ithaafushi, Dubaï',
      'service personnalisé, conciergerie, spa et gastronomie raffinée',
      'patrimoine Art déco et architecture iconique restaurée',
      'clientèle affaires premium, célébrations, voyageurs Hilton Honors élite',
    ],
  },
  {
    slug: 'top-jumeirah-hotels-monde',
    nameRegex: /jumeirah/iu,
    titleFr: 'Top Jumeirah — le luxe émirati et ses icônes architecturales',
    titleEn: 'Top Jumeirah — Emirati luxury and its architectural icons',
    targetLength: 21,
    keywordsFr: [
      'Jumeirah — groupe dubaïote, hospitalité arabe contemporaine',
      'icône mondiale : Burj Al Arab Jumeirah, la "voile" de Dubaï',
      'adresses : Madinat Jumeirah, Capri, Mallorca, Londres (Carlton Tower)',
      'plages privées, spa Talise, gastronomie multi-étoilée',
      'clientèle internationale fortunée, familles du Golfe, lunes de miel',
    ],
  },
  {
    slug: 'top-raffles-hotels-monde',
    nameRegex: /raffles/iu,
    titleFr: 'Top Raffles — légende coloniale et palaces intemporels (Accor)',
    titleEn: 'Top Raffles — colonial legend and timeless palaces (Accor)',
    targetLength: 19,
    keywordsFr: [
      'Raffles — né à Singapour en 1887, berceau du Singapore Sling',
      'service majordome Raffles signature, élégance intemporelle',
      'adresses légendaires : Singapour, Paris (Le Royal Monceau), Londres (OWO), Bali, Seychelles',
      'patrimoine littéraire (Maugham, Kipling) et architecture restaurée',
      'clientèle raffinée, lunes de miel, voyageurs en quête de légende',
    ],
  },
  {
    slug: 'top-bulgari-hotels-monde',
    nameRegex: /bulgari|bvlgari/iu,
    titleFr: 'Top Bulgari Hotels — le luxe joaillier italien (groupe LVMH)',
    titleEn: 'Top Bulgari Hotels — Italian jeweller luxury (LVMH group)',
    targetLength: 12,
    keywordsFr: [
      'Bulgari Hotels & Resorts — maison joaillière romaine, design Antonio Citterio',
      'adresses confidentielles : Milan, Rome, Paris, Londres, Dubaï, Tokyo, Bali',
      'spa Bulgari réputés, gastronomie italienne signée Niko Romito',
      'esprit dolce vita contemporain, intérieurs en marbre et bois précieux',
      'clientèle UHNWI, amateurs de design et de mode, séjours urbains',
    ],
  },
  {
    slug: 'top-peninsula-hotels-monde',
    nameRegex: /peninsula/iu,
    titleFr: 'Top The Peninsula — le grand luxe hongkongais et sa flotte de Rolls',
    titleEn: 'Top The Peninsula — Hong Kong grand luxury and its Rolls fleet',
    targetLength: 10,
    keywordsFr: [
      'The Peninsula — groupe HSH, flagship Hong Kong depuis 1928',
      'flotte de Rolls-Royce Phantom vert Peninsula et hélicoptère sur le toit',
      'adresses : Hong Kong, Paris, Tokyo, Beverly Hills, Chicago, Istanbul, Londres',
      'afternoon tea iconique, spa, technologie en chambre primée',
      "clientèle d'affaires haut de gamme, familles fortunées, voyageurs fidèles",
    ],
  },
  {
    slug: 'top-capella-hotels-monde',
    nameRegex: /capella/iu,
    titleFr: 'Top Capella — le luxe intimiste et le service personnel signature',
    titleEn: 'Top Capella — intimate luxury and signature personal assistant',
    targetLength: 10,
    keywordsFr: [
      'Capella — petites adresses ultra-luxe, Personal Assistant dédié',
      'flagships : Capella Singapore, Bangkok (Chao Phraya), Sydney, Ubud',
      'design soigné (Bill Bensley à Ubud), villas avec piscine privée',
      'Auriga Spa, gastronomie de destination, intimité et discrétion',
      'clientèle en quête de calme et de raffinement, lunes de miel',
    ],
  },
  {
    slug: 'top-auberge-resorts-monde',
    nameRegex: /auberge resorts/iu,
    titleFr: "Top Auberge Resorts Collection — le luxe nature à l'américaine",
    titleEn: 'Top Auberge Resorts Collection — American nature-led luxury',
    targetLength: 10,
    keywordsFr: [
      'Auberge Resorts Collection — luxe décontracté ancré dans son territoire',
      'berceau napa : Auberge du Soleil, Calistoga Ranch, vignobles californiens',
      'resorts nature : Mexique (Susurros del Corazón), Costa Rica, Fidji, Aspen',
      'spa, gastronomie locavore, expériences plein air haut de gamme',
      'clientèle américaine aisée, escapades bien-être, slow luxury',
    ],
  },
  {
    slug: 'top-shangri-la-hotels-monde',
    nameRegex: /shangri/iu,
    titleFr: "Top Shangri-La — l'hospitalité asiatique et ses tours panoramiques",
    titleEn: 'Top Shangri-La — Asian hospitality and its skyline towers',
    targetLength: 8,
    keywordsFr: [
      'Shangri-La — hospitalité asiatique chaleureuse, fondée à Singapour 1971',
      'adresses sky-high : Shangri-La The Shard Londres, Paris (ex-palais Iéna), Hong Kong',
      'spa CHI, restaurants cantonais réputés, suites panoramiques',
      'service attentionné inspiré du roman "Horizons perdus"',
      "clientèle d'affaires, familles asiatiques aisées, voyageurs urbains",
    ],
  },
  {
    slug: 'top-one-and-only-resorts-monde',
    nameRegex: /one.?only/iu,
    titleFr: 'Top One&Only — les resorts ultra-luxe pour les grandes occasions',
    titleEn: 'Top One&Only — ultra-luxury resorts for landmark occasions',
    targetLength: 5,
    keywordsFr: [
      "One&Only — resorts d'exception du groupe Kerzner, fait pour marquer",
      'adresses signature : Le Saint Géran (Maurice), Reethi Rah (Maldives), Cape Town, Dubaï',
      'villas privées, majordome, gastronomie de chefs étoilés résidents',
      'expériences sur-mesure, kids club KidsOnly, spa de destination',
      "clientèle UHNWI, lunes de miel d'exception, voyages multigénérationnels",
    ],
  },
  {
    slug: 'top-oberoi-hotels-monde',
    nameRegex: /oberoi/iu,
    titleFr: "Top The Oberoi — le service indien d'excellence, primé au monde",
    titleEn: 'Top The Oberoi — Indian service excellence, awarded worldwide',
    targetLength: 5,
    keywordsFr: [
      'The Oberoi — groupe indien régulièrement n°1 des classements voyageurs',
      'palaces et resorts : Udaipur (Udaivilas), Agra (Amarvilas, vue Taj Mahal), Bali, Maurice',
      "service personnalisé d'anthologie, architecture rajput et moghole",
      'spa Oberoi, gastronomie indienne raffinée, intimité absolue',
      "clientèle en quête d'Inde luxueuse, lunes de miel, circuits palaces",
    ],
  },
  {
    slug: 'top-soneva-resorts-monde',
    nameRegex: /soneva/iu,
    titleFr: "Top Soneva — le luxe pieds nus et l'éco-conception aux Maldives",
    titleEn: 'Top Soneva — barefoot luxury and eco-design in the Maldives',
    targetLength: 5,
    keywordsFr: [
      'Soneva — pionnier du "No News, No Shoes", luxe pieds nus et durable',
      'adresses : Soneva Fushi et Soneva Jani (Maldives), Soneva Kiri (Thaïlande)',
      'villas avec toboggan, observatoire, cinéma plein air, fromagerie maison',
      'éco-engagement fort (carbone, zéro déchet), Soneva Soul wellness',
      'clientèle famille fortunée, lunes de miel, voyageurs conscients',
    ],
  },
];

// ─── Chain specs (wave 3) ────────────────────────────────────────────
// Brands not yet covered by wave 1/2. Name regexes verified against the
// 2219-row catalogue (2026-06-03). COMO is anchored `^como\b` to exclude
// the geographic false-positives "Mandarin Oriental, Lago di Como",
// "Passalacqua, Lake Como" and the EDITION hotel "The Lake Como EDITION".

export const CHAIN_SPECS_WAVE3: readonly ChainSpec[] = [
  {
    slug: 'top-kempinski-hotels-monde',
    nameRegex: /kempinski/iu,
    titleFr: 'Top Kempinski — le grand luxe européen, plus vieille collection du continent',
    titleEn: 'Top Kempinski — European grand luxury, the continent’s oldest collection',
    targetLength: 30,
    keywordsFr: [
      'Kempinski — fondé en 1897, plus ancienne collection hôtelière de luxe européenne',
      'adresses landmark : Berlin (Adlon), Genève, Saint-Moritz (Grand Hotel des Bains), Munich',
      'resorts balnéaires et urbains : Émirats, Chine, Indonésie, Maldives, Égypte',
      'spa, gastronomie, conciergerie Lady in Red signature',
      "clientèle d'affaires premium, familles du Golfe, voyageurs européens fidèles",
    ],
  },
  {
    slug: 'top-fairmont-hotels-monde',
    nameRegex: /fairmont/iu,
    titleFr: 'Top Fairmont — les palaces historiques nord-américains (groupe Accor)',
    titleEn: 'Top Fairmont — historic North American palaces (Accor group)',
    targetLength: 30,
    keywordsFr: [
      'Fairmont — châteaux et palaces patrimoniaux, héritage canadien et impérial',
      'icônes : Le Château Frontenac (Québec), The Savoy (Londres), Banff Springs, The Plaza',
      'adresses balnéaires et urbaines : Monte-Carlo, Dubaï, Maldives, San Francisco',
      'spa, gastronomie, architecture grand siècle restaurée',
      'clientèle familiale aisée, MICE, voyageurs Accor Live Limitless élite',
    ],
  },
  {
    slug: 'top-como-hotels-monde',
    nameRegex: /^como\b/iu,
    titleFr: 'Top COMO Hotels — le luxe bien-être et la table santé signature',
    titleEn: 'Top COMO Hotels — wellness luxury and signature healthy cuisine',
    targetLength: 15,
    keywordsFr: [
      'COMO Hotels & Resorts — luxe discret, wellness COMO Shambhala signature',
      'adresses : Maldives (Maalifushi, Cocoa Island), Bhoutan, Bali (Uma), Fidji (Laucala)',
      'cuisine COMO Shambhala (santé, ayurveda), spa de destination, retraites yoga',
      'urbains design : The Halkin et Metropolitan Londres, Metropolitan Bangkok',
      'clientèle en quête de ressourcement, lunes de miel, voyageurs wellness',
    ],
  },
  {
    slug: 'top-viceroy-hotels-monde',
    nameRegex: /\bviceroy\b/iu,
    titleFr: 'Top Viceroy — le lifestyle luxe américain et ses resorts design',
    titleEn: 'Top Viceroy — American lifestyle luxury and design resorts',
    targetLength: 8,
    keywordsFr: [
      'Viceroy Hotels & Resorts — lifestyle luxe contemporain, design audacieux',
      'adresses : Los Cabos, Riviera Maya, Bali, Sainte-Lucie (Sugar Beach), Santa Monica',
      'plages, piscines design, gastronomie et mixologie soignées',
      'urbains branchés : Chicago, New York, Snowmass (ski)',
      'clientèle américaine lifestyle, couples, escapades design',
    ],
  },
  {
    slug: 'top-grecotel-resorts-grece',
    nameRegex: /grecotel/iu,
    titleFr: 'Top Grecotel — les resorts grecs face à la Méditerranée',
    titleEn: 'Top Grecotel — Greek resorts facing the Mediterranean',
    targetLength: 5,
    keywordsFr: [
      'Grecotel — plus grand groupe hôtelier de luxe grec, ancré dans son territoire',
      'resorts balnéaires : Crète, Corfou, Péloponnèse, Mykonos',
      'plages privées, tavernes gastronomiques, spa et villas avec piscine',
      'art de vivre méditerranéen, hospitalité grecque, familles bienvenues',
      'clientèle familiale et couples en quête de soleil égéen',
    ],
  },
  {
    slug: 'top-taj-hotels-monde',
    nameRegex: /\btaj\b/iu,
    titleFr: 'Top Taj — les palais indiens légendaires (groupe Tata)',
    titleEn: 'Top Taj — legendary Indian palaces (Tata group)',
    targetLength: 4,
    keywordsFr: [
      'Taj Hotels — hospitalité indienne d’exception, groupe Tata depuis 1903',
      'palais iconiques : The Taj Mahal Palace (Mumbai), Taj Lake Palace (Udaipur)',
      'service personnalisé d’anthologie, architecture moghole et coloniale',
      'gastronomie indienne raffinée, spa Jiva, héritage maharaja',
      'clientèle en quête d’Inde luxueuse, circuits palaces, lunes de miel',
    ],
  },
  {
    slug: 'top-edition-hotels-monde',
    nameRegex: /\bedition\b/iu,
    titleFr: 'Top EDITION — le luxe lifestyle signé Ian Schrager (Marriott)',
    titleEn: 'Top EDITION — lifestyle luxury by Ian Schrager (Marriott)',
    targetLength: 3,
    keywordsFr: [
      'EDITION — concept lifestyle d’Ian Schrager, design épuré et nightlife',
      'adresses : Londres, Tokyo (Toranomon), Lac de Côme',
      'restaurants et bars destination, ambiance feutrée et contemporaine',
      'spa, fitness, service décontracté mais ultra-soigné',
      'clientèle urbaine branchée, créatifs, voyageurs design',
    ],
  },
  {
    slug: 'top-regent-hotels-monde',
    nameRegex: /\bregent\b/iu,
    titleFr: 'Top Regent — le raffinement asiatique intemporel (groupe IHG)',
    titleEn: 'Top Regent — timeless Asian refinement (IHG group)',
    targetLength: 3,
    keywordsFr: [
      'Regent — luxe feutré d’inspiration asiatique, élégance discrète',
      'adresses : Hong Kong (légendaire, rouvert), Pékin, Berlin',
      'suites spacieuses, service attentionné, vues panoramiques',
      'gastronomie raffinée, spa, art de recevoir asiatique',
      'clientèle d’affaires haut de gamme, voyageurs IHG élite',
    ],
  },
];

// ─── Re-homed brands (wave 2-bis) — topN bump ────────────────────────
// The first 8 chains shipped via `run-chain-ranking.ts` from stale
// pre-dumped JSON with conservative caps. Re-homing the most saturated
// ones here lets them regenerate from the fresh 2219-row catalogue with
// authoritative `luxury_tier` matching and a higher topN, and auto-push
// through the ratchet. These supersede the same slugs in
// `run-chain-ranking.ts`.

function byTier(tier: string): (h: HotelCatalogRow) => boolean {
  return (h) => h.luxury_tier === tier;
}

export const CHAIN_SPECS_REHOMED: readonly ChainSpec[] = [
  {
    slug: 'top-four-seasons-palaces-monde',
    match: byTier('four_seasons'),
    titleFr: 'Top Four Seasons — les palaces et flagships de la collection mondiale',
    titleEn: 'Top Four Seasons — palaces and flagships from the worldwide collection',
    targetLength: 45,
    keywordsFr: [
      'Four Seasons — référence service luxe global depuis 1961',
      'flagships et adresses palace : George V Paris, Cap-Ferrat, Firenze, Bora Bora',
      'spa, restaurants étoilés Michelin, kids program, business amenities',
      'Four Seasons Private Retreats — villas privées exceptionnelles',
      "mariages, événements MICE, lunes de miel, voyages d'affaires premium",
    ],
  },
  {
    slug: 'top-mandarin-oriental-hotels-monde',
    match: byTier('mandarin_oriental'),
    titleFr: "Top Mandarin Oriental — la collection hôtelière asiatique d'exception",
    titleEn: 'Top Mandarin Oriental — the finest hotels from the Asian luxury collection',
    targetLength: 40,
    keywordsFr: [
      'Mandarin Oriental — hospitalité asiatique adaptée à chaque destination',
      'flagships : Hong Kong, Bangkok, Tokyo, Paris, Londres, Genève',
      'spa Mandarin Oriental signature, gastronomie étoilée Michelin',
      'design intérieur signé Tony Chi, Adam D. Tihany, Christophe Pillet',
      "clientèle internationale fortunée, lunes de miel, voyages d'affaires haut de gamme",
    ],
  },
  {
    slug: 'top-park-hyatt-hotels-monde',
    match: byTier('park_hyatt'),
    titleFr: 'Top Park Hyatt — le luxe contemporain Hyatt dans le monde',
    titleEn: "Top Park Hyatt — Hyatt's contemporary luxury collection worldwide",
    targetLength: 40,
    keywordsFr: [
      "Park Hyatt — flagship luxe du groupe Hyatt, design contemporain d'auteur",
      'destinations urbaines : Tokyo, Paris-Vendôme, New York, Sydney, Vienne, Milan',
      'Spas Park Hyatt — souvent rooftop ou centre-ville premium',
      'Park Hyatt Niseko, Saint-Kitts, Maldives — escapades resort de la collection',
      "clientèle business haut de gamme, voyageurs d'affaires premium, lunes de miel urbaines",
    ],
  },
  {
    slug: 'top-aman-hotels-monde',
    match: byTier('aman'),
    titleFr: 'Top Aman — les plus belles adresses de la collection dans le monde',
    titleEn: 'Top Aman — the finest addresses in the worldwide collection',
    targetLength: 39,
    keywordsFr: [
      'collection Aman — Adrian Zecha, philosophie discrétion + intimité',
      'destinations signature : Bhoutan, Japon, Indonésie, Italie, Maroc',
      'pavillons et villas privées, spa Aman, gastronomie locale revisitée',
      'clientèle quête de retraite, lune de miel, voyage initiatique',
      'service ratio personnel / chambre élevé, expériences sur-mesure',
    ],
  },
  {
    slug: 'top-rosewood-hotels-monde',
    match: byTier('rosewood'),
    titleFr: 'Top Rosewood — la collection ultra-luxe sino-américaine',
    titleEn: 'Top Rosewood — the ultra-luxury Sino-American collection',
    targetLength: 29,
    keywordsFr: [
      'Rosewood — philosophie "A Sense of Place", chaque hôtel reflète l\'esprit du lieu',
      'flagships urbains : Mansion on Turtle Creek Dallas, Carlyle New York, Hong Kong',
      'resorts signature : Mayakoba (Mexique), Phuket, Le Guanahani (Saint-Barth)',
      'Asaya — programme wellness signature avec coachs experts',
      'clientèle UHNWI internationale, événements privés, mariages exclusifs',
    ],
  },
];

// ─── Association rankings (wave 4) — Relais & Châteaux + SLH by country ─
// Relais & Châteaux (435) and Small Luxury Hotels of the World (217) are
// the two largest cohorts of unranked hotels. They cannot be matched by
// name, so they are filtered on `luxury_tier` + `country_code`. Specs are
// generated programmatically for every (tier, country) pair with enough
// inventory. See `.cursor/skills/editorial-rankings-matrix/SKILL.md` Rule 8.

interface CountryDef {
  readonly cc: string;
  readonly nameFr: string;
  readonly nameEn: string;
  /** French preposition: "en France", "au Japon", "aux États-Unis". */
  readonly prep: string;
  readonly slug: string;
}

const ASSOCIATION_COUNTRIES: readonly CountryDef[] = [
  { cc: 'FR', nameFr: 'France', nameEn: 'France', prep: 'en', slug: 'france' },
  { cc: 'US', nameFr: 'États-Unis', nameEn: 'the United States', prep: 'aux', slug: 'etats-unis' },
  { cc: 'IT', nameFr: 'Italie', nameEn: 'Italy', prep: 'en', slug: 'italie' },
  {
    cc: 'GB',
    nameFr: 'Royaume-Uni',
    nameEn: 'the United Kingdom',
    prep: 'au',
    slug: 'royaume-uni',
  },
  { cc: 'ES', nameFr: 'Espagne', nameEn: 'Spain', prep: 'en', slug: 'espagne' },
  { cc: 'CH', nameFr: 'Suisse', nameEn: 'Switzerland', prep: 'en', slug: 'suisse' },
  { cc: 'DE', nameFr: 'Allemagne', nameEn: 'Germany', prep: 'en', slug: 'allemagne' },
  { cc: 'JP', nameFr: 'Japon', nameEn: 'Japan', prep: 'au', slug: 'japon' },
  { cc: 'PT', nameFr: 'Portugal', nameEn: 'Portugal', prep: 'au', slug: 'portugal' },
  { cc: 'CA', nameFr: 'Canada', nameEn: 'Canada', prep: 'au', slug: 'canada' },
  {
    cc: 'ZA',
    nameFr: 'Afrique du Sud',
    nameEn: 'South Africa',
    prep: 'en',
    slug: 'afrique-du-sud',
  },
  { cc: 'AR', nameFr: 'Argentine', nameEn: 'Argentina', prep: 'en', slug: 'argentine' },
  { cc: 'AT', nameFr: 'Autriche', nameEn: 'Austria', prep: 'en', slug: 'autriche' },
  { cc: 'NL', nameFr: 'Pays-Bas', nameEn: 'the Netherlands', prep: 'aux', slug: 'pays-bas' },
  { cc: 'GR', nameFr: 'Grèce', nameEn: 'Greece', prep: 'en', slug: 'grece' },
  { cc: 'IE', nameFr: 'Irlande', nameEn: 'Ireland', prep: 'en', slug: 'irlande' },
  { cc: 'MA', nameFr: 'Maroc', nameEn: 'Morocco', prep: 'au', slug: 'maroc' },
  { cc: 'AU', nameFr: 'Australie', nameEn: 'Australia', prep: 'en', slug: 'australie' },
  { cc: 'MY', nameFr: 'Malaisie', nameEn: 'Malaysia', prep: 'en', slug: 'malaisie' },
];

interface AssociationTier {
  readonly tier: string;
  readonly tierSlug: string;
  readonly brandFr: string;
  /** Countries (cc) to emit a ranking for — those with ≥ 5 unranked members. */
  readonly countries: readonly string[];
  readonly cap: number;
}

const ASSOCIATION_TIERS: readonly AssociationTier[] = [
  {
    tier: 'relais_chateaux',
    tierSlug: 'relais-chateaux',
    brandFr: 'Relais & Châteaux',
    cap: 30,
    countries: [
      'FR',
      'US',
      'IT',
      'GB',
      'ES',
      'CH',
      'DE',
      'JP',
      'PT',
      'CA',
      'ZA',
      'AR',
      'AT',
      'NL',
      'GR',
      'IE',
      'MA',
    ],
  },
  {
    tier: 'small_luxury_hotels',
    tierSlug: 'small-luxury-hotels',
    brandFr: 'Small Luxury Hotels of the World',
    cap: 30,
    countries: ['GR', 'IT', 'GB', 'ES', 'PT', 'IE', 'US', 'AU', 'MY', 'AT'],
  },
];

function buildAssociationSpecs(): ChainSpec[] {
  const byCc = new Map(ASSOCIATION_COUNTRIES.map((c) => [c.cc, c]));
  const specs: ChainSpec[] = [];
  for (const t of ASSOCIATION_TIERS) {
    for (const cc of t.countries) {
      const c = byCc.get(cc);
      if (!c) throw new Error(`Missing CountryDef for ${cc}`);
      const isRC = t.tier === 'relais_chateaux';
      const titleFr = isRC
        ? `Top Relais & Châteaux ${c.prep} ${c.nameFr} — maisons d'exception et tables gastronomiques`
        : `Top Small Luxury Hotels ${c.prep} ${c.nameFr} — adresses indépendantes de charme`;
      const titleEn = isRC
        ? `Top Relais & Châteaux in ${c.nameEn} — exceptional houses and gourmet tables`
        : `Top Small Luxury Hotels in ${c.nameEn} — independent boutique addresses`;
      const keywordsFr = isRC
        ? [
            "Relais & Châteaux — association de maisons indépendantes d'exception (gastronomie, art de vivre, patrimoine)",
            `sélection ${c.nameFr} : demeures de caractère, tables gastronomiques, accueil familial`,
            'cuisine de chefs, terroir local, cadres patrimoniaux et nature préservée',
            `idéal escapades romantiques, séjours gastronomiques, week-ends de charme ${c.prep} ${c.nameFr}`,
            'label qualité Relais & Châteaux, esprit maison, hospitalité personnalisée',
          ]
        : [
            "Small Luxury Hotels of the World (SLH) — collection d'hôtels indépendants de charme et de caractère",
            `sélection ${c.nameFr} : boutique-hôtels, demeures historiques, adresses confidentielles`,
            'intimité, design singulier, service personnalisé, ancrage local',
            `idéal city-breaks, escapades en couple, voyages indépendants ${c.prep} ${c.nameFr}`,
            'label SLH, indépendance, expériences authentiques et soignées',
          ];
      specs.push({
        slug: `top-${t.tierSlug}-${c.slug}`,
        match: (h) => h.luxury_tier === t.tier && h.country_code === cc,
        titleFr,
        titleEn,
        targetLength: t.cap,
        keywordsFr,
      });
    }
  }
  return specs;
}

export const CHAIN_SPECS_ASSOCIATIONS: readonly ChainSpec[] = buildAssociationSpecs();

// ─── Cache + runlog helpers ──────────────────────────────────────────

function cacheDirFor(slug: string): string {
  return path.resolve(CACHE_ROOT, slug);
}

async function readCachedGeneration(slug: string): Promise<GeneratedRankingV2 | null> {
  try {
    const raw = await readFile(path.join(cacheDirFor(slug), 'generated.json'), 'utf-8');
    const parsed = GeneratedRankingV2Schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeCachedGeneration(slug: string, ranking: GeneratedRankingV2): Promise<void> {
  const dir = cacheDirFor(slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'generated.json'), JSON.stringify(ranking, null, 2), 'utf-8');
}

interface RunLogEntry {
  readonly ts: string;
  readonly slug: string;
  readonly status: 'cached' | 'generated' | 'pushed' | 'skipped' | 'failed';
  readonly eligibleCount: number;
  readonly targetLength: number;
  readonly durationMs: number;
  readonly entriesCount?: number;
  readonly faqCount?: number;
  readonly error?: string;
}

async function appendRunLog(entry: RunLogEntry): Promise<void> {
  await mkdir(CACHE_ROOT, { recursive: true });
  await appendFile(RUNLOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

// ─── CLI ─────────────────────────────────────────────────────────────

interface Args {
  readonly only: ReadonlySet<string> | null;
  readonly concurrency: number;
  readonly force: boolean;
  readonly dryRun: boolean;
  readonly publish: boolean;
  readonly noPush: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let only: Set<string> | null = null;
  let concurrency = 2;
  let force = false;
  let dryRun = false;
  let publish = true;
  let noPush = false;
  for (const a of argv) {
    if (a === '--force') force = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--draft') publish = false;
    else if (a === '--no-push') noPush = true;
    else if (a.startsWith('--only=')) {
      const v = a.slice('--only='.length).trim();
      only = new Set(
        v
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );
    } else if (a.startsWith('--concurrency=')) {
      const v = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(v) && v > 0 && v <= 6) concurrency = Math.floor(v);
    }
  }
  return { only, concurrency, force, dryRun, publish, noPush };
}

// ─── Concurrency primitive ───────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const total = items.length;
  const worker = async (): Promise<void> => {
    while (cursor < total) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i] as T, i);
    }
  };
  const workers: Promise<void>[] = [];
  const n = Math.min(limit, total);
  for (let w = 0; w < n; w += 1) workers.push(worker());
  await Promise.all(workers);
  return out;
}

// ─── Single-chain driver ─────────────────────────────────────────────

interface ChainResult {
  readonly slug: string;
  readonly ok: boolean;
  readonly status: RunLogEntry['status'];
  readonly error?: string;
}

async function processChain(
  spec: ChainSpec,
  catalog: readonly HotelCatalogRow[],
  args: Args,
  index: number,
  total: number,
): Promise<ChainResult> {
  const tag = `[${index + 1}/${total} ${spec.slug}]`;
  const t0 = Date.now();

  const eligible = catalog.filter(eligibilityOf(spec));
  if (eligible.length < 3) {
    console.log(`${tag} ⤬ skipped: only ${eligible.length} eligible (need ≥ 3).`);
    await appendRunLog({
      ts: new Date().toISOString(),
      slug: spec.slug,
      status: 'skipped',
      eligibleCount: eligible.length,
      targetLength: spec.targetLength,
      durationMs: 0,
    });
    return { slug: spec.slug, ok: true, status: 'skipped' };
  }

  const seed: RankingSeed = {
    slug: spec.slug,
    titleFr: spec.titleFr,
    titleEn: spec.titleEn,
    kind: 'thematic',
    targetLength: Math.min(spec.targetLength, eligible.length),
    keywordsFr: spec.keywordsFr,
    eligibility: () => true,
  };

  let ranking: GeneratedRankingV2 | null = null;
  let cached = false;
  if (!args.force) {
    ranking = await readCachedGeneration(spec.slug);
    if (ranking !== null) {
      cached = true;
      console.log(`${tag} ↻ cached (skipping LLM)`);
    }
  }

  if (ranking === null) {
    if (args.dryRun) {
      console.log(
        `${tag} (dry-run) would generate from ${eligible.length} eligible (target ${seed.targetLength}).`,
      );
      return { slug: spec.slug, ok: true, status: 'skipped' };
    }
    try {
      console.log(
        `${tag} generating (target=${seed.targetLength} from ${eligible.length} eligible)…`,
      );
      ranking = await generateRankingV2(seed, eligible);
      await writeCachedGeneration(spec.slug, ranking);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ✗ generation failed: ${msg}`);
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'failed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        error: msg,
      });
      return { slug: spec.slug, ok: false, status: 'failed', error: msg };
    }
  }

  if (args.dryRun) {
    console.log(`${tag} (dry-run) would ${cached ? 'reuse cached' : 'push'} — no DB write.`);
    return { slug: spec.slug, ok: true, status: cached ? 'cached' : 'generated' };
  }

  if (!args.noPush) {
    try {
      await pushRankingV2(seed, ranking, { publish: args.publish });
      console.log(
        `${tag} ✓ ${cached ? 'cached + ' : ''}pushed (entries=${ranking.entries.length}, faq=${ranking.faq.length})`,
      );
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'pushed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        entriesCount: ranking.entries.length,
        faqCount: ranking.faq.length,
      });
      return { slug: spec.slug, ok: true, status: 'pushed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} ✗ push failed: ${msg}`);
      await appendRunLog({
        ts: new Date().toISOString(),
        slug: spec.slug,
        status: 'failed',
        eligibleCount: eligible.length,
        targetLength: seed.targetLength,
        durationMs: Date.now() - t0,
        entriesCount: ranking.entries.length,
        faqCount: ranking.faq.length,
        error: msg,
      });
      return { slug: spec.slug, ok: false, status: 'failed', error: msg };
    }
  }

  console.log(`${tag} ✓ ${cached ? 'cached' : 'generated'} (no-push)`);
  return { slug: spec.slug, ok: true, status: cached ? 'cached' : 'generated' };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const catalog = await loadHotelsCatalog();
  console.log(`Loaded ${catalog.length} hotels from catalogue.`);

  let specs: ChainSpec[] = [
    ...CHAIN_SPECS_WAVE2,
    ...CHAIN_SPECS_WAVE3,
    ...CHAIN_SPECS_REHOMED,
    ...CHAIN_SPECS_ASSOCIATIONS,
  ];
  if (args.only !== null) {
    const wanted = args.only;
    specs = specs.filter((s) => wanted.has(s.slug));
  }

  console.log(
    `\n→ Will process ${specs.length} chain ranking(s) — concurrency=${args.concurrency}, force=${args.force}, dry-run=${args.dryRun}, publish=${args.publish}, push=${!args.noPush}\n`,
  );

  const t0 = Date.now();
  const results = await runWithConcurrency(specs, args.concurrency, (spec, idx) =>
    processChain(spec, catalog, args, idx, specs.length),
  );
  const dt = Date.now() - t0;

  const pushed = results.filter((r) => r.status === 'pushed').length;
  const generated = results.filter((r) => r.status === 'generated').length;
  const cached = results.filter((r) => r.status === 'cached').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const fail = results.filter((r) => !r.ok).length;

  console.log('\n━━━ Summary ━━━');
  console.log(`Wall-clock: ${(dt / 1000).toFixed(1)} s (concurrency=${args.concurrency})`);
  console.log(
    `OK: ${results.filter((r) => r.ok).length} (pushed=${pushed}, generated-only=${generated}, cached=${cached}, skipped=${skipped})`,
  );
  console.log(`FAIL: ${fail}`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  - ${r.slug}: ${r.error ?? 'unknown error'}`);
    }
    process.exitCode = 1;
  }
  console.log(`\nRun log: ${RUNLOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
