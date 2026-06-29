/**
 * combinator.ts — produces the matrix of ranking seeds.
 *
 * Inputs:
 *   - The hotel catalog (`out/hotels-catalog.json`).
 *   - The classified yonder Tops (`data/yonder-tops-fr-classified.json`).
 *
 * Outputs (in-memory):
 *   - `MatrixSeed[]` — each seed has: slug, titles, axes, eligibility
 *     predicate, target length, eligible-hotel count, source
 *     (`auto` | `yonder` | `manual`), template key.
 *
 * The combinator's job is **discovery**. It does NOT call the LLM;
 * it just enumerates (type × lieu × theme × occasion) combinations
 * that satisfy the catalog eligibility floor, plus injects yonder
 * Tops we want to mirror, plus a small "manual override" list of
 * high-search-volume Tops we always want to ship.
 *
 * Eligibility floor: configurable via `MIN_ELIGIBLE`. With our
 * current 30-hotel catalog (27 palaces, 12 Paris, 5 Courchevel) we
 * use 3. As the catalog grows we'll bump it to 5 for stronger SEO.
 */

import type { HotelCatalogRow } from './load-hotels-catalog.js';
import {
  HOTEL_TYPES,
  LIEUX,
  THEMES,
  OCCASIONS,
  resolveLieu,
  type HotelType,
  type LieuDef,
  type Occasion,
  type RankingAxes,
  type Theme,
} from './axes.js';
import { renderRanking, type RenderedRankingSeed } from './templates.js';

// ─── Tunables ────────────────────────────────────────────────────────────

const MIN_ELIGIBLE = 3;
// 2026-06-29 — PO densification of high-vivier scopes (audit
// rankings-hotel-completeness-2026-06-29 §8 rec.2). Targets are an editorial
// CAP, not a quota: `targetLengthFor` returns min(base, eligibleCount), so a
// thin city stays at its real eligible count and only fort-vivier scopes
// (Dubaï 58, Italie 173, Espagne 124, Japon 70, Maroc 42, Rome 24…) grow.
const TARGET_LENGTH_BY_LIEU_SCOPE: Readonly<Record<LieuDef['scope'], number>> = {
  france: 12,
  region: 12,
  cluster: 12,
  ville: 12,
  arrondissement: 8,
  station: 10,
  departement: 10,
  monde: 12,
  pays: 12,
};

// ─── Eligibility predicates ──────────────────────────────────────────────

const lc = (s: string): string => s.toLowerCase();

/**
 * Normalize a city / key string for whole-word matching: lowercase, strip
 * diacritics, and collapse every non-alphanumeric run (spaces, hyphens,
 * apostrophes) into a single space. This turns "Les Baux-de-Provence" and the
 * key "baux-de-provence" into the comparable token streams "les baux de
 * provence" and "baux de provence".
 */
function normForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

/**
 * C1 (2026-06-25) — whole-word / whole-phrase city match.
 *
 * Replaces the permissive `city.includes(key)` that produced cross-country
 * false positives ("nice" ⊂ "venice", "paris" ⊂ "st mary's parish", "arles" ⊂
 * "charleston", "roma" ⊂ "punta maroma"). A key matches only when it equals
 * the city or appears as a contiguous run of whole tokens inside it. Token
 * boundaries are enforced by padding both sides with a space, so a multi-token
 * key ("baux-de-provence", "porto-vecchio") still matches the city that
 * contains that exact phrase ("Les Baux-de-Provence", "Lecci de Porto-Vecchio")
 * while a partial token never does.
 */
export function cityMatchesKey(city: string, key: string): boolean {
  const c = normForMatch(city);
  const k = normForMatch(key);
  if (c.length === 0 || k.length === 0) return false;
  if (c === k) return true;
  return ` ${c} `.includes(` ${k} `);
}

/**
 * C1 (2026-06-25) — optional precise filters applied on top of the
 * type/lieu/theme axes. Used to select hotels by their `luxury_tier` (brand /
 * label enum, e.g. `relais_chateaux`, `four_seasons`) or by an `affiliations[]`
 * facet (snake_case `source` or kebab-case `facet_slug`), instead of fragile
 * name heuristics. All values are matched case-insensitively; an empty / absent
 * list means "no constraint on that dimension".
 */
export interface EligibilityFilter {
  readonly luxuryTiers?: readonly string[];
  readonly affiliationFacets?: readonly string[];
}

function tierMatches(h: HotelCatalogRow, tiers: ReadonlySet<string>): boolean {
  const t = h.luxury_tier;
  return typeof t === 'string' && t.length > 0 && tiers.has(t.toLowerCase());
}

function affiliationMatches(h: HotelCatalogRow, facets: ReadonlySet<string>): boolean {
  const affs = h.affiliations ?? [];
  for (const a of affs) {
    const source = typeof a.source === 'string' ? a.source.toLowerCase() : '';
    const facet = typeof a.facet_slug === 'string' ? a.facet_slug.toLowerCase() : '';
    // Cross-match both conventions: a snake_case facet target also matches a
    // kebab-case facet_slug and vice-versa (relais_chateaux ↔ relais-chateaux).
    if (source.length > 0 && (facets.has(source) || facets.has(source.replace(/_/gu, '-'))))
      return true;
    if (facet.length > 0 && (facets.has(facet) || facets.has(facet.replace(/-/gu, '_'))))
      return true;
  }
  return false;
}

function lieuMatches(h: HotelCatalogRow, lieu: LieuDef): boolean {
  if (lieu.slug === 'france') return true;
  // 2026-05-31 — country scope: a hotel matches when its `country_code`
  // is in the lieu's `countryCodes` list. Used by international country
  // rankings (`meilleurs-hotels-mexique`, `-emirats-arabes-unis`, …).
  //
  // 2026-06-23 — country + city AND-semantics: when a lieu sets BOTH a
  // non-empty `countryCodes` AND non-empty `hotelCityKeys`, the hotel must
  // satisfy BOTH (country gate, then city match). This disambiguates a city
  // ranking from a homonym in another country (e.g. `vienne` = Vienna/AT,
  // not the French Vienne; `geneve` = Geneva/CH). A country-only lieu keeps
  // its empty `hotelCityKeys` and short-circuits below (unchanged behaviour).
  const countryCodes = lieu.countryCodes;
  if (countryCodes !== undefined && countryCodes.length > 0) {
    const cc = (h.country_code ?? '').toUpperCase();
    const countryOk = countryCodes.some((target) => target.toUpperCase() === cc);
    if (!countryOk) return false;
    // Country-only scope: no city keys → the country gate is the whole test.
    if (lieu.hotelCityKeys.length === 0) return true;
    // Else fall through to the city match (AND).
  }
  const cityMatch = lieu.hotelCityKeys.some((k) => cityMatchesKey(h.city, k));
  if (!cityMatch) return false;
  // A2 (May 19, 2026): refine eligibility for arrondissement / quartier
  // lieus by matching on postal_code. A hotel located in "Paris" but with
  // postal_code 75008 will match `paris-8` / `champs-elysees`, NOT `paris-2`
  // even though the city key alone is permissive.
  if (lieu.postalCodePrefixes !== undefined && lieu.postalCodePrefixes.length > 0) {
    const pc = (h.postal_code ?? '').replace(/\s+/gu, '');
    return lieu.postalCodePrefixes.some((prefix) => pc.startsWith(prefix));
  }
  return true;
}

/**
 * Type predicate against a single hotel row. Falls through to true
 * for `'all'` (no type filter).
 */
function typeMatches(h: HotelCatalogRow, t: HotelType): boolean {
  switch (t) {
    case 'palace':
      return h.is_palace;
    case '5-etoiles':
      return h.stars === 5;
    case '4-etoiles':
      return h.stars === 4;
    case 'all':
      return true;
    // The remaining types (boutique-hotel, chateau, chalet, villa,
    // maison-hotes, resort, ecolodge, insolite) require Payload
    // tagging not yet present on `hotels`. We mark them as eligible
    // when the hotel name contains the keyword; weak heuristic but
    // harmless until proper tagging lands.
    case 'chateau':
      return /ch[âa]teau/iu.test(h.name);
    case 'chalet':
      return /chalet/iu.test(h.name);
    case 'villa':
      return /villa/iu.test(h.name);
    case 'maison-hotes':
      return /maison/iu.test(h.name) && /h[ôo]tes?/iu.test(h.name);
    case 'resort':
      return /resort/iu.test(h.name);
    case 'ecolodge':
      return /[éee]colodge|eco[\s-]?lodge/iu.test(h.name);
    case 'boutique-hotel':
      return false;
    case 'insolite':
      return false;
    default:
      return false;
  }
}

/**
 * Theme predicate. Until Payload exposes per-hotel theme flags we
 * fall back to keyword heuristics on description + name. The match
 * is intentionally permissive (eligibility, not authority); the LLM
 * pass narrows the actual selected hotels.
 */
function themeMatches(h: HotelCatalogRow, theme: Theme): boolean {
  const hay = `${h.name} ${h.description_fr ?? ''} ${h.city}`.toLowerCase();
  switch (theme) {
    case 'romantique':
    case 'famille':
    case 'spa-bienetre':
      // Most palaces have spa — be permissive.
      return h.is_palace || /spa|wellness|bien-?[ée]tre/iu.test(hay);
    case 'gastronomie':
      // Structured signal first (2026-06-25): hotels with a Michelin-starred
      // venue in `restaurant_info` qualify even when the description text never
      // says "michelin" (e.g. Tokyo's Okura/Peninsula). Falls back to the
      // palace flag + keyword heuristic for hotels without the structured field.
      return (
        (h.michelin_stars ?? 0) > 0 ||
        h.is_palace ||
        /michelin|gastronomique|restaurant.*[ée]toil/iu.test(hay)
      );
    case 'design':
      return /design|architect/iu.test(hay);
    case 'patrimoine':
      return /h[ée]ritage|patrimoine|historique|class[ée]/iu.test(hay) || h.is_palace;
    case 'vignobles':
      return /vignoble|vigne|domaine|viticole|caudalie|champagne/iu.test(hay);
    case 'mer':
      return /plage|bord de mer|c[ôo]te|lagon|m[ée]diterran/iu.test(hay);
    case 'montagne':
      return /alpes|montagne|chamonix|courchevel|m[ée]g[èe]ve|val/iu.test(hay);
    case 'campagne':
      return /campagne|domaine|gordes|provence/iu.test(hay);
    case 'urbain':
      return /paris|lyon|marseille|toulouse|bordeaux|nice/iu.test(hay);
    case 'sport-golf':
      return /golf/iu.test(hay);
    case 'sport-tennis':
      return /tennis/iu.test(hay);
    case 'sport-padel':
      return /padel/iu.test(hay);
    case 'sport-surf':
      return /surf/iu.test(hay);
    case 'sport-ski':
      return /ski|piste/iu.test(hay) || /alpes|courchevel|m[ée]g[èe]ve/iu.test(hay);
    case 'rooftop':
      return /rooftop|terrasse/iu.test(hay);
    case 'piscine':
      return /piscine|pool/iu.test(hay) || h.is_palace;
    case 'kids-friendly':
      return /famille|enfants?|kids/iu.test(hay) || h.is_palace;
    case 'insolite':
      return /insolite|extraordinaire/iu.test(hay);
    default:
      return false;
  }
}

