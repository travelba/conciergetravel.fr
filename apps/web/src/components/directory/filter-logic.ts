/**
 * Annuaire — Booking-style filter facets + match predicate (ADR-0026).
 *
 * Pure, dependency-free logic shared by the server (facet computation in
 * the directory views), the unit tests, and the client filter controller
 * (`<DirectoryMapLayout>`). It deliberately carries **no** `server-only`
 * marker and no env / Supabase / Cloudinary import so it can be bundled
 * into the client island — the single source of truth for "does this
 * hotel match the current selection?".
 */

/** A single selectable filter option with its label + occurrence count. */
export interface DirectoryFacetOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

/** Available filter options derived from the rendered hotel set. */
export interface DirectoryFacets {
  /** Distinct star ratings present, descending (e.g. `[5, 4, 3]`). */
  readonly stars: readonly number[];
  /** Number of Palaces (Atout France) — the palace toggle hides when 0. */
  readonly palaceCount: number;
  /** Hotel-group families present (≥ 1 hotel), sorted by frequency. */
  readonly brands: readonly DirectoryFacetOption[];
  /**
   * Place facet — neighbourhoods on the city page (`placeKey: 'district'`)
   * or cities on the country page (`placeKey: 'city'`), sorted by frequency.
   */
  readonly places: readonly DirectoryFacetOption[];
}

/** Minimal hotel shape `buildDirectoryFacets` reads (DirectoryHotel satisfies it). */
export interface DirectoryFacetSource {
  readonly stars: number;
  readonly isPalace: boolean;
  readonly brand: { readonly slug: string; readonly label: string } | null;
  readonly district: string | null;
  readonly city: string;
}

/** The minimal hotel shape the match predicate needs (DOM- or VM-derived). */
export interface DirectoryFacetSubject {
  readonly stars: number;
  readonly isPalace: boolean;
  readonly brandSlug: string | null;
  readonly place: string | null;
}

/** The current filter selection (an empty group imposes no constraint). */
export interface DirectorySelection {
  readonly stars: readonly number[];
  readonly palace: boolean;
  readonly brands: readonly string[];
  readonly places: readonly string[];
}

/** A fresh, empty selection (no active filter). */
export function emptyDirectorySelection(): DirectorySelection {
  return { stars: [], palace: false, brands: [], places: [] };
}

/** True when no facet group constrains the result set. */
export function isEmptySelection(selection: DirectorySelection): boolean {
  return (
    selection.stars.length === 0 &&
    !selection.palace &&
    selection.brands.length === 0 &&
    selection.places.length === 0
  );
}

function sortOptions(options: readonly DirectoryFacetOption[]): DirectoryFacetOption[] {
  return [...options].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Compute the filter rail facets from the directory hotel set. `placeKey`
 * selects which grouping the "place" facet exposes — neighbourhoods on a
 * city page, cities on a country page.
 */
export function buildDirectoryFacets(
  hotels: readonly DirectoryFacetSource[],
  placeKey: 'district' | 'city',
): DirectoryFacets {
  const starSet = new Set<number>();
  let palaceCount = 0;
  const brandMap = new Map<string, DirectoryFacetOption>();
  const placeMap = new Map<string, DirectoryFacetOption>();

  for (const h of hotels) {
    starSet.add(h.stars);
    if (h.isPalace) palaceCount += 1;

    if (h.brand !== null) {
      const existing = brandMap.get(h.brand.slug);
      brandMap.set(h.brand.slug, {
        value: h.brand.slug,
        label: h.brand.label,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const placeRaw = placeKey === 'district' ? h.district : h.city;
    const place = placeRaw !== null ? placeRaw.trim() : '';
    if (place.length > 0) {
      const existing = placeMap.get(place);
      placeMap.set(place, { value: place, label: place, count: (existing?.count ?? 0) + 1 });
    }
  }

  return {
    stars: [...starSet].sort((a, b) => b - a),
    palaceCount,
    brands: sortOptions([...brandMap.values()]),
    places: sortOptions([...placeMap.values()]),
  };
}

/**
 * Pure match predicate: a hotel passes when it satisfies every *active*
 * facet group (AND across groups, OR within a group). An empty group
 * imposes no constraint.
 */
export function matchesDirectoryFilters(
  subject: DirectoryFacetSubject,
  selection: DirectorySelection,
): boolean {
  if (selection.stars.length > 0 && !selection.stars.includes(subject.stars)) return false;
  if (selection.palace && !subject.isPalace) return false;
  if (
    selection.brands.length > 0 &&
    (subject.brandSlug === null || !selection.brands.includes(subject.brandSlug))
  ) {
    return false;
  }
  if (
    selection.places.length > 0 &&
    (subject.place === null || !selection.places.includes(subject.place))
  ) {
    return false;
  }
  return true;
}
