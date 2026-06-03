/**
 * Golden-template editorial predicates — single source of truth shared by the
 * Airelles golden-template override (`apps/web`) and the catalogue audit
 * (`@mch/editorial-pilot`). Pure, dependency-free, operates on `unknown`
 * jsonb-shaped values so both the typed override data and the loosely-typed
 * audit rows can call the same logic.
 *
 * What makes a fiche "exemplary" (the Airelles golden template):
 *   - every cited restaurant / point of interest carries a concierge "handoff"
 *     (a contact path + a one-line tip) — the same info a concierge would
 *     e-mail a guest;
 *   - points of interest are organised in three buckets (visit / do / shop);
 *   - the long-read narrative does NOT duplicate a canonical structured block
 *     (restaurants, spa, location, amenities) — anti-cannibalisation;
 *   - the narrative carries no fabricated distinction (e.g. a Michelin star on
 *     a restaurant that holds none).
 */

export type PoiBucket = 'visit' | 'do' | 'shop';

export const POI_BUCKETS: readonly PoiBucket[] = ['visit', 'do', 'shop'];

/* ── small helpers ── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function anyNonEmpty(rec: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((k) => nonEmptyString(rec[k]));
}

function hasNumber(rec: Record<string, unknown>, key: string): boolean {
  return typeof rec[key] === 'number' && Number.isFinite(rec[key] as number);
}

/* ── Concierge handoff — restaurants / F&B venues ── */

export interface VenueHandoff {
  readonly hasName: boolean;
  /** website OR reservation_url OR phone — at least one bookable contact path. */
  readonly hasContact: boolean;
  readonly hasHours: boolean;
  readonly hasPrice: boolean;
  /** tip_fr OR tip_en — the concierge one-liner. */
  readonly hasTip: boolean;
  /** Minimal exemplary contract: a name + a contact path + a tip. */
  readonly complete: boolean;
}

export function evaluateVenueHandoff(venue: unknown): VenueHandoff {
  const rec = asRecord(venue);
  if (rec === null) {
    return {
      hasName: false,
      hasContact: false,
      hasHours: false,
      hasPrice: false,
      hasTip: false,
      complete: false,
    };
  }
  const hasName = nonEmptyString(rec['name']);
  const hasContact = anyNonEmpty(rec, ['website', 'reservation_url', 'phone']);
  const hasHours = anyNonEmpty(rec, ['hours_fr', 'hours_en', 'hours']);
  const hasPrice = anyNonEmpty(rec, ['price_note_fr', 'price_note_en', 'price_note']);
  const hasTip = anyNonEmpty(rec, ['tip_fr', 'tip_en', 'tip']);
  return {
    hasName,
    hasContact,
    hasHours,
    hasPrice,
    hasTip,
    complete: hasName && hasContact && hasTip,
  };
}

/** Number of venues in `restaurant_info.venues[]` that meet the handoff contract. */
export function countCompleteVenues(restaurantInfo: unknown): {
  total: number;
  complete: number;
} {
  const rec = asRecord(restaurantInfo);
  const venues = rec !== null && Array.isArray(rec['venues']) ? (rec['venues'] as unknown[]) : [];
  let complete = 0;
  for (const v of venues) {
    if (evaluateVenueHandoff(v).complete) complete += 1;
  }
  return { total: venues.length, complete };
}

/* ── Concierge handoff — points of interest ── */

export interface PoiHandoff {
  readonly hasName: boolean;
  readonly bucket: PoiBucket | null;
  readonly hasDistance: boolean;
  readonly hasDescription: boolean;
  readonly hasContact: boolean;
  readonly hasTip: boolean;
  /** Minimal exemplary contract: name + bucket + distance + description + tip. */
  readonly complete: boolean;
}

function readBucket(rec: Record<string, unknown>): PoiBucket | null {
  const raw = rec['bucket'];
  if (raw === 'visit' || raw === 'do' || raw === 'shop') return raw;
  return null;
}

