import type { Locale } from '@/i18n/routing';

/**
 * Shared navigation data for `<SiteHeader>`, `<MobileNav>` and `<SiteFooter>`.
 *
 * Lives outside `server/` so Client Components (mobile nav) can import
 * it without dragging in `server-only`. Labels are pre-resolved per
 * locale to avoid round-tripping through `next-intl` for entries that
 * are stable across the product.
 *
 * ## Single source of truth
 *
 * The slugs in this file MUST stay in sync with:
 * - `server/hotels/editorial-categories.ts` — canonical list of category predicates
 * - `scripts/editorial-pilot/src/rankings/axes.ts` — canonical taxonomy of TYPES, THEMES, OCCASIONS, SAISONS, LIEUX
 * - `server/hotels/get-related-hotels.ts` — canonical list of `BRAND_FAMILIES`
 *
 * Mismatched slugs render a nav link to a 404'd page. A test in
 * `nav-data.test.ts` would assert congruence (CI gate, future PR).
 *
 * @see docs/adr/0014-menu-architecture-v2.md
 */

// ─── Common helpers ──────────────────────────────────────────────────────

/**
 * A single nav entry — a slug + a label in each supported V1 locale.
 *
 * V2 locales (de/es/it) and V3 (ar/zh/ja) are introduced by extending
 * the interface with optional `labelDe?`, `labelEs?`, `labelIt?`, etc.
 * For now the picker falls back to `labelFr` when an unknown locale is
 * requested — same convention as `i18n/supported-locale.ts`.
 */
export interface NavLabeledEntry {
  readonly slug: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

export function pickEntryLabel(entry: NavLabeledEntry, locale: Locale): string {
  return locale === 'en' ? entry.labelEn : entry.labelFr;
}

// ─── 1. Hotel categories — "Palaces & Hôtels > Par distinction" ──────────

export type HotelCategoryNavEntry = NavLabeledEntry;

/**
 * The 5 Palace editorial categories — kept for backwards compatibility
 * with the existing `/categorie/[slug]` pages and the current header
 * dropdown. The slugs and labels match `EDITORIAL_CATEGORIES` in
 * `server/hotels/editorial-categories.ts`.
 */
export const HOTEL_CATEGORY_NAV_ENTRIES: readonly HotelCategoryNavEntry[] = [
  {
    slug: 'palaces-france',
    labelFr: 'Tous les Palaces de France',
    labelEn: 'All Palaces in France',
  },
  {
    slug: 'palaces-paris',
    labelFr: 'Palaces parisiens',
    labelEn: 'Parisian Palaces',
  },
  {
    slug: 'palaces-montagne',
    labelFr: 'Palaces à la montagne',
    labelEn: 'Mountain Palaces',
  },
  {
    slug: 'palaces-bord-de-mer',
    labelFr: 'Palaces en bord de mer',
    labelEn: 'Seafront Palaces',
  },
  {
    slug: 'palaces-vignobles',
    labelFr: 'Palaces & vignobles',
    labelEn: 'Vineyard Palaces',
  },
];

/**
 * Legacy helper kept for `<MobileNav>` and `<SiteHeader>` consumers that
 * still call `pickCategoryLabel`. New code should use `pickEntryLabel`
 * directly.
 */
export function pickCategoryLabel(entry: HotelCategoryNavEntry, locale: Locale): string {
  return pickEntryLabel(entry, locale);
}

// ─── 2. Hotel types — "Palaces & Hôtels > Par type" (ADR-0016) ───────────

/**
 * 7 non-Palace categories surfaced by ADR-0016 (`/categorie/[slug]`).
 * Each entry corresponds to an `EditorialCategory` declared in
 * `server/hotels/editorial-categories.ts` with the same slug.
 */
export const HOTEL_TYPE_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'hotels-5-etoiles', labelFr: 'Hôtels 5 étoiles', labelEn: '5-Star Hotels' },
  { slug: 'hotels-4-etoiles', labelFr: 'Hôtels 4 étoiles', labelEn: '4-Star Hotels' },
  { slug: 'boutique-hotels', labelFr: 'Boutique-hôtels', labelEn: 'Boutique Hotels' },
  { slug: 'chateaux-hotels', labelFr: 'Châteaux-hôtels', labelEn: 'Château Hotels' },
  { slug: 'chalets-luxe', labelFr: 'Chalets de luxe', labelEn: 'Luxury Chalets' },
  { slug: 'villas', labelFr: 'Villas privées', labelEn: 'Private Villas' },
  { slug: 'maisons-hotes', labelFr: "Maisons d'hôtes", labelEn: 'Guesthouses' },
];