/**
 * Combined eligibility predicate from an axes set, with an optional precise
 * `filter` (luxury_tier / affiliation facet — C1, 2026-06-25). When the filter
 * is omitted the behaviour is identical to the pre-C1 type/lieu/theme gate, so
 * every existing caller is unaffected.
 */
export function eligibilityFor(
  axes: RankingAxes,
  filter?: EligibilityFilter,
): (h: HotelCatalogRow) => boolean {
  const lieu = resolveLieu(axes.lieu.slug);
  const tiers =
    filter?.luxuryTiers && filter.luxuryTiers.length > 0
      ? new Set(filter.luxuryTiers.map((t) => t.toLowerCase()))
      : null;
  const facets =
    filter?.affiliationFacets && filter.affiliationFacets.length > 0
      ? new Set(filter.affiliationFacets.map((f) => f.toLowerCase()))
      : null;
  return (h) => {
    if (lieu !== null && !lieuMatches(h, lieu)) return false;
    const type = axes.types[0] ?? 'all';
    if (!typeMatches(h, type)) return false;
    for (const th of axes.themes) {
      if (!themeMatches(h, th)) return false;
    }
    if (tiers !== null && !tierMatches(h, tiers)) return false;
    if (facets !== null && !affiliationMatches(h, facets)) return false;
    return true;
  };
}

// ─── Matrix seed ─────────────────────────────────────────────────────────

export type MatrixSource = 'auto' | 'yonder' | 'manual';

export interface MatrixSeed {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly axes: RankingAxes;
  readonly source: MatrixSource;
  readonly templateKey: string;
  readonly targetLength: number;
  readonly eligibleCount: number;
  readonly eligibleHotelIds: readonly string[];
  /** True when at least `MIN_ELIGIBLE` hotels are available. */
  readonly hasEnoughCandidates: boolean;
  /** Yonder slug, when this seed mirrors a yonder Top. */
  readonly yonderSlug: string | null;
  /** Yonder original title (kept for cross-link / source badge). */
  readonly yonderTitle: string | null;
  /** Editorial keywords prompts for the LLM. */
  readonly keywordsFr: readonly string[];
  /** Optional editorial kind override (best_of by default). */
  readonly kind: 'best_of' | 'awarded' | 'thematic' | 'geographic';
}

function targetLengthFor(axes: RankingAxes, eligibleCount: number): number {
  const lieu = resolveLieu(axes.lieu.slug);
  const base = lieu !== null ? TARGET_LENGTH_BY_LIEU_SCOPE[lieu.scope] : 10;
  return Math.min(base, Math.max(MIN_ELIGIBLE, eligibleCount));
}

function kindFor(axes: RankingAxes): MatrixSeed['kind'] {
  if (axes.lieu.slug !== 'france') return 'geographic';
  if (axes.themes.length > 0) return 'thematic';
  return 'best_of';
}

function buildKeywords(axes: RankingAxes, lieu: LieuDef | null): string[] {
  const out: string[] = [];
  out.push(`Lieu : ${lieu?.label ?? axes.lieu.label} (${axes.lieu.scope})`);
  if (axes.types.length > 0) {
    out.push(`Types ciblés : ${axes.types.join(', ')}`);
  }
  if (axes.themes.length > 0) {
    out.push(`Thématiques : ${axes.themes.join(', ')}`);
  }
  if (axes.occasions.length > 0) {
    out.push(`Occasions : ${axes.occasions.join(', ')}`);
  }
  if (axes.saison !== 'toute-annee') {
    out.push(`Saison : ${axes.saison}`);
  }
  return out;
}

interface BuildSeedInput {
  readonly axes: RankingAxes;
  readonly source: MatrixSource;
  readonly catalog: ReadonlyArray<HotelCatalogRow>;
  readonly yonderSlug?: string | null;
  readonly yonderTitle?: string | null;
  readonly slugOverride?: string | null;
  readonly titleFrOverride?: string | null;
  readonly titleEnOverride?: string | null;
  /** Optional precise eligibility filter (luxury_tier / affiliation facet). */
  readonly eligibilityFilter?: EligibilityFilter | undefined;
}

function buildSeed(input: BuildSeedInput): MatrixSeed | null {
  const rendered = renderRanking(input.axes);
  if (rendered === null && input.slugOverride === undefined) return null;

  const slug = input.slugOverride ?? rendered!.slug;
  const titleFr = input.titleFrOverride ?? rendered!.titleFr;
  const titleEn = input.titleEnOverride ?? rendered!.titleEn;
  const templateKey = rendered?.templateKey ?? 'manual';

  const predicate = eligibilityFor(input.axes, input.eligibilityFilter);
  const eligibleHotelIds: string[] = [];
  for (const h of input.catalog) {
    if (predicate(h)) eligibleHotelIds.push(h.id);
  }

  const lieu = resolveLieu(input.axes.lieu.slug);
  const seed: MatrixSeed = {
    slug,
    titleFr,
    titleEn,
    axes: input.axes,
    source: input.source,
    templateKey,
    targetLength: targetLengthFor(input.axes, eligibleHotelIds.length),
    eligibleCount: eligibleHotelIds.length,
    eligibleHotelIds,
    hasEnoughCandidates: eligibleHotelIds.length >= MIN_ELIGIBLE,
    yonderSlug: input.yonderSlug ?? null,
    yonderTitle: input.yonderTitle ?? null,
    keywordsFr: buildKeywords(input.axes, lieu),
    kind: kindFor(input.axes),
  };
  return seed;
}

// ─── Manual high-volume overrides ────────────────────────────────────────

/**
 * Tops we always want to ship, even if the algorithm wouldn't pick
 * them up (or if the slug differs from the canonical template). One
 * entry = one ranking guaranteed in the matrice. Order matters only
 * for ties on slug collisions (manual wins).
 */
interface ManualOverride {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly axes: RankingAxes;
  readonly kind?: MatrixSeed['kind'];
  /**
   * Optional precise eligibility filter (C1, 2026-06-25). When set, the seed's
   * eligible-hotel set is narrowed to hotels carrying one of these
   * `luxury_tier` values and/or `affiliations[]` facets — the supported path
   * for brand / label rankings (e.g. Relais & Châteaux on
   * `luxury_tier='relais_chateaux'`) instead of a name heuristic.
   */
  readonly luxuryTiers?: readonly string[];
  readonly affiliationFacets?: readonly string[];
}