export function evaluatePoiHandoff(poi: unknown): PoiHandoff {
  const rec = asRecord(poi);
  if (rec === null) {
    return {
      hasName: false,
      bucket: null,
      hasDistance: false,
      hasDescription: false,
      hasContact: false,
      hasTip: false,
      complete: false,
    };
  }
  const hasName = nonEmptyString(rec['name']) || nonEmptyString(rec['name_fr']);
  const bucket = readBucket(rec);
  const hasDistance =
    hasNumber(rec, 'distance_meters') ||
    hasNumber(rec, 'distance_km') ||
    hasNumber(rec, 'walk_minutes') ||
    nonEmptyString(rec['distance_fr']);
  const hasDescription = anyNonEmpty(rec, ['description_fr', 'description_en', 'description']);
  const hasContact = anyNonEmpty(rec, ['website', 'phone', 'address', 'reservation_url']);
  const hasTip = anyNonEmpty(rec, ['tip_fr', 'tip_en', 'tip']);
  return {
    hasName,
    bucket,
    hasDistance,
    hasDescription,
    hasContact,
    hasTip,
    complete: hasName && bucket !== null && hasDistance && hasDescription && hasTip,
  };
}

export interface PoiBucketCoverage {
  readonly total: number;
  readonly complete: number;
  readonly buckets: Readonly<Record<PoiBucket, number>>;
  /** True when each of visit / do / shop has at least one entry. */
  readonly allBucketsCovered: boolean;
}

export function evaluatePoiBuckets(pointsOfInterest: unknown): PoiBucketCoverage {
  const items = Array.isArray(pointsOfInterest) ? (pointsOfInterest as unknown[]) : [];
  const buckets: Record<PoiBucket, number> = { visit: 0, do: 0, shop: 0 };
  let complete = 0;
  for (const item of items) {
    const h = evaluatePoiHandoff(item);
    if (h.bucket !== null) buckets[h.bucket] += 1;
    if (h.complete) complete += 1;
  }
  return {
    total: items.length,
    complete,
    buckets,
    allBucketsCovered: POI_BUCKETS.every((b) => buckets[b] >= 1),
  };
}

/* ── Spa dossier richness ── */

export interface SpaDossier {
  readonly hasDescription: boolean;
  readonly hasHours: boolean;
  readonly hasContact: boolean;
  readonly hasTip: boolean;
  /** Exemplary spa dossier: editorial description + hours + a contact path + a tip. */
  readonly complete: boolean;
}

export function evaluateSpaDossier(spaInfo: unknown): SpaDossier {
  const rec = asRecord(spaInfo);
  if (rec === null) {
    return {
      hasDescription: false,
      hasHours: false,
      hasContact: false,
      hasTip: false,
      complete: false,
    };
  }
  const hasDescription = anyNonEmpty(rec, ['description_fr', 'description_en', 'description']);
  const hasHours = anyNonEmpty(rec, ['hours_fr', 'hours_en', 'hours']);
  const hasContact = anyNonEmpty(rec, ['website', 'phone']);
  const hasTip = anyNonEmpty(rec, ['tip_fr', 'tip_en', 'tip']);
  return {
    hasDescription,
    hasHours,
    hasContact,
    hasTip,
    complete: hasDescription && hasHours && hasContact && hasTip,
  };
}

/* ── Anti-cannibalisation — drop long-read sections that duplicate a block ── */

/**
 * Anchors (kebab ids, shared across locales) of long-read sections that
 * duplicate a dedicated structured block already rendered on the fiche:
 *   - dining        → <HotelRestaurants> (restaurant_info)
 *   - spa / wellness → <HotelSpa> (spa_info)
 *   - location/POIs  → <HotelLocation> (#lieu, points_of_interest)
 *   - services       → <HotelAmenities> (#amenities-title)
 */
export const DUPLICATE_CATEGORY_ANCHORS: ReadonlySet<string> = new Set([
  // dining → <HotelRestaurants>
  'restauration',
  'restaurants',
  'dining',
  'gastronomie',
  // spa / wellness → <HotelSpa>
  'bien-etre',
  'bien-etre-spa',
  'spa',
  'spa-bien-etre',
  'wellness',
  // location / nearby POIs → <HotelLocation> (#lieu)
  'a-deux-pas',
  'aux-alentours',
  'alentours',
  'autour',
  'a-proximite',
  'que-faire',
  'que-faire-autour',
  'environs',
  'localisation',
  // services / amenities → <HotelAmenities> (#amenities-title)
  'service-equipe',
  'service-equipes',
  'services',
  'services-equipements',
  'equipements',
  'equipements-services',
  'equipe',
]);