/**
 * Maps a `HOTEL_TYPE_NAV_ENTRIES` slug to the canonical axis-type value
 * expected by `/classements/[axe]/[valeur]` (axe='type'). The two
 * taxonomies diverged historically: the menu surfaces user-friendly
 * plurals (`hotels-5-etoiles`, `boutique-hotels`) while the rankings
 * matrice in `scripts/editorial-pilot/src/rankings/axes.ts` uses the
 * singular canonical form (`5-etoiles`, `boutique-hotel`).
 *
 * The previous mega-menu mapped via `entry.slug.replace(/^hotels-/u, '')`
 * which only stripped the `hotels-` prefix on `hotels-5-etoiles` and
 * `hotels-4-etoiles`. The other 5 entries (boutique, châteaux, chalets,
 * villas, maisons) produced `/classements/type/boutique-hotels` etc. —
 * which `axes.ts` does not recognise → 404.
 *
 * Source of truth for the right-hand side is `axes.ts` `HOTEL_TYPES`:
 * `'palace' | '5-etoiles' | '4-etoiles' | 'boutique-hotel' | 'chateau'
 *  | 'chalet' | 'villa' | 'maison-hotes' | 'resort' | 'ecolodge'
 *  | 'insolite' | 'all'`.
 */
export const NAV_HOTEL_TYPE_TO_AXIS_VALUE: Readonly<Record<string, string>> = {
  'hotels-5-etoiles': '5-etoiles',
  'hotels-4-etoiles': '4-etoiles',
  'boutique-hotels': 'boutique-hotel',
  'chateaux-hotels': 'chateau',
  'chalets-luxe': 'chalet',
  villas: 'villa',
  'maisons-hotes': 'maison-hotes',
};

/**
 * Safe accessor: returns `null` when the menu slug is unknown so the
 * consumer can avoid rendering a broken link. A test in `nav-data`
 * keeps this table in sync with `HOTEL_TYPE_NAV_ENTRIES`.
 */
export function navHotelTypeToAxisValue(navSlug: string): string | null {
  return NAV_HOTEL_TYPE_TO_AXIS_VALUE[navSlug] ?? null;
}

// ─── 3. Hotel brands — "Palaces & Hôtels > Par groupe hôtelier" ──────────

/**
 * Subset of `BRAND_FAMILIES` (server/hotels/get-related-hotels.ts) shown
 * in the mega-menu. The mega-menu UI defers to `<SiteHeader>` which
 * slices this array (now `slice(0, 12)` — 12 visible entries to expose
 * the international roster post ADR-0021). The footer can surface a
 * longer subset.
 *
 * Order convention: international author collections first (Aman,
 * Belmond, Six Senses, Bulgari, Auberge Resorts) so the mega-menu
 * leads with the catalogue's worldwide footprint rather than the FR
 * roster alone — see [ADR-0021](/docs/adr/0021-pivot-scope-mondial.md).
 */