// ─── 2026-06-22 — « Hôtel de luxe {ville} » acquisition pages ─────────────
// Audit `docs/audits/rankings-seo-geo-audit-2026-06-22.md` (G2): the
// « hôtel de luxe {ville} » intent draws 10-30× the volume of « meilleurs
// hôtels {ville} » (Paris ≈ 2 900/mo) yet only ONE `luxe` slug existed
// catalogue-wide (`meilleurs-hotels-luxe-france`). These bare-lieu
// (`type=all` → a BROAD luxury selection, not only Atout-France palaces)
// head terms target the highest-demand servable French cities (≥ ~5
// published hotels). Differentiated from the `meilleurs-palaces-*` /
// `5-etoiles-*` angle. Eligibility relies on the LieuDef in `axes.ts`.
// 2026-06-23 expansion (wave 2): Marrakech / Monaco / Dubaï added now
// that their LieuDefs landed in axes.ts from the intl wave. Each gate-
// checked against the live catalogue via `eligibilityFor` (the predicate
// re-resolves the lieu by SLUG through `resolveLieu`, so only registered
// LIEUX slugs yield a precise count): Marrakech 16, Monaco 4, Dubaï 53 —
// all ≥ the 4-hotel feasibility floor. Cannes (Carlton dup → 3 distinct),
// Biarritz (3), Lyon (3), Bordeaux (cannibalises the existing cluster
// head) and Aix-en-Provence (3 city hotels — the 17 count was a polluted
// Provence-cluster resolution) are deliberately NOT created. See
// `docs/audits/rankings-seo-geo-audit-2026-06-22.md` §1.
const LUXE_CITIES: readonly {
  readonly slug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly scope: LieuDef['scope'];
  readonly lieuSlug: string;
  readonly label: string;
}[] = [
  {
    slug: 'hotel-de-luxe-paris',
    titleFr: 'Les meilleurs hôtels de luxe à Paris',
    titleEn: 'The best luxury hotels in Paris',
    scope: 'ville',
    lieuSlug: 'paris',
    label: 'Paris',
  },
  {
    slug: 'hotel-de-luxe-cote-d-azur',
    titleFr: "Les meilleurs hôtels de luxe sur la Côte d'Azur",
    titleEn: 'The best luxury hotels on the French Riviera',
    scope: 'cluster',
    lieuSlug: 'cote-d-azur',
    label: "Côte d'Azur",
  },
  {
    slug: 'hotel-de-luxe-nice',
    titleFr: 'Les meilleurs hôtels de luxe à Nice',
    titleEn: 'The best luxury hotels in Nice',
    scope: 'ville',
    lieuSlug: 'nice',
    label: 'Nice',
  },
  {
    slug: 'hotel-de-luxe-saint-tropez',
    titleFr: 'Les meilleurs hôtels de luxe à Saint-Tropez',
    titleEn: 'The best luxury hotels in Saint-Tropez',
    scope: 'ville',
    lieuSlug: 'saint-tropez',
    label: 'Saint-Tropez',
  },
  {
    slug: 'hotel-de-luxe-courchevel',
    titleFr: 'Les meilleurs hôtels de luxe à Courchevel',
    titleEn: 'The best luxury hotels in Courchevel',
    scope: 'station',
    lieuSlug: 'courchevel',
    label: 'Courchevel',
  },
  {
    slug: 'hotel-de-luxe-megeve',
    titleFr: 'Les meilleurs hôtels de luxe à Megève',
    titleEn: 'The best luxury hotels in Megève',
    scope: 'station',
    lieuSlug: 'megeve',
    label: 'Megève',
  },
  // ── Wave 2 (2026-06-23) — high-volume, gate-cleared luxe heads ──────────
  {
    slug: 'hotel-de-luxe-marrakech',
    titleFr: 'Les meilleurs hôtels de luxe à Marrakech',
    titleEn: 'The best luxury hotels in Marrakech',
    scope: 'ville',
    lieuSlug: 'marrakech',
    label: 'Marrakech',
  },
  {
    slug: 'hotel-de-luxe-monaco',
    titleFr: 'Les meilleurs hôtels de luxe à Monaco',
    titleEn: 'The best luxury hotels in Monaco',
    scope: 'ville',
    lieuSlug: 'monaco',
    label: 'Monaco',
  },
  {
    slug: 'hotel-de-luxe-dubai',
    titleFr: 'Les meilleurs hôtels de luxe à Dubaï',
    titleEn: 'The best luxury hotels in Dubai',
    scope: 'ville',
    lieuSlug: 'dubai',
    label: 'Dubaï',
  },
  // ── Wave 3 (2026-06-23) — top-volume intl cities NOT already covered ────
  // Picked by DataForSEO `hôtel de luxe {ville}` search volume, gate-checked
  // ≥ 4 published hotels each (competitor gap audit 2026-06-23). LieuDefs
  // already exist in axes.ts (intl wave 1).
  {
    slug: 'hotel-de-luxe-new-york',
    titleFr: 'Les meilleurs hôtels de luxe à New York',
    titleEn: 'The best luxury hotels in New York',
    scope: 'ville',
    lieuSlug: 'new-york',
    label: 'New York',
  },
  {
    slug: 'hotel-de-luxe-barcelone',
    titleFr: 'Les meilleurs hôtels de luxe à Barcelone',
    titleEn: 'The best luxury hotels in Barcelona',
    scope: 'ville',
    lieuSlug: 'barcelone',
    label: 'Barcelone',
  },
  {
    slug: 'hotel-de-luxe-londres',
    titleFr: 'Les meilleurs hôtels de luxe à Londres',
    titleEn: 'The best luxury hotels in London',
    scope: 'ville',
    lieuSlug: 'londres',
    label: 'Londres',
  },
  {
    slug: 'hotel-de-luxe-venise',
    titleFr: 'Les meilleurs hôtels de luxe à Venise',
    titleEn: 'The best luxury hotels in Venice',
    scope: 'ville',
    lieuSlug: 'venise',
    label: 'Venise',
  },
  {
    slug: 'hotel-de-luxe-rome',
    titleFr: 'Les meilleurs hôtels de luxe à Rome',
    titleEn: 'The best luxury hotels in Rome',
    scope: 'ville',
    lieuSlug: 'rome',
    label: 'Rome',
  },
  // ── Wave 4 (2026-06-24) — acquisition expansion vs yonder.fr /
  // travellers-society.com. `hôtel de luxe {ville}` head term (10-30× the
  // `meilleurs hôtels {ville}` volume per audit G2) for high-inventory
  // cities both competitors cover and MCH had no `luxe` head for. Each
  // gate-checked ≥ 4 published hotels via the live catalogue (city/country
  // inventory query 2026-06-24). LieuDefs already registered in axes.ts.
  // Differentiated from the parallel `meilleurs-hotels-{ville}` head (a
  // distinct keyword intent, not cannibalisation). Cannes (3 distinct after
  // Carlton/Le Carlton dedup) and Reims (4 with Crayères dedup, thin FR
  // `luxe` volume) deliberately NOT created.
  {
    slug: 'hotel-de-luxe-tokyo',
    titleFr: 'Les meilleurs hôtels de luxe à Tokyo',
    titleEn: 'The best luxury hotels in Tokyo',
    scope: 'ville',
    lieuSlug: 'tokyo',
    label: 'Tokyo',
  },
  {
    slug: 'hotel-de-luxe-istanbul',
    titleFr: 'Les meilleurs hôtels de luxe à Istanbul',
    titleEn: 'The best luxury hotels in Istanbul',
    scope: 'ville',
    lieuSlug: 'istanbul',
    label: 'Istanbul',
  },
  {
    slug: 'hotel-de-luxe-bangkok',
    titleFr: 'Les meilleurs hôtels de luxe à Bangkok',
    titleEn: 'The best luxury hotels in Bangkok',
    scope: 'ville',
    lieuSlug: 'bangkok',
    label: 'Bangkok',
  },
  {
    slug: 'hotel-de-luxe-berlin',
    titleFr: 'Les meilleurs hôtels de luxe à Berlin',
    titleEn: 'The best luxury hotels in Berlin',
    scope: 'ville',
    lieuSlug: 'berlin',
    label: 'Berlin',
  },
  {
    slug: 'hotel-de-luxe-prague',
    titleFr: 'Les meilleurs hôtels de luxe à Prague',
    titleEn: 'The best luxury hotels in Prague',
    scope: 'ville',
    lieuSlug: 'prague',
    label: 'Prague',
  },
  {
    slug: 'hotel-de-luxe-bali',
    titleFr: 'Les meilleurs hôtels de luxe à Bali',
    titleEn: 'The best luxury hotels in Bali',
    scope: 'cluster',
    lieuSlug: 'bali',
    label: 'Bali',
  },
  {
    slug: 'hotel-de-luxe-mykonos',
    titleFr: 'Les meilleurs hôtels de luxe à Mykonos',
    titleEn: 'The best luxury hotels in Mykonos',
    scope: 'ville',
    lieuSlug: 'mykonos',
    label: 'Mykonos',
  },
  {
    slug: 'hotel-de-luxe-santorin',
    titleFr: 'Les meilleurs hôtels de luxe à Santorin',
    titleEn: 'The best luxury hotels in Santorini',
    scope: 'ville',
    lieuSlug: 'santorin',
    label: 'Santorin',
  },
  {
    slug: 'hotel-de-luxe-florence',
    titleFr: 'Les meilleurs hôtels de luxe à Florence',
    titleEn: 'The best luxury hotels in Florence',
    scope: 'ville',
    lieuSlug: 'florence',
    label: 'Florence',
  },
  {
    slug: 'hotel-de-luxe-milan',
    titleFr: 'Les meilleurs hôtels de luxe à Milan',
    titleEn: 'The best luxury hotels in Milan',
    scope: 'ville',
    lieuSlug: 'milan',
    label: 'Milan',
  },
  {
    slug: 'hotel-de-luxe-madrid',
    titleFr: 'Les meilleurs hôtels de luxe à Madrid',
    titleEn: 'The best luxury hotels in Madrid',
    scope: 'ville',
    lieuSlug: 'madrid',
    label: 'Madrid',
  },
  {
    slug: 'hotel-de-luxe-lisbonne',
    titleFr: 'Les meilleurs hôtels de luxe à Lisbonne',
    titleEn: 'The best luxury hotels in Lisbon',
    scope: 'ville',
    lieuSlug: 'lisbonne',
    label: 'Lisbonne',
  },
  {
    slug: 'hotel-de-luxe-vienne',
    titleFr: 'Les meilleurs hôtels de luxe à Vienne',
    titleEn: 'The best luxury hotels in Vienna',
    scope: 'ville',
    lieuSlug: 'vienne',
    label: 'Vienne',
  },
  {
    slug: 'hotel-de-luxe-abu-dhabi',
    titleFr: 'Les meilleurs hôtels de luxe à Abu Dhabi',
    titleEn: 'The best luxury hotels in Abu Dhabi',
    scope: 'ville',
    lieuSlug: 'abu-dhabi',
    label: 'Abu Dhabi',
  },
  {
    slug: 'hotel-de-luxe-doha',
    titleFr: 'Les meilleurs hôtels de luxe à Doha',
    titleEn: 'The best luxury hotels in Doha',
    scope: 'ville',
    lieuSlug: 'doha',
    label: 'Doha',
  },
  {
    slug: 'hotel-de-luxe-kyoto',
    titleFr: 'Les meilleurs hôtels de luxe à Kyoto',
    titleEn: 'The best luxury hotels in Kyoto',
    scope: 'ville',
    lieuSlug: 'kyoto',
    label: 'Kyoto',
  },
  // ── Wave 4 (2026-06-29) — EN-volume luxe heads (en-seo-geo-audit §CT1
  // extension). Picked by DataForSEO `luxury hotels {city}` US volume +
  // gate-checked inventory; each LieuDef already exists in axes.ts and has no
  // pre-existing `hotel-de-luxe-{city}` head. LA: 12 100/mo KD9 (8 hotels);
  // Singapore: 6 600/mo KD8 (10 hotels); Hong Kong: 1 600/mo KD16, best-hotels
  // 1 600 KD3, +646 % YoY (23 hotels).
  {
    slug: 'hotel-de-luxe-los-angeles',
    titleFr: 'Les meilleurs hôtels de luxe à Los Angeles',
    titleEn: 'The best luxury hotels in Los Angeles',
    scope: 'ville',
    lieuSlug: 'los-angeles',
    label: 'Los Angeles',
  },
  {
    slug: 'hotel-de-luxe-singapour',
    titleFr: 'Les meilleurs hôtels de luxe à Singapour',
    titleEn: 'The best luxury hotels in Singapore',
    scope: 'ville',
    lieuSlug: 'singapour',
    label: 'Singapour',
  },
  {
    slug: 'hotel-de-luxe-hong-kong',
    titleFr: 'Les meilleurs hôtels de luxe à Hong Kong',
    titleEn: 'The best luxury hotels in Hong Kong',
    scope: 'ville',
    lieuSlug: 'hong-kong',
    label: 'Hong Kong',
  },
  // ── Wave 5 (2026-06-29) — EN-volume luxe heads, next tier (en-seo-geo-audit
  // broadening). Each gate-checked ≥ 3 published hotels. Amsterdam: luxe
  // 1 900/mo KD24 (12 hotels); Phuket: luxe 720/mo KD1 (7 hotels); Maldives:
  // luxe 480/mo KD2 (34 hotels — pays scope, complements the existing
  // `meilleurs-hotels-maldives` best head). LieuDefs exist in axes.ts.
  {
    slug: 'hotel-de-luxe-amsterdam',
    titleFr: 'Les meilleurs hôtels de luxe à Amsterdam',
    titleEn: 'The best luxury hotels in Amsterdam',
    scope: 'ville',
    lieuSlug: 'amsterdam',
    label: 'Amsterdam',
  },
  {
    slug: 'hotel-de-luxe-phuket',
    titleFr: 'Les meilleurs hôtels de luxe à Phuket',
    titleEn: 'The best luxury hotels in Phuket',
    scope: 'ville',
    lieuSlug: 'phuket',
    label: 'Phuket',
  },
  {
    slug: 'hotel-de-luxe-maldives',
    titleFr: 'Les meilleurs hôtels de luxe aux Maldives',
    titleEn: 'The best luxury hotels in the Maldives',
    scope: 'pays',
    lieuSlug: 'maldives',
    label: 'Maldives',
  },
];
const LUXE_CITY_OVERRIDES: readonly ManualOverride[] = LUXE_CITIES.map((d) => ({
  slug: d.slug,
  titleFr: d.titleFr,
  titleEn: d.titleEn,
  axes: {
    types: ['all'],
    lieu: { scope: d.scope, slug: d.lieuSlug, label: d.label },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  },
  kind: 'geographic',
}));