const DUPLICATE_TITLE_RE =
  /restauration|restaurants?|gastronom|dining|spa|bien.?[êe]tre|wellness|deux pas|alentour|proximit|autour|que faire|nearby|surroundings|localisation|service|[ée]quipe|[ée]quipement|amenit|facilit/u;

export function isDuplicateCategorySection(entry: unknown): boolean {
  const rec = asRecord(entry);
  if (rec === null) return false;
  const anchor = typeof rec['anchor'] === 'string' ? rec['anchor'].toLowerCase() : '';
  if (DUPLICATE_CATEGORY_ANCHORS.has(anchor)) return true;
  const titles = [rec['title_fr'], rec['title_en']]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  return DUPLICATE_TITLE_RE.test(titles);
}

export function dropDuplicateCategorySections(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).filter((entry) => !isDuplicateCategorySection(entry));
}

/** Count long-read sections that duplicate a canonical structured block. */
export function countDuplicateCategorySections(longDescriptionSections: unknown): number {
  if (!Array.isArray(longDescriptionSections)) return 0;
  return (longDescriptionSections as unknown[]).filter((e) => isDuplicateCategorySection(e)).length;
}

/* ── Conditional cannibalisation — only a TRUE duplicate when the matching
 *    structured block is actually populated and rendered richly ──
 *
 * `countDuplicateCategorySections` flags any category-named long-read section
 * (Restauration / Spa / À deux pas …). But on most catalogue fiches those
 * sections are the ONLY carrier of that content — `restaurant_info` / `spa_info`
 * are empty. Dropping them would be content loss, not de-duplication. A section
 * cannibalises a block ONLY when that block is genuinely populated:
 *   - dining   ⟺ restaurant_info.venues non-empty
 *   - spa      ⟺ spa_info has an editorial description
 *   - location ⟺ points_of_interest carries at least one complete handoff
 * Services/amenities are intentionally excluded: a "Service & équipe" narrative
 * is editorial voice, not a duplicate of the amenities checklist.
 */
export type CannibalCategory = 'dining' | 'spa' | 'location';

const DINING_ANCHORS: ReadonlySet<string> = new Set([
  'restauration',
  'restaurants',
  'dining',
  'gastronomie',
]);
const SPA_ANCHORS: ReadonlySet<string> = new Set([
  'bien-etre',
  'bien-etre-spa',
  'spa',
  'spa-bien-etre',
  'wellness',
]);
const LOCATION_ANCHORS: ReadonlySet<string> = new Set([
  'a-deux-pas',
  'aux-alentours',
  'alentours',
  'autour',
  'a-proximite',
  'que-faire',
  'que-faire-autour',
  'environs',
  'localisation',
]);

const DINING_TITLE_RE = /restauration|restaurants?|gastronom|dining/u;
const SPA_TITLE_RE = /spa|bien.?[êe]tre|wellness/u;
const LOCATION_TITLE_RE =
  /deux pas|alentour|proximit|autour|que faire|nearby|surroundings|localisation/u;

export function categoryOfSection(entry: unknown): CannibalCategory | null {
  const rec = asRecord(entry);
  if (rec === null) return null;
  const anchor = typeof rec['anchor'] === 'string' ? rec['anchor'].toLowerCase() : '';
  if (DINING_ANCHORS.has(anchor)) return 'dining';
  if (SPA_ANCHORS.has(anchor)) return 'spa';
  if (LOCATION_ANCHORS.has(anchor)) return 'location';
  const titles = [rec['title_fr'], rec['title_en']]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
  if (DINING_TITLE_RE.test(titles)) return 'dining';
  if (SPA_TITLE_RE.test(titles)) return 'spa';
  if (LOCATION_TITLE_RE.test(titles)) return 'location';
  return null;
}

export interface PopulatedBlocks {
  readonly dining: boolean;
  readonly spa: boolean;
  readonly location: boolean;
}