export const BRAND_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  // ── International collections surfaced first (PR-C, ADR-0021 Vague 4)
  // so the menu reads as global. The first 5 are the 2026-05-28
  // additions; the mega-menu slices (0, 12) so all 5 fit above the
  // historical roster. Test guard: `nav-data.test.ts` asserts these
  // 5 slugs are inside `slice(0, 12)`.
  { slug: 'aman', labelFr: 'Aman', labelEn: 'Aman' },
  { slug: 'belmond', labelFr: 'Belmond', labelEn: 'Belmond' },
  { slug: 'six-senses', labelFr: 'Six Senses', labelEn: 'Six Senses' },
  { slug: 'bulgari', labelFr: 'Bulgari', labelEn: 'Bulgari' },
  { slug: 'auberge-resorts', labelFr: 'Auberge Resorts', labelEn: 'Auberge Resorts' },
  // ── Historical roster (still surfaced inside the slice up to 12) ─────
  { slug: 'four-seasons', labelFr: 'Four Seasons', labelEn: 'Four Seasons' },
  { slug: 'mandarin-oriental', labelFr: 'Mandarin Oriental', labelEn: 'Mandarin Oriental' },
  { slug: 'rosewood', labelFr: 'Rosewood', labelEn: 'Rosewood' },
  { slug: 'park-hyatt', labelFr: 'Park Hyatt', labelEn: 'Park Hyatt' },
  { slug: 'cheval-blanc', labelFr: 'Cheval Blanc', labelEn: 'Cheval Blanc' },
  { slug: 'airelles', labelFr: 'Airelles', labelEn: 'Airelles' },
  { slug: 'oetker-collection', labelFr: 'Oetker Collection', labelEn: 'Oetker Collection' },
  // ── Below the mega-menu fold — visible only on `/marques` index ──────
  {
    slug: 'dorchester-collection',
    labelFr: 'Dorchester Collection',
    labelEn: 'Dorchester Collection',
  },
  { slug: 'raffles', labelFr: 'Raffles', labelEn: 'Raffles' },
  { slug: 'peninsula', labelFr: 'The Peninsula', labelEn: 'The Peninsula' },
  { slug: 'shangri-la', labelFr: 'Shangri-La', labelEn: 'Shangri-La' },
  { slug: 'les-k2', labelFr: 'Les K2 Collections', labelEn: 'Les K2 Collections' },
  { slug: 'caudalie', labelFr: 'Caudalie', labelEn: 'Caudalie' },
];

// ─── 3bis. Editorial labels & rankings — "Palaces & Hôtels > Distinctions"
//
// Sourced from `affiliations[].facet_slug` written by migration 0063.
// These distinctions stack with brand membership (a Four Seasons can
// also be Forbes 5-Star and an LHW member). Mega-menu surfaces the
// 6 most prestigious in a horizontal chip row; the footer adds the
// remaining rankings. URL pattern: `/label/[facetSlug]`.

/** Catalogue-driven editorial distinctions (labels + rankings). */
export const LABEL_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  {
    slug: 'relais-chateaux',
    labelFr: 'Relais & Châteaux',
    labelEn: 'Relais & Châteaux',
  },
  {
    slug: 'small-luxury-hotels',
    labelFr: 'Small Luxury Hotels',
    labelEn: 'Small Luxury Hotels',
  },
  {
    slug: 'leading-hotels-of-the-world',
    labelFr: 'Leading Hotels of the World',
    labelEn: 'Leading Hotels of the World',
  },
  { slug: 'forbes-5-star', labelFr: 'Forbes 5-Star', labelEn: 'Forbes 5-Star' },
  {
    slug: 'michelin-3-keys',
    labelFr: 'Michelin — Trois Clés',
    labelEn: 'Michelin — Three Keys',
  },
  {
    slug: 'palace-atout-france',
    labelFr: 'Palaces Atout France',
    labelEn: 'Atout France Palaces',
  },
  // ── Rankings (annual editorial classements) ───────────────────────────
  {
    slug: 'world-50-best',
    labelFr: "World's 50 Best Hotels",
    labelEn: "World's 50 Best Hotels",
  },
  {
    slug: 'travel-leisure-worlds-best',
    labelFr: "Travel + Leisure World's Best",
    labelEn: "Travel + Leisure World's Best",
  },
  {
    slug: 'conde-nast-gold-list',
    labelFr: 'Condé Nast Gold List',
    labelEn: 'Condé Nast Gold List',
  },
];

// ─── 4. Themes — "Inspiration > Par thème" ───────────────────────────────

/**
 * 12 most-used `THEMES` from `axes.ts` — surfaced in `/inspiration` hub
 * and the mega-menu. The full enum has 20 entries; we curate the visible
 * subset to fit a 3-column mega-menu. URL pattern:
 * `/classements/theme/[slug]` (route matrice existing).
 */