// ─── 2026-06-22 — International destination head rankings (wave 1) ─────────
// Data-driven `meilleurs-hotels-<dest>` heads for non-FR countries + iconic
// cities carrying ≥ 3 published hotels (see `tmp-intl-coverage.ts`). Each
// references a LieuDef added in axes.ts (country → `countryCodes`, city →
// `hotelCityKeys`). Forced as MANUAL_OVERRIDES so the heads always emit;
// `type×lieu` / `theme×lieu` sub-combos are deferred to a later wave.
const INTL_DESTINATIONS: readonly {
  readonly lieuSlug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly scope: LieuDef['scope'];
  readonly label: string;
}[] = [
  // Countries.
  {
    lieuSlug: 'italie',
    titleFr: "Les meilleurs hôtels d'Italie",
    titleEn: 'The best hotels in Italy',
    scope: 'pays',
    label: 'Italie',
  },
  {
    lieuSlug: 'espagne',
    titleFr: "Les meilleurs hôtels d'Espagne",
    titleEn: 'The best hotels in Spain',
    scope: 'pays',
    label: 'Espagne',
  },
  {
    lieuSlug: 'royaume-uni',
    titleFr: 'Les meilleurs hôtels du Royaume-Uni',
    titleEn: 'The best hotels in the United Kingdom',
    scope: 'pays',
    label: 'Royaume-Uni',
  },
  {
    lieuSlug: 'japon',
    titleFr: 'Les meilleurs hôtels du Japon',
    titleEn: 'The best hotels in Japan',
    scope: 'pays',
    label: 'Japon',
  },
  {
    lieuSlug: 'grece',
    titleFr: 'Les meilleurs hôtels de Grèce',
    titleEn: 'The best hotels in Greece',
    scope: 'pays',
    label: 'Grèce',
  },
  {
    lieuSlug: 'etats-unis',
    titleFr: 'Les meilleurs hôtels des États-Unis',
    titleEn: 'The best hotels in the United States',
    scope: 'pays',
    label: 'États-Unis',
  },
  {
    lieuSlug: 'chine',
    titleFr: 'Les meilleurs hôtels de Chine',
    titleEn: 'The best hotels in China',
    scope: 'pays',
    label: 'Chine',
  },
  {
    lieuSlug: 'thailande',
    titleFr: 'Les meilleurs hôtels de Thaïlande',
    titleEn: 'The best hotels in Thailand',
    scope: 'pays',
    label: 'Thaïlande',
  },
  {
    lieuSlug: 'suisse',
    titleFr: 'Les meilleurs hôtels de Suisse',
    titleEn: 'The best hotels in Switzerland',
    scope: 'pays',
    label: 'Suisse',
  },
  {
    lieuSlug: 'indonesie',
    titleFr: "Les meilleurs hôtels d'Indonésie",
    titleEn: 'The best hotels in Indonesia',
    scope: 'pays',
    label: 'Indonésie',
  },
  {
    lieuSlug: 'maroc',
    titleFr: 'Les meilleurs hôtels du Maroc',
    titleEn: 'The best hotels in Morocco',
    scope: 'pays',
    label: 'Maroc',
  },
  {
    lieuSlug: 'portugal',
    titleFr: 'Les meilleurs hôtels du Portugal',
    titleEn: 'The best hotels in Portugal',
    scope: 'pays',
    label: 'Portugal',
  },
  {
    lieuSlug: 'autriche',
    titleFr: "Les meilleurs hôtels d'Autriche",
    titleEn: 'The best hotels in Austria',
    scope: 'pays',
    label: 'Autriche',
  },
  {
    lieuSlug: 'turquie',
    titleFr: 'Les meilleurs hôtels de Turquie',
    titleEn: 'The best hotels in Turkey',
    scope: 'pays',
    label: 'Turquie',
  },
  {
    lieuSlug: 'allemagne',
    titleFr: "Les meilleurs hôtels d'Allemagne",
    titleEn: 'The best hotels in Germany',
    scope: 'pays',
    label: 'Allemagne',
  },
  {
    lieuSlug: 'maldives',
    titleFr: 'Les meilleurs hôtels des Maldives',
    titleEn: 'The best hotels in the Maldives',
    scope: 'pays',
    label: 'Maldives',
  },
  // Iconic cities.
  {
    lieuSlug: 'londres',
    titleFr: 'Les meilleurs hôtels de Londres',
    titleEn: 'The best hotels in London',
    scope: 'ville',
    label: 'Londres',
  },
  {
    lieuSlug: 'new-york',
    titleFr: 'Les meilleurs hôtels de New York',
    titleEn: 'The best hotels in New York',
    scope: 'ville',
    label: 'New York',
  },
  {
    lieuSlug: 'tokyo',
    titleFr: 'Les meilleurs hôtels de Tokyo',
    titleEn: 'The best hotels in Tokyo',
    scope: 'ville',
    label: 'Tokyo',
  },
  {
    lieuSlug: 'kyoto',
    titleFr: 'Les meilleurs hôtels de Kyoto',
    titleEn: 'The best hotels in Kyoto',
    scope: 'ville',
    label: 'Kyoto',
  },
  {
    lieuSlug: 'istanbul',
    titleFr: "Les meilleurs hôtels d'Istanbul",
    titleEn: 'The best hotels in Istanbul',
    scope: 'ville',
    label: 'Istanbul',
  },
  {
    lieuSlug: 'berlin',
    titleFr: 'Les meilleurs hôtels de Berlin',
    titleEn: 'The best hotels in Berlin',
    scope: 'ville',
    label: 'Berlin',
  },
  {
    lieuSlug: 'hong-kong',
    titleFr: 'Les meilleurs hôtels de Hong Kong',
    titleEn: 'The best hotels in Hong Kong',
    scope: 'ville',
    label: 'Hong Kong',
  },
  {
    lieuSlug: 'shanghai',
    titleFr: 'Les meilleurs hôtels de Shanghai',
    titleEn: 'The best hotels in Shanghai',
    scope: 'ville',
    label: 'Shanghai',
  },
  {
    lieuSlug: 'pekin',
    titleFr: 'Les meilleurs hôtels de Pékin',
    titleEn: 'The best hotels in Beijing',
    scope: 'ville',
    label: 'Pékin',
  },
  {
    lieuSlug: 'barcelone',
    titleFr: 'Les meilleurs hôtels de Barcelone',
    titleEn: 'The best hotels in Barcelona',
    scope: 'ville',
    label: 'Barcelone',
  },
  {
    lieuSlug: 'madrid',
    titleFr: 'Les meilleurs hôtels de Madrid',
    titleEn: 'The best hotels in Madrid',
    scope: 'ville',
    label: 'Madrid',
  },
  {
    lieuSlug: 'bangkok',
    titleFr: 'Les meilleurs hôtels de Bangkok',
    titleEn: 'The best hotels in Bangkok',
    scope: 'ville',
    label: 'Bangkok',
  },
  {
    lieuSlug: 'marrakech',
    titleFr: 'Les meilleurs hôtels de Marrakech',
    titleEn: 'The best hotels in Marrakech',
    scope: 'ville',
    label: 'Marrakech',
  },
  {
    lieuSlug: 'mykonos',
    titleFr: 'Les meilleurs hôtels de Mykonos',
    titleEn: 'The best hotels in Mykonos',
    scope: 'ville',
    label: 'Mykonos',
  },
  {
    lieuSlug: 'santorin',
    titleFr: 'Les meilleurs hôtels de Santorin',
    titleEn: 'The best hotels in Santorini',
    scope: 'ville',
    label: 'Santorin',
  },
  {
    lieuSlug: 'florence',
    titleFr: 'Les meilleurs hôtels de Florence',
    titleEn: 'The best hotels in Florence',
    scope: 'ville',
    label: 'Florence',
  },
  {
    lieuSlug: 'milan',
    titleFr: 'Les meilleurs hôtels de Milan',
    titleEn: 'The best hotels in Milan',
    scope: 'ville',
    label: 'Milan',
  },
  {
    lieuSlug: 'bali',
    titleFr: 'Les meilleurs hôtels de Bali',
    titleEn: 'The best hotels in Bali',
    scope: 'cluster',
    label: 'Bali',
  },
  {
    lieuSlug: 'dubai',
    titleFr: 'Les meilleurs hôtels de Dubaï',
    titleEn: 'The best hotels in Dubai',
    scope: 'ville',
    label: 'Dubaï',
  },
  {
    lieuSlug: 'abu-dhabi',
    titleFr: "Les meilleurs hôtels d'Abu Dhabi",
    titleEn: 'The best hotels in Abu Dhabi',
    scope: 'ville',
    label: 'Abu Dhabi',
  },
  {
    lieuSlug: 'doha',
    titleFr: 'Les meilleurs hôtels de Doha',
    titleEn: 'The best hotels in Doha',
    scope: 'ville',
    label: 'Doha',
  },
  {
    lieuSlug: 'budapest',
    titleFr: 'Les meilleurs hôtels de Budapest',
    titleEn: 'The best hotels in Budapest',
    scope: 'ville',
    label: 'Budapest',
  },
  {
    lieuSlug: 'singapour',
    titleFr: 'Les meilleurs hôtels de Singapour',
    titleEn: 'The best hotels in Singapore',
    scope: 'ville',
    label: 'Singapour',
  },
];
const INTL_DESTINATION_OVERRIDES: readonly ManualOverride[] = INTL_DESTINATIONS.map((d) => ({
  slug: `meilleurs-hotels-${d.lieuSlug}`,
  titleFr: d.titleFr,
  titleEn: d.titleEn,
  axes: {
    types: ['all'],
    lieu: { scope: d.scope, slug: d.lieuSlug, label: d.label },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  },
  kind: 'geographic',
}));