/** True when `restaurant_info.venues[]` holds at least one entry. */
export function isPopulatedRestaurantInfo(restaurantInfo: unknown): boolean {
  const rec = asRecord(restaurantInfo);
  return rec !== null && Array.isArray(rec['venues']) && (rec['venues'] as unknown[]).length > 0;
}

/** True when `spa_info` carries an editorial description. */
export function isPopulatedSpaInfo(spaInfo: unknown): boolean {
  const rec = asRecord(spaInfo);
  return rec !== null && anyNonEmpty(rec, ['description_fr', 'description_en', 'description']);
}

/** True when `points_of_interest` carries at least one COMPLETE concierge handoff. */
export function isRichPois(pointsOfInterest: unknown): boolean {
  return evaluatePoiBuckets(pointsOfInterest).complete > 0;
}

export function resolvePopulatedBlocks(blocks: {
  readonly restaurantInfo?: unknown;
  readonly spaInfo?: unknown;
  readonly pointsOfInterest?: unknown;
}): PopulatedBlocks {
  return {
    dining: isPopulatedRestaurantInfo(blocks.restaurantInfo),
    spa: isPopulatedSpaInfo(blocks.spaInfo),
    location: isRichPois(blocks.pointsOfInterest),
  };
}

function sectionCannibalises(entry: unknown, blocks: PopulatedBlocks): boolean {
  const category = categoryOfSection(entry);
  if (category === null) return false;
  return blocks[category];
}

/** Count long-read sections that TRULY cannibalise a populated structured block. */
export function countCannibalizingSections(
  longDescriptionSections: unknown,
  blocks: PopulatedBlocks,
): number {
  if (!Array.isArray(longDescriptionSections)) return 0;
  return (longDescriptionSections as unknown[]).filter((e) => sectionCannibalises(e, blocks))
    .length;
}

/** Drop only the sections that cannibalise a populated structured block. */
export function dropCannibalizingSections(
  longDescriptionSections: unknown,
  blocks: PopulatedBlocks,
): unknown {
  if (!Array.isArray(longDescriptionSections)) return longDescriptionSections;
  return (longDescriptionSections as unknown[]).filter((e) => !sectionCannibalises(e, blocks));
}

/* ── Fabricated-distinction sentinel — narrative claims a Michelin star ── */

const FABRICATED_STAR_PATTERNS: readonly RegExp[] = [
  /\d\s*[ée]toiles?\s+(?:au\s+)?(?:guide\s+)?michelin/iu,
  /[ée]toiles?\s+au\s+guide\s+michelin/iu,
  /table\s+[ée]toil[ée]e/iu,
  /d[îi]ner\s+[ée]toil[ée]/iu,
  /restaurant\s+[ée]toil[ée]/iu,
  /\bmichelin[-\s]starred\b/iu,
  /\b\d\s*michelin\s+stars?\b/iu,
  /\bstarred\s+(?:dinner|restaurant|table|dining)\b/iu,
];

/** True when an awards array carries a verified Michelin distinction. */
export function hasVerifiedMichelinAward(awards: unknown): boolean {
  if (!Array.isArray(awards)) return false;
  return (awards as unknown[]).some((a) => {
    const rec = asRecord(a);
    if (rec === null) return false;
    if (rec['verified'] !== true) return false;
    const haystack = [rec['issuer'], rec['name_fr'], rec['name_en'], rec['url']]
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .toLowerCase();
    return haystack.includes('michelin');
  });
}

/**
 * Detects a fabricated "Michelin-starred restaurant" claim in narrative text
 * when the hotel holds no verified Michelin distinction. Returns true when a
 * star-claim pattern matches AND there is no verified Michelin award to back
 * it (EEAT — no fabricated distinction, hotel-detail-page.mdc Hard Rule 7).
 */
export function detectFabricatedStarClaim(
  texts: readonly (string | null | undefined)[],
  awards: unknown,
): boolean {
  if (hasVerifiedMichelinAward(awards)) return false;
  return texts.some((t) => {
    if (typeof t !== 'string' || t.length === 0) return false;
    return FABRICATED_STAR_PATTERNS.some((re) => re.test(t));
  });
}