export const THEME_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'romantique', labelFr: 'Romantique', labelEn: 'Romantic' },
  { slug: 'spa-bienetre', labelFr: 'Spa & bien-être', labelEn: 'Spa & wellness' },
  {
    slug: 'gastronomie',
    labelFr: 'Gastronomie & étoiles Michelin',
    labelEn: 'Gastronomy & Michelin',
  },
  { slug: 'famille', labelFr: 'Famille', labelEn: 'Family' },
  { slug: 'vignobles', labelFr: 'Vignobles & œnotourisme', labelEn: 'Vineyards & wine tourism' },
  { slug: 'design', labelFr: 'Design & architecture', labelEn: 'Design & architecture' },
  { slug: 'patrimoine', labelFr: 'Patrimoine & châteaux', labelEn: 'Heritage & châteaux' },
  { slug: 'sport-golf', labelFr: 'Golf', labelEn: 'Golf' },
  { slug: 'sport-ski', labelFr: 'Ski-in / ski-out', labelEn: 'Ski-in / ski-out' },
  { slug: 'piscine', labelFr: 'Piscine', labelEn: 'Pool' },
  { slug: 'rooftop', labelFr: 'Rooftop', labelEn: 'Rooftop' },
  { slug: 'kids-friendly', labelFr: 'Kids-friendly', labelEn: 'Kids-friendly' },
];

// ─── 5. Occasions — "Inspiration > Par occasion" ─────────────────────────

/**
 * All 9 `OCCASIONS` from `axes.ts` — the AEO-premium axis (lune de miel,
 * week-end, etc. are the high-intent queries). URL pattern:
 * `/classements/occasion/[slug]`.
 */
export const OCCASION_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'lune-de-miel', labelFr: 'Lune de miel', labelEn: 'Honeymoon' },
  { slug: 'week-end', labelFr: 'Week-end en amoureux', labelEn: 'Romantic weekend' },
  { slug: 'anniversaire', labelFr: 'Anniversaire', labelEn: 'Anniversary' },
  { slug: 'mariage', labelFr: 'Mariage', labelEn: 'Wedding' },
  { slug: 'seminaire', labelFr: 'Séminaire & MICE', labelEn: 'Seminar & MICE' },
  { slug: 'escapade', labelFr: 'Escapade en famille', labelEn: 'Family getaway' },
  { slug: 'staycation', labelFr: 'Staycation', labelEn: 'Staycation' },
  { slug: 'fetes', labelFr: 'Fêtes de fin d’année', labelEn: 'End-of-year holidays' },
  { slug: 'minceur', labelFr: 'Retraite bien-être', labelEn: 'Wellness retreat' },
];

// ─── 6. Saisons — "Inspiration > Par saison" ─────────────────────────────

/**
 * 4 `SAISONS` from `axes.ts` (we omit `toute-annee` from the menu — it's
 * the default, not a navigable axis). URL pattern:
 * `/classements/saison/[slug]`.
 */
export const SAISON_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'hiver', labelFr: 'Hiver / ski', labelEn: 'Winter / ski' },
  { slug: 'ete', labelFr: 'Été / bord de mer', labelEn: 'Summer / seaside' },
  { slug: 'printemps', labelFr: 'Printemps / vignobles', labelEn: 'Spring / vineyards' },
  { slug: 'automne', labelFr: 'Automne / patrimoine', labelEn: 'Autumn / heritage' },
];

// ─── 7. Top destinations — "Destinations > France" (curated subset) ──────

/**
 * The 8 highest-value French destinations (clusters or villes) that
 * deserve top-level visibility in the mega-menu. Pulls from `LIEUX` in
 * `axes.ts` but is intentionally smaller — surfacing the 60+ lieux in
 * a header would overwhelm the user.
 *
 * URL pattern: `/destination/[citySlug]`. Slugs map to published cities
 * in Supabase via `listPublishedCities()`.
 */
export const TOP_DESTINATION_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'paris', labelFr: 'Paris', labelEn: 'Paris' },
  {
    slug: 'cannes',
    labelFr: "Côte d'Azur (Cannes, Nice…)",
    labelEn: 'French Riviera (Cannes, Nice…)',
  },
  {
    slug: 'courchevel',
    labelFr: 'Alpes (Courchevel, Megève…)',
    labelEn: 'French Alps (Courchevel, Megève…)',
  },
  {
    slug: 'aix-en-provence',
    labelFr: 'Provence (Luberon, Alpilles)',
    labelEn: 'Provence (Luberon, Alpilles)',
  },
  { slug: 'bordeaux', labelFr: 'Bordelais & vignobles', labelEn: 'Bordeaux & vineyards' },
  { slug: 'reims', labelFr: 'Champagne (Reims, Épernay)', labelEn: 'Champagne (Reims, Épernay)' },
  { slug: 'biarritz', labelFr: 'Pays basque (Biarritz)', labelEn: 'Basque Country (Biarritz)' },
  { slug: 'porto-vecchio', labelFr: 'Corse', labelEn: 'Corsica' },
];