// ─── 2026-06-23 — Competitive gap destinations (wave 3) ───────────────────
// Secondary geography both travellers-society.com and yonder.fr cover and we
// did not (`docs/audits/competitor-travellers-yonder-audit-2026-06-23.md`).
// Each references a LieuDef added in axes.ts pinned by `countryCodes` (+ city
// keys for region/city scope so a homonym in another country is excluded).
// All ≥ 4 published hotels per the catalogue snapshot. `meilleurs-hotels-*`
// phrasing, consistent with the 39 intl heads already shipped.
const GAP_DESTINATIONS: readonly {
  readonly lieuSlug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly scope: LieuDef['scope'];
  readonly label: string;
}[] = [
  {
    lieuSlug: 'vienne',
    titleFr: 'Les meilleurs hôtels de Vienne',
    titleEn: 'The best hotels in Vienna',
    scope: 'ville',
    label: 'Vienne',
  },
  // ── EN-volume best-hotels heads, next tier (2026-06-29 broadening wave).
  // Amsterdam: best 3 600/mo (12 hotels); Phuket: best 1 600/mo (7 hotels).
  {
    lieuSlug: 'amsterdam',
    titleFr: "Les meilleurs hôtels d'Amsterdam",
    titleEn: 'The best hotels in Amsterdam',
    scope: 'ville',
    label: 'Amsterdam',
  },
  {
    lieuSlug: 'phuket',
    titleFr: 'Les meilleurs hôtels de Phuket',
    titleEn: 'The best hotels in Phuket',
    scope: 'ville',
    label: 'Phuket',
  },
  {
    lieuSlug: 'crete',
    titleFr: 'Les meilleurs hôtels de Crète',
    titleEn: 'The best hotels in Crete',
    scope: 'region',
    label: 'Crète',
  },
  {
    lieuSlug: 'rajasthan',
    titleFr: 'Les meilleurs hôtels du Rajasthan',
    titleEn: 'The best hotels in Rajasthan',
    scope: 'region',
    label: 'Rajasthan',
  },
  {
    lieuSlug: 'seychelles',
    titleFr: 'Les meilleurs hôtels des Seychelles',
    titleEn: 'The best hotels in the Seychelles',
    scope: 'pays',
    label: 'Seychelles',
  },
  {
    lieuSlug: 'geneve',
    titleFr: 'Les meilleurs hôtels de Genève',
    titleEn: 'The best hotels in Geneva',
    scope: 'ville',
    label: 'Genève',
  },
  {
    lieuSlug: 'lisbonne',
    titleFr: 'Les meilleurs hôtels de Lisbonne',
    titleEn: 'The best hotels in Lisbon',
    scope: 'ville',
    label: 'Lisbonne',
  },
  {
    lieuSlug: 'los-angeles',
    titleFr: 'Les meilleurs hôtels de Los Angeles',
    titleEn: 'The best hotels in Los Angeles',
    scope: 'ville',
    label: 'Los Angeles',
  },
  {
    lieuSlug: 'ile-maurice',
    titleFr: "Les meilleurs hôtels de l'île Maurice",
    titleEn: 'The best hotels in Mauritius',
    scope: 'pays',
    label: 'Île Maurice',
  },
  {
    lieuSlug: 'majorque',
    titleFr: 'Les meilleurs hôtels de Majorque',
    titleEn: 'The best hotels in Mallorca',
    scope: 'region',
    label: 'Majorque',
  },
  {
    lieuSlug: 'ibiza',
    titleFr: "Les meilleurs hôtels d'Ibiza",
    titleEn: 'The best hotels in Ibiza',
    scope: 'region',
    label: 'Ibiza',
  },
  {
    lieuSlug: 'saint-barthelemy',
    titleFr: 'Les meilleurs hôtels de Saint-Barthélemy',
    titleEn: 'The best hotels in Saint Barthélemy',
    scope: 'pays',
    label: 'Saint-Barthélemy',
  },
  {
    lieuSlug: 'sicile',
    titleFr: 'Les meilleurs hôtels de Sicile',
    titleEn: 'The best hotels in Sicily',
    scope: 'region',
    label: 'Sicile',
  },
];
const GAP_DESTINATION_OVERRIDES: readonly ManualOverride[] = GAP_DESTINATIONS.map((d) => ({
  slug: `meilleurs-hotels-${d.lieuSlug}`,
  titleFr: d.titleFr,
  titleEn: d.titleEn,
  axes: {
    types: ['all'],
    lieu: { scope: d.scope, slug: d.lieuSlug, label: d.label },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  },
  kind: 'geographic',
}));