/**
 * International city slugs surfaced by the Phase 4.A guides + the
 * `/destination` directory. Same shape as `TOP_DESTINATION_NAV_ENTRIES`
 * — `KNOWN_MENU_CITY_SLUGS` (in `app/[locale]/destination/[citySlug]/
 * page.tsx`) merges this array with the FR set so an off-menu deep link
 * to e.g. `/destination/marrakech` resolves with the graceful empty
 * state instead of a hard 404 while the guide is being seeded.
 *
 * Slug source — these are the literal `citySlug(city)` outputs
 * computed from `public.hotels` (so `dubai` not `dubaï`, `new-york`
 * not `nyc`). Adding a slug here is metadata only; the route
 * `/destination/[citySlug]` reads its data directly from Supabase.
 *
 * Added 2026-05-28 alongside ADR-0016 — international guide unblock.
 */
export const TOP_INTL_DESTINATION_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'new-york', labelFr: 'New York', labelEn: 'New York' },
  { slug: 'dubai', labelFr: 'Dubaï', labelEn: 'Dubai' },
  { slug: 'tokyo', labelFr: 'Tokyo', labelEn: 'Tokyo' },
  { slug: 'marrakech', labelFr: 'Marrakech', labelEn: 'Marrakech' },
  { slug: 'mykonos', labelFr: 'Mykonos', labelEn: 'Mykonos' },
  { slug: 'santorin', labelFr: 'Santorin', labelEn: 'Santorini' },
  { slug: 'bali', labelFr: 'Bali', labelEn: 'Bali' },
  { slug: 'phuket', labelFr: 'Phuket', labelEn: 'Phuket' },
  { slug: 'st-moritz', labelFr: 'St-Moritz', labelEn: 'St. Moritz' },
  { slug: 'lake-como', labelFr: 'Lac de Côme', labelEn: 'Lake Como' },
  { slug: 'madeira', labelFr: 'Madère', labelEn: 'Madeira' },
  { slug: 'riviera-maya', labelFr: 'Riviera Maya', labelEn: 'Riviera Maya' },
  { slug: 'algarve', labelFr: 'Algarve', labelEn: 'Algarve' },
  { slug: 'amalfi-coast', labelFr: 'Côte amalfitaine', labelEn: 'Amalfi Coast' },
];

/**
 * Hero region slugs — used in the "Régions héros" column of the
 * Destinations mega-menu. These are editorial clusters from `LIEUX`
 * (scope: cluster/region) that get a dedicated card in the
 * `/destination` directory.
 */
export const HERO_REGION_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'cote-d-azur', labelFr: "Côte d'Azur", labelEn: 'French Riviera' },
  { slug: 'provence', labelFr: 'Provence', labelEn: 'Provence' },
  { slug: 'alpes', labelFr: 'Alpes françaises', labelEn: 'French Alps' },
  { slug: 'bordeaux', labelFr: 'Bordelais', labelEn: 'Bordeaux' },
  { slug: 'champagne', labelFr: 'Champagne', labelEn: 'Champagne' },
  { slug: 'corse', labelFr: 'Corse', labelEn: 'Corsica' },
  { slug: 'pays-basque', labelFr: 'Pays basque', labelEn: 'Basque Country' },
  { slug: 'loire', labelFr: 'Châteaux de la Loire', labelEn: 'Loire Valley châteaux' },
];

// ─── 8. Top rankings — "Classements > Les plus populaires" ───────────────

/**
 * Curated "best-of" rankings surfaced in the Classements mega-menu and
 * the footer top-rankings column.
 *
 * Slugs MUST match published `editorial_rankings.slug` in Supabase. The
 * 2026-05-25 nav audit revealed that 4/6 of the previous lineup pointed
 * at slugs that did not exist in the DB at all — emitting 4 dead `404`s
 * page-wide on every render (header + footer). This list is now the
 * intersection of the editorial menu intent and the published catalogue.
 *
 * Audit script: run the SQL in
 * `apps/web/src/components/layout/nav-data.test.ts` "TOP_RANKING_NAV_ENTRIES
 * slugs are all published in DB" whenever the menu changes. The CI
 * gate guarantees no orphan menu link ships to production.
 *
 * Update this list after a quarterly content review based on GSC top
 * impressions for `/classement/*` pages.
 */
export const TOP_RANKING_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  {
    slug: 'meilleurs-palaces-france',
    labelFr: 'Meilleurs Palaces de France',
    labelEn: 'Best Palaces of France',
  },
  {
    slug: 'meilleurs-5-etoiles-paris',
    labelFr: 'Meilleurs hôtels 5★ Paris',
    labelEn: 'Best 5-Star Hotels Paris',
  },
  // ── International rankings (ADR-0021 — added 2026-05-28) ────────────────
  // Replaces 2 FR rankings to balance the lineup with the worldwide
  // catalogue. Both slugs are confirmed published in `editorial_rankings`.
  {
    slug: 'top-aman-hotels-monde',
    labelFr: 'Top Aman dans le monde',
    labelEn: 'Top Aman hotels worldwide',
  },
  {
    slug: 'top-mandarin-oriental-hotels-monde',
    labelFr: 'Top Mandarin Oriental',
    labelEn: 'Top Mandarin Oriental',
  },
  {
    slug: 'meilleurs-hotels-spa-france',
    labelFr: 'Meilleurs hôtels avec spa',
    labelEn: 'Best hotel spas',
  },
  {
    slug: 'classement-worlds-50-best-hotels-2025',
    labelFr: "World's 50 Best Hotels 2025",
    labelEn: "World's 50 Best Hotels 2025",
  },
];

// ─── 9. International destinations — "Destinations > International" ──────

/**
 * Country-level entries for the World column of the Destinations
 * mega-menu. URL pattern: `/destination/[countrySlug]` (the
 * destination directory already groups by country for international).
 *
 * If a country has no published guide, the link gracefully resolves to
 * the world section of `/destination` instead.
 */
export const INTL_DESTINATION_NAV_ENTRIES: readonly NavLabeledEntry[] = [
  { slug: 'italie', labelFr: 'Italie', labelEn: 'Italy' },
  { slug: 'suisse', labelFr: 'Suisse', labelEn: 'Switzerland' },
  { slug: 'maroc', labelFr: 'Maroc', labelEn: 'Morocco' },
  { slug: 'emirats-arabes-unis', labelFr: 'Émirats arabes unis', labelEn: 'United Arab Emirates' },
  { slug: 'maldives', labelFr: 'Maldives', labelEn: 'Maldives' },
  { slug: 'thailande', labelFr: 'Thaïlande', labelEn: 'Thailand' },
  { slug: 'japon', labelFr: 'Japon', labelEn: 'Japan' },
  { slug: 'etats-unis', labelFr: 'États-Unis', labelEn: 'United States' },
];

/**
 * Maps the menu's FR-friendly country slugs to ISO 3166-1 alpha-2
 * codes used by `/hotels` country anchors (e.g. `#country-it` for
 * Italy). The destination/[city] route is FR-only by design
 * (`getDestinationBySlug` filters `country_code === 'FR'`) — pointing
 * the international menu entries at `/destination/<slug>` produced
 * silent 404s + `noindex` for every international link. Re-routing
 * them to `/hotels#country-<iso>` lands the user on the country
 * section of the catalogue, the closest existing surface until a
 * dedicated `/destination-internationale/[countrySlug]` page ships.
 */
export const INTL_NAV_SLUG_TO_ISO: Readonly<Record<string, string>> = {
  italie: 'it',
  suisse: 'ch',
  maroc: 'ma',
  'emirats-arabes-unis': 'ae',
  maldives: 'mv',
  thailande: 'th',
  japon: 'jp',
  'etats-unis': 'us',
};

export function intlNavSlugToIso(navSlug: string): string | null {
  return INTL_NAV_SLUG_TO_ISO[navSlug] ?? null;
}