// ─── 2026-06-29 — Maillage coverage wave (audit of the 1005 fiches in zero
// ranking) ─────────────────────────────────────────────────────────────────
// Country heads for every country carrying ≥ 5 published hotels but no
// geographic head ranking, plus French city/station heads with ≥ 4 published
// hotels and no existing head. Each references a LieuDef added in axes.ts
// (country gate via `countryCodes`; FR cities pinned `countryCodes: ['FR']` +
// `hotelCityKeys` so a homonym abroad never leaks in). `meilleurs-hotels-*`
// phrasing, consistent with the 39 intl heads + gap destinations already
// shipped. Eligibility is re-checked by `eligibilityFor` (re-resolves the
// lieu by slug) and the MIN_ELIGIBLE=3 floor in `buildMatrix` drops any that
// fall short — thin/sub-floor entities are never emitted.
const COVERAGE_WAVE_DESTINATIONS: readonly {
  readonly lieuSlug: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly scope: LieuDef['scope'];
  readonly label: string;
}[] = [
  // Country heads.
  {
    lieuSlug: 'canada',
    titleFr: 'Les meilleurs hôtels du Canada',
    titleEn: 'The best hotels in Canada',
    scope: 'pays',
    label: 'Canada',
  },
  {
    lieuSlug: 'afrique-du-sud',
    titleFr: "Les meilleurs hôtels d'Afrique du Sud",
    titleEn: 'The best hotels in South Africa',
    scope: 'pays',
    label: 'Afrique du Sud',
  },
  {
    lieuSlug: 'arabie-saoudite',
    titleFr: "Les meilleurs hôtels d'Arabie saoudite",
    titleEn: 'The best hotels in Saudi Arabia',
    scope: 'pays',
    label: 'Arabie saoudite',
  },
  {
    lieuSlug: 'belgique',
    titleFr: 'Les meilleurs hôtels de Belgique',
    titleEn: 'The best hotels in Belgium',
    scope: 'pays',
    label: 'Belgique',
  },
  {
    lieuSlug: 'pays-bas',
    titleFr: 'Les meilleurs hôtels des Pays-Bas',
    titleEn: 'The best hotels in the Netherlands',
    scope: 'pays',
    label: 'Pays-Bas',
  },
  {
    lieuSlug: 'vietnam',
    titleFr: 'Les meilleurs hôtels du Vietnam',
    titleEn: 'The best hotels in Vietnam',
    scope: 'pays',
    label: 'Vietnam',
  },
  {
    lieuSlug: 'malaisie',
    titleFr: 'Les meilleurs hôtels de Malaisie',
    titleEn: 'The best hotels in Malaysia',
    scope: 'pays',
    label: 'Malaisie',
  },
  {
    lieuSlug: 'chili',
    titleFr: 'Les meilleurs hôtels du Chili',
    titleEn: 'The best hotels in Chile',
    scope: 'pays',
    label: 'Chili',
  },
  {
    lieuSlug: 'argentine',
    titleFr: "Les meilleurs hôtels d'Argentine",
    titleEn: 'The best hotels in Argentina',
    scope: 'pays',
    label: 'Argentine',
  },
  {
    lieuSlug: 'egypte',
    titleFr: "Les meilleurs hôtels d'Égypte",
    titleEn: 'The best hotels in Egypt',
    scope: 'pays',
    label: 'Égypte',
  },
  {
    lieuSlug: 'irlande',
    titleFr: "Les meilleurs hôtels d'Irlande",
    titleEn: 'The best hotels in Ireland',
    scope: 'pays',
    label: 'Irlande',
  },
  {
    lieuSlug: 'costa-rica',
    titleFr: 'Les meilleurs hôtels du Costa Rica',
    titleEn: 'The best hotels in Costa Rica',
    scope: 'pays',
    label: 'Costa Rica',
  },
  {
    lieuSlug: 'kenya',
    titleFr: 'Les meilleurs hôtels du Kenya',
    titleEn: 'The best hotels in Kenya',
    scope: 'pays',
    label: 'Kenya',
  },
  {
    lieuSlug: 'perou',
    titleFr: 'Les meilleurs hôtels du Pérou',
    titleEn: 'The best hotels in Peru',
    scope: 'pays',
    label: 'Pérou',
  },
  {
    lieuSlug: 'bresil',
    titleFr: 'Les meilleurs hôtels du Brésil',
    titleEn: 'The best hotels in Brazil',
    scope: 'pays',
    label: 'Brésil',
  },
  {
    lieuSlug: 'nouvelle-zelande',
    titleFr: 'Les meilleurs hôtels de Nouvelle-Zélande',
    titleEn: 'The best hotels in New Zealand',
    scope: 'pays',
    label: 'Nouvelle-Zélande',
  },
  {
    lieuSlug: 'suede',
    titleFr: 'Les meilleurs hôtels de Suède',
    titleEn: 'The best hotels in Sweden',
    scope: 'pays',
    label: 'Suède',
  },
  {
    lieuSlug: 'qatar',
    titleFr: 'Les meilleurs hôtels du Qatar',
    titleEn: 'The best hotels in Qatar',
    scope: 'pays',
    label: 'Qatar',
  },
  {
    lieuSlug: 'andorre',
    titleFr: "Les meilleurs hôtels d'Andorre",
    titleEn: 'The best hotels in Andorra',
    scope: 'pays',
    label: 'Andorre',
  },
  {
    lieuSlug: 'colombie',
    titleFr: 'Les meilleurs hôtels de Colombie',
    titleEn: 'The best hotels in Colombia',
    scope: 'pays',
    label: 'Colombie',
  },
  {
    lieuSlug: 'luxembourg',
    titleFr: 'Les meilleurs hôtels du Luxembourg',
    titleEn: 'The best hotels in Luxembourg',
    scope: 'pays',
    label: 'Luxembourg',
  },
  {
    lieuSlug: 'bhoutan',
    titleFr: 'Les meilleurs hôtels du Bhoutan',
    titleEn: 'The best hotels in Bhutan',
    scope: 'pays',
    label: 'Bhoutan',
  },
  {
    lieuSlug: 'croatie',
    titleFr: 'Les meilleurs hôtels de Croatie',
    titleEn: 'The best hotels in Croatia',
    scope: 'pays',
    label: 'Croatie',
  },
  {
    lieuSlug: 'oman',
    titleFr: "Les meilleurs hôtels d'Oman",
    titleEn: 'The best hotels in Oman',
    scope: 'pays',
    label: 'Oman',
  },
  {
    lieuSlug: 'danemark',
    titleFr: 'Les meilleurs hôtels du Danemark',
    titleEn: 'The best hotels in Denmark',
    scope: 'pays',
    label: 'Danemark',
  },
  {
    lieuSlug: 'albanie',
    titleFr: "Les meilleurs hôtels d'Albanie",
    titleEn: 'The best hotels in Albania',
    scope: 'pays',
    label: 'Albanie',
  },
  {
    lieuSlug: 'jordanie',
    titleFr: 'Les meilleurs hôtels de Jordanie',
    titleEn: 'The best hotels in Jordan',
    scope: 'pays',
    label: 'Jordanie',
  },
  {
    lieuSlug: 'coree-du-sud',
    titleFr: 'Les meilleurs hôtels de Corée du Sud',
    titleEn: 'The best hotels in South Korea',
    scope: 'pays',
    label: 'Corée du Sud',
  },
  {
    lieuSlug: 'sri-lanka',
    titleFr: 'Les meilleurs hôtels du Sri Lanka',
    titleEn: 'The best hotels in Sri Lanka',
    scope: 'pays',
    label: 'Sri Lanka',
  },
  {
    lieuSlug: 'philippines',
    titleFr: 'Les meilleurs hôtels des Philippines',
    titleEn: 'The best hotels in the Philippines',
    scope: 'pays',
    label: 'Philippines',
  },
  {
    lieuSlug: 'republique-dominicaine',
    titleFr: 'Les meilleurs hôtels de République dominicaine',
    titleEn: 'The best hotels in the Dominican Republic',
    scope: 'pays',
    label: 'République dominicaine',
  },
  {
    lieuSlug: 'cambodge',
    titleFr: 'Les meilleurs hôtels du Cambodge',
    titleEn: 'The best hotels in Cambodia',
    scope: 'pays',
    label: 'Cambodge',
  },
  {
    lieuSlug: 'polynesie-francaise',
    titleFr: 'Les meilleurs hôtels de Polynésie française',
    titleEn: 'The best hotels in French Polynesia',
    scope: 'pays',
    label: 'Polynésie française',
  },
  {
    lieuSlug: 'israel',
    titleFr: "Les meilleurs hôtels d'Israël",
    titleEn: 'The best hotels in Israel',
    scope: 'pays',
    label: 'Israël',
  },
  {
    lieuSlug: 'norvege',
    titleFr: 'Les meilleurs hôtels de Norvège',
    titleEn: 'The best hotels in Norway',
    scope: 'pays',
    label: 'Norvège',
  },
  {
    lieuSlug: 'tanzanie',
    titleFr: 'Les meilleurs hôtels de Tanzanie',
    titleEn: 'The best hotels in Tanzania',
    scope: 'pays',
    label: 'Tanzanie',
  },
  {
    lieuSlug: 'rwanda',
    titleFr: 'Les meilleurs hôtels du Rwanda',
    titleEn: 'The best hotels in Rwanda',
    scope: 'pays',
    label: 'Rwanda',
  },
  {
    lieuSlug: 'taiwan',
    titleFr: 'Les meilleurs hôtels de Taïwan',
    titleEn: 'The best hotels in Taiwan',
    scope: 'pays',
    label: 'Taïwan',
  },
  // French city / station heads.
  {
    lieuSlug: 'lille',
    titleFr: 'Les meilleurs hôtels de Lille',
    titleEn: 'The best hotels in Lille',
    scope: 'ville',
    label: 'Lille',
  },
  {
    lieuSlug: 'honfleur',
    titleFr: 'Les meilleurs hôtels de Honfleur',
    titleEn: 'The best hotels in Honfleur',
    scope: 'ville',
    label: 'Honfleur',
  },
  {
    lieuSlug: 'marseille',
    titleFr: 'Les meilleurs hôtels de Marseille',
    titleEn: 'The best hotels in Marseille',
    scope: 'ville',
    label: 'Marseille',
  },
  {
    lieuSlug: 'la-baule',
    titleFr: 'Les meilleurs hôtels de La Baule',
    titleEn: 'The best hotels in La Baule',
    scope: 'ville',
    label: 'La Baule',
  },
  {
    lieuSlug: 'val-thorens',
    titleFr: 'Les meilleurs hôtels de Val Thorens',
    titleEn: 'The best hotels in Val Thorens',
    scope: 'station',
    label: 'Val Thorens',
  },
  {
    lieuSlug: 'tignes',
    titleFr: 'Les meilleurs hôtels de Tignes',
    titleEn: 'The best hotels in Tignes',
    scope: 'station',
    label: 'Tignes',
  },
  {
    lieuSlug: 'hyeres',
    titleFr: "Les meilleurs hôtels d'Hyères",
    titleEn: 'The best hotels in Hyères',
    scope: 'ville',
    label: 'Hyères',
  },
  {
    lieuSlug: 'avignon',
    titleFr: "Les meilleurs hôtels d'Avignon",
    titleEn: 'The best hotels in Avignon',
    scope: 'ville',
    label: 'Avignon',
  },
];

const COVERAGE_WAVE_OVERRIDES: readonly ManualOverride[] = COVERAGE_WAVE_DESTINATIONS.map((d) => ({
  slug: `meilleurs-hotels-${d.lieuSlug}`,
  titleFr: d.titleFr,
  titleEn: d.titleEn,
  axes: {
    types: ['all'],
    lieu: { scope: d.scope, slug: d.lieuSlug, label: d.label },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  },
  kind: 'geographic',
}));

// ─── 2026-06-22 — G5 absurd theme×lieu combos (audit §G5) ─────────────────
// The auto matrix emits semantically impossible pages (no mountains / ski /
// seaside / vineyards inside Paris). The live rows were unpublished
// 2026-06-22 (backup in `runs/`); blocklisted here so a future bulk run
// never regenerates them. Applied as a final filter in `buildMatrix`.
const SLUG_BLOCKLIST: ReadonlySet<string> = new Set<string>([
  'meilleurs-hotels-vignobles-paris',
  'meilleurs-hotels-montagne-paris',
  'meilleurs-hotels-ski-paris',
  'meilleurs-hotels-bord-de-mer-paris',
  'meilleurs-hotels-montagne-paris-1',
  'meilleurs-hotels-bord-de-mer-paris-8',
]);

const MANUAL_OVERRIDES: readonly ManualOverride[] = [
  ...LUXE_CITY_OVERRIDES,
  // 2026-06-22 — international destination head rankings (wave 1).
  ...INTL_DESTINATION_OVERRIDES,
  // 2026-06-23 — competitive gap destinations (wave 3).
  ...GAP_DESTINATION_OVERRIDES,
  // 2026-06-29 — maillage coverage wave (country + FR city/station heads).
  ...COVERAGE_WAVE_OVERRIDES,
  // Pillar national rankings — high volume search.
  {
    slug: 'meilleurs-palaces-france',
    titleFr: 'Les meilleurs Palaces de France',
    titleEn: 'The best Palaces in France',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
  },
  {
    slug: 'plus-beaux-hotels-5-etoiles-france',
    titleFr: 'Les plus beaux hôtels 5 étoiles de France',
    titleEn: 'The most beautiful 5-star hotels in France',
    axes: {
      types: ['5-etoiles'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
  },
  {
    slug: 'plus-beaux-hotels-france',
    titleFr: 'Les 30 plus beaux hôtels de France',
    titleEn: 'The 30 most beautiful hotels in France',
    axes: {
      types: ['all'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
  },

  // Pillar Paris.
  {
    slug: 'meilleurs-palaces-paris',
    titleFr: 'Les meilleurs Palaces de Paris',
    titleEn: 'The best Palaces in Paris',
    axes: {
      types: ['palace'],
      lieu: { scope: 'ville', slug: 'paris', label: 'Paris' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
  },

  // Pillar Côte d'Azur / Riviera.
  {
    slug: 'meilleurs-palaces-cote-d-azur',
    titleFr: "Les meilleurs Palaces de la Côte d'Azur",
    titleEn: 'The best Palaces on the French Riviera',
    axes: {
      types: ['palace'],
      lieu: { scope: 'cluster', slug: 'cote-d-azur', label: "Côte d'Azur" },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
  },

  // Alpes / ski.
  {
    slug: 'meilleurs-palaces-alpes',
    titleFr: 'Les plus beaux Palaces des Alpes',
    titleEn: 'The most beautiful Palaces in the French Alps',
    axes: {
      types: ['palace'],
      lieu: { scope: 'cluster', slug: 'alpes', label: 'Alpes' },
      themes: ['montagne', 'sport-ski'],
      occasions: [],
      saison: 'hiver',
    },
  },
  {
    slug: 'plus-beaux-hotels-courchevel',
    titleFr: 'Les plus beaux hôtels de Courchevel',
    titleEn: 'The most beautiful hotels in Courchevel',
    axes: {
      types: ['all'],
      lieu: { scope: 'station', slug: 'courchevel', label: 'Courchevel' },
      themes: [],
      occasions: [],
      saison: 'hiver',
    },
  },

  // Thematic high-volume.
  {
    slug: 'palaces-spa-bien-etre',
    titleFr: 'Les Palaces avec spa pour une retraite bien-être',
    titleEn: 'Palaces with spa for a wellness retreat',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['spa-bienetre'],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'thematic',
  },
  {
    slug: 'palaces-romantiques-france',
    titleFr: 'Les Palaces les plus romantiques de France',
    titleEn: 'The most romantic Palaces in France',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['romantique'],
      occasions: ['lune-de-miel'],
      saison: 'toute-annee',
    },
    kind: 'thematic',
  },
  {
    slug: 'palaces-gastronomie-michelin',
    titleFr: 'Les Palaces de France avec les plus belles tables gastronomiques',
    titleEn: 'The finest gastronomic Palaces in France',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['gastronomie'],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'awarded',
  },
  {
    slug: 'palaces-bord-de-mer',
    titleFr: 'Les plus beaux Palaces en bord de mer',
    titleEn: 'The most beautiful seaside Palaces',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['mer'],
      occasions: [],
      saison: 'ete',
    },
    kind: 'thematic',
  },
  {
    slug: 'palaces-vignobles',
    titleFr: 'Les plus beaux Palaces et Resorts au cœur des vignobles',
    titleEn: 'The most beautiful Palaces and Resorts in the vineyards',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['vignobles'],
      occasions: [],
      saison: 'automne',
    },
    kind: 'thematic',
  },
  {
    slug: 'palaces-familles',
    titleFr: 'Les Palaces les plus adaptés aux familles',
    titleEn: 'The best Palaces for families',
    axes: {
      types: ['palace'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: ['famille'],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'thematic',
  },

  // ─── 2026-05-31 — Back-fill of international + sub-Paris scaffold
  // rankings whose draft rows pre-existed in Supabase but whose slugs
  // were absent from the auto matrix. Each entry pins the canonical
  // slug + the axes the LLM should reason about. Country-scope axes
  // rely on `countryCodes` in `axes.ts`. City-scope and arrondissement
  // axes use the existing LieuDef registered in `axes.ts`.

  // Geographic — cities outside France.
  {
    slug: 'meilleurs-hotels-rome',
    titleFr: 'Les meilleurs hôtels de Rome',
    titleEn: 'The best hotels in Rome',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'rome', label: 'Rome' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-venise',
    titleFr: 'Les meilleurs hôtels de Venise',
    titleEn: 'The best hotels in Venice',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'venise', label: 'Venise' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-prague',
    titleFr: 'Les meilleurs hôtels de Prague',
    titleEn: 'The best hotels in Prague',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'prague', label: 'Prague' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // Geographic — countries.
  {
    slug: 'meilleurs-hotels-mexique',
    titleFr: 'Les meilleurs hôtels du Mexique',
    titleEn: 'The best hotels in Mexico',
    axes: {
      types: ['all'],
      lieu: { scope: 'pays', slug: 'mexique', label: 'Mexique' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-emirats-arabes-unis',
    titleFr: 'Les meilleurs hôtels des Émirats arabes unis',
    titleEn: 'The best hotels in the United Arab Emirates',
    axes: {
      types: ['all'],
      lieu: { scope: 'pays', slug: 'emirats-arabes-unis', label: 'Émirats arabes unis' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // Geographic — French cities not yet covered.
  {
    slug: 'meilleurs-hotels-reims',
    titleFr: 'Les meilleurs hôtels de Reims',
    titleEn: 'The best hotels in Reims',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'reims', label: 'Reims' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // Geographic — Paris quartier (Marais maps to 75003 + 75004).
  {
    slug: 'meilleurs-hotels-marais',
    titleFr: 'Les meilleurs hôtels du Marais (Paris)',
    titleEn: 'The best hotels in Le Marais (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'marais', label: 'Le Marais (Paris)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // ─── 2026-06-01 — Bridge of 28 published-but-empty scaffold slugs.
  // These generic `meilleurs-hotels-<lieu>` (type=all, no theme) pages
  // existed in Supabase as published rows with ZERO entries because the
  // auto matrix skips `type=all` and never emits the bare-lieu form.
  // Pinning them as MANUAL_OVERRIDES (slug verbatim + existing LieuDef)
  // lets the bulk runner generate real entries against the 2219-hotel
  // catalogue. Eligibility relies on the LieuDef already registered in
  // `axes.ts` (cities, clusters, Paris arrondissements with postal_code
  // prefixes). Slugs with < MIN_ELIGIBLE hotels stay underfilled and are
  // unpublished separately rather than generated empty.

  // Generic city / region / cluster rankings (all stars, no theme).
  {
    slug: 'meilleurs-hotels-nice',
    titleFr: 'Les meilleurs hôtels de Nice',
    titleEn: 'The best hotels in Nice',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'nice', label: 'Nice' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-lyon',
    titleFr: 'Les meilleurs hôtels de Lyon',
    titleEn: 'The best hotels in Lyon',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'lyon', label: 'Lyon' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-bordeaux',
    titleFr: 'Les meilleurs hôtels de Bordeaux',
    titleEn: 'The best hotels in Bordeaux',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'bordeaux', label: 'Bordeaux' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-dijon',
    titleFr: 'Les meilleurs hôtels de Dijon',
    titleEn: 'The best hotels in Dijon',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'dijon', label: 'Dijon' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-colmar',
    titleFr: 'Les meilleurs hôtels de Colmar',
    titleEn: 'The best hotels in Colmar',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'colmar', label: 'Colmar' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-provence',
    titleFr: 'Les meilleurs hôtels de Provence',
    titleEn: 'The best hotels in Provence',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'provence', label: 'Provence' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-champagne',
    titleFr: 'Les meilleurs hôtels en Champagne',
    titleEn: 'The best hotels in Champagne',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'champagne', label: 'Champagne' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-sologne',
    titleFr: 'Les meilleurs hôtels de Sologne',
    titleEn: 'The best hotels in Sologne',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'sologne', label: 'Sologne' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-alpilles',
    titleFr: 'Les meilleurs hôtels des Alpilles',
    titleEn: 'The best hotels in the Alpilles',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'alpilles', label: 'Alpilles' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-ile-de-france',
    titleFr: "Les meilleurs hôtels d'Île-de-France",
    titleEn: 'The best hotels in Île-de-France',
    axes: {
      types: ['all'],
      lieu: { scope: 'region', slug: 'ile-de-france', label: 'Île-de-France' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-cote-atlantique',
    titleFr: 'Les meilleurs hôtels de la Côte Atlantique',
    titleEn: 'The best hotels on the Atlantic Coast',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'cote-atlantique', label: 'Côte Atlantique' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-chantilly',
    titleFr: 'Les meilleurs hôtels de Chantilly',
    titleEn: 'The best hotels in Chantilly',
    axes: {
      types: ['all'],
      lieu: { scope: 'ville', slug: 'chantilly', label: 'Chantilly' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-lac-leman',
    titleFr: 'Les meilleurs hôtels du Lac Léman',
    titleEn: 'The best hotels on Lake Geneva',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'lac-leman', label: 'Lac Léman' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-sud-ouest',
    titleFr: 'Les meilleurs hôtels du Sud-Ouest',
    titleEn: 'The best hotels in South-West France',
    axes: {
      types: ['all'],
      lieu: { scope: 'cluster', slug: 'sud-ouest', label: 'Sud-Ouest' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // Paris named quartiers (all stars, eligibility via postal_code).
  {
    slug: 'meilleurs-hotels-tour-eiffel',
    titleFr: 'Les meilleurs hôtels près de la Tour Eiffel (Paris)',
    titleEn: 'The best hotels near the Eiffel Tower (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'tour-eiffel', label: 'Tour Eiffel (Paris 7e)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-bastille',
    titleFr: 'Les meilleurs hôtels du quartier Bastille (Paris)',
    titleEn: 'The best hotels around Bastille (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'bastille', label: 'Bastille (Paris 11e–12e)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-bercy',
    titleFr: 'Les meilleurs hôtels de Bercy (Paris)',
    titleEn: 'The best hotels in Bercy (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'bercy', label: 'Bercy (Paris 12e)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-gare-de-lyon',
    titleFr: 'Les meilleurs hôtels près de la Gare de Lyon (Paris)',
    titleEn: 'The best hotels near Gare de Lyon (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'gare-de-lyon', label: 'Gare de Lyon (Paris 12e)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-montmartre',
    titleFr: 'Les meilleurs hôtels de Montmartre (Paris)',
    titleEn: 'The best hotels in Montmartre (Paris)',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'montmartre', label: 'Montmartre (Paris 18e)' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // Paris arrondissements (generic, all stars).
  {
    slug: 'meilleurs-hotels-paris-2',
    titleFr: 'Les meilleurs hôtels du 2e arrondissement de Paris',
    titleEn: 'The best hotels in the 2nd arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-2', label: 'Paris 2e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-5',
    titleFr: 'Les meilleurs hôtels du 5e arrondissement de Paris',
    titleEn: 'The best hotels in the 5th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-5', label: 'Paris 5e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-12',
    titleFr: 'Les meilleurs hôtels du 12e arrondissement de Paris',
    titleEn: 'The best hotels in the 12th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-12', label: 'Paris 12e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-13',
    titleFr: 'Les meilleurs hôtels du 13e arrondissement de Paris',
    titleEn: 'The best hotels in the 13th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-13', label: 'Paris 13e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-15',
    titleFr: 'Les meilleurs hôtels du 15e arrondissement de Paris',
    titleEn: 'The best hotels in the 15th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-15', label: 'Paris 15e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-16',
    titleFr: 'Les meilleurs hôtels du 16e arrondissement de Paris',
    titleEn: 'The best hotels in the 16th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-16', label: 'Paris 16e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-17',
    titleFr: 'Les meilleurs hôtels du 17e arrondissement de Paris',
    titleEn: 'The best hotels in the 17th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-17', label: 'Paris 17e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },
  {
    slug: 'meilleurs-hotels-paris-18',
    titleFr: 'Les meilleurs hôtels du 18e arrondissement de Paris',
    titleEn: 'The best hotels in the 18th arrondissement of Paris',
    axes: {
      types: ['all'],
      lieu: { scope: 'arrondissement', slug: 'paris-18', label: 'Paris 18e' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'geographic',
  },

  // National 4-star pillar.
  {
    slug: 'meilleurs-hotels-4-etoiles-france',
    titleFr: 'Les meilleurs hôtels 4 étoiles de France',
    titleEn: 'The best 4-star hotels in France',
    axes: {
      types: ['4-etoiles'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: [],
      occasions: [],
      saison: 'toute-annee',
    },
    kind: 'best_of',
  },
];

// ─── Combinator entry point ──────────────────────────────────────────────

export interface BuildMatrixOptions {
  /** Hotels catalog (output of list-hotels-for-rankings.ts). */
  readonly catalog: ReadonlyArray<HotelCatalogRow>;
  /** Classified yonder Tops (output of classify-yonder-axes.ts). */
  readonly yonderClassified: ReadonlyArray<{
    readonly slug: string;
    readonly title: string;
    readonly axes: RankingAxes;
    readonly lieuResolved: boolean;
  }>;
  /**
   * Classified yonder *scaffold* plans (output of
   * classify-scaffold-axes.ts). These mirror Yonder URLs we scaffolded
   * directly into Supabase: the original Yonder slug becomes the
   * canonical matrice slug (via `slugOverride`), so the bulk runner
   * picks them up without remapping. See ADR-rankings-axes / A2
   * (May 19, 2026).
   */
  readonly yonderScaffoldClassified?: ReadonlyArray<{
    readonly slug: string;
    readonly titleFr: string;
    readonly titleEn: string;
    readonly axes: RankingAxes;
    readonly kind?: MatrixSeed['kind'];
  }>;
  /** When false, emit even seeds with < MIN_ELIGIBLE candidates (for QA). */
  readonly skipUnderfilled?: boolean;
}

export interface BuildMatrixResult {
  readonly seeds: readonly MatrixSeed[];
  readonly stats: {
    readonly totalCandidates: number;
    readonly emittedSeeds: number;
    readonly droppedUnderfilled: number;
    readonly bySource: Readonly<Record<MatrixSource, number>>;
    readonly byTemplate: Readonly<Record<string, number>>;
  };
}

export function buildMatrix(options: BuildMatrixOptions): BuildMatrixResult {
  const {
    catalog,
    yonderClassified,
    yonderScaffoldClassified = [],
    skipUnderfilled = false,
  } = options;
  const seedsBySlug = new Map<string, MatrixSeed>();
  let droppedUnderfilled = 0;
  let totalCandidates = 0;

  // 1. Manual overrides — highest priority. Always emitted (even
  //    when underfilled) because they're flagship pages we need.
  for (const m of MANUAL_OVERRIDES) {
    totalCandidates += 1;
    const eligibilityFilter: EligibilityFilter | undefined =
      m.luxuryTiers !== undefined || m.affiliationFacets !== undefined
        ? {
            ...(m.luxuryTiers !== undefined ? { luxuryTiers: m.luxuryTiers } : {}),
            ...(m.affiliationFacets !== undefined
              ? { affiliationFacets: m.affiliationFacets }
              : {}),
          }
        : undefined;
    const seed = buildSeed({
      axes: m.axes,
      source: 'manual',
      catalog,
      slugOverride: m.slug,
      titleFrOverride: m.titleFr,
      titleEnOverride: m.titleEn,
      eligibilityFilter,
    });
    if (seed === null) continue;
    const final: MatrixSeed = m.kind ? { ...seed, kind: m.kind } : seed;
    seedsBySlug.set(m.slug, final);
  }

  // 2. Yonder scaffold mirrors — these are URL-canonical Yonder slugs
  //    we want to ship as-is (already scaffolded into Supabase). The
  //    slug always overrides the template render, so the bulk runner
  //    picks them up with their original URL. See A2 (May 19, 2026).
  for (const y of yonderScaffoldClassified) {
    totalCandidates += 1;
    const seed = buildSeed({
      axes: y.axes,
      source: 'yonder',
      catalog,
      slugOverride: y.slug,
      titleFrOverride: y.titleFr,
      titleEnOverride: y.titleEn,
      yonderSlug: y.slug,
      yonderTitle: y.titleFr,
    });
    if (seed === null) continue;
    if (seedsBySlug.has(y.slug)) continue; // manual already won
    if (skipUnderfilled && !seed.hasEnoughCandidates) {
      droppedUnderfilled += 1;
      continue;
    }
    const final: MatrixSeed = y.kind ? { ...seed, kind: y.kind } : seed;
    seedsBySlug.set(y.slug, final);
  }

  // 3. Yonder mirrors — only when the lieu was resolved (otherwise
  //    we cannot map to our hotels DB) and the template renders.
  for (const y of yonderClassified) {
    if (!y.lieuResolved) continue;
    totalCandidates += 1;
    const seed = buildSeed({
      axes: y.axes,
      source: 'yonder',
      catalog,
      yonderSlug: y.slug,
      yonderTitle: y.title,
    });
    if (seed === null) continue;
    if (seedsBySlug.has(seed.slug)) continue; // manual / scaffold already won
    if (skipUnderfilled && !seed.hasEnoughCandidates) {
      droppedUnderfilled += 1;
      continue;
    }
    seedsBySlug.set(seed.slug, seed);
  }

  // 4. Auto matrix — full Cartesian product (type × lieu) +
  //    (theme × lieu) + (theme × france). We intentionally cap the
  //    explosion by NOT generating type × theme × occasion at this
  //    layer (templates handle that for yonder mirrors only).
  for (const lieu of LIEUX) {
    if (lieu.slug === 'monde') continue;
    for (const t of HOTEL_TYPES) {
      if (t === 'all') continue;
      const axes: RankingAxes = {
        types: [t],
        lieu: { scope: lieu.scope, slug: lieu.slug, label: lieu.label },
        themes: [],
        occasions: [],
        saison: 'toute-annee',
      };
      totalCandidates += 1;
      const seed = buildSeed({ axes, source: 'auto', catalog });
      if (seed === null) continue;
      if (seedsBySlug.has(seed.slug)) continue;
      if (skipUnderfilled && !seed.hasEnoughCandidates) {
        droppedUnderfilled += 1;
        continue;
      }
      seedsBySlug.set(seed.slug, seed);
    }
  }

  // 5. Theme × Lieu (type=all).
  for (const lieu of LIEUX) {
    if (lieu.slug === 'monde') continue;
    for (const th of THEMES) {
      const axes: RankingAxes = {
        types: ['all'],
        lieu: { scope: lieu.scope, slug: lieu.slug, label: lieu.label },
        themes: [th],
        occasions: [],
        saison: 'toute-annee',
      };
      totalCandidates += 1;
      const seed = buildSeed({ axes, source: 'auto', catalog });
      if (seed === null) continue;
      if (seedsBySlug.has(seed.slug)) continue;
      if (skipUnderfilled && !seed.hasEnoughCandidates) {
        droppedUnderfilled += 1;
        continue;
      }
      seedsBySlug.set(seed.slug, seed);
    }
  }

  // 6. Occasion × France (type=all). Few but high-volume terms.
  for (const o of OCCASIONS) {
    const axes: RankingAxes = {
      types: ['all'],
      lieu: { scope: 'france', slug: 'france', label: 'France' },
      themes: [],
      occasions: [o],
      saison: 'toute-annee',
    };
    totalCandidates += 1;
    const seed = buildSeed({ axes, source: 'auto', catalog });
    if (seed === null) continue;
    if (seedsBySlug.has(seed.slug)) continue;
    if (skipUnderfilled && !seed.hasEnoughCandidates) {
      droppedUnderfilled += 1;
      continue;
    }
    seedsBySlug.set(seed.slug, seed);
  }

  const seeds = [...seedsBySlug.values()]
    .filter((s) => !SLUG_BLOCKLIST.has(s.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const bySource: Record<MatrixSource, number> = { auto: 0, yonder: 0, manual: 0 };
  const byTemplate: Record<string, number> = {};
  for (const s of seeds) {
    bySource[s.source] += 1;
    byTemplate[s.templateKey] = (byTemplate[s.templateKey] ?? 0) + 1;
  }

  return {
    seeds,
    stats: {
      totalCandidates,
      emittedSeeds: seeds.length,
      droppedUnderfilled,
      bySource,
      byTemplate,
    },
  };
}

// Re-export utilities used downstream.
export { renderRanking };
export type { RenderedRankingSeed };

// Quick helper for the CLI to filter "ready to generate" seeds.
export function readySeeds(seeds: ReadonlyArray<MatrixSeed>): MatrixSeed[] {
  return seeds.filter((s) => s.hasEnoughCandidates);
}

/** For UI: group seeds by lieu/scope (used by the facetted hub later). */
export function bucketByLieu(
  seeds: ReadonlyArray<MatrixSeed>,
): ReadonlyMap<string, ReadonlyArray<MatrixSeed>> {
  const out = new Map<string, MatrixSeed[]>();
  for (const s of seeds) {
    const k = s.axes.lieu.slug;
    const list = out.get(k) ?? [];
    list.push(s);
    out.set(k, list);
  }
  return out;
}
