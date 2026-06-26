import 'server-only';

import { haversineMeters } from '@mch/integrations/overpass';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Editorial brand families surfaced as cross-link clusters. Detection
 * runs against the hotel name (case-insensitive). The order matters:
 * narrower needles win (e.g. `Ritz-Carlton Reserve` before `Ritz-Carlton`).
 *
 * Each family produces a stable slug that powers `/marque/[slug]`.
 *
 * ## Two-tier detection (2026-05-29)
 *
 * - `pattern !== null` → regex match against the hotel name. Detects
 *   un-affiliated rows (legacy catalogue, draft scaffolds) and the
 *   hotels whose `affiliations[]` column is still empty.
 * - `pattern === null` → no regex available (ambiguous needle, or brand
 *   identified solely via the structured `affiliations[]` column).
 *   The `/marque/[brandSlug]` route still resolves the slug from
 *   `affiliationBrandSlugs` on the index card.
 *
 * Either way, `KNOWN_BRANDS` is the source of truth for static params.
 * Brand slugs in `BRAND_FAMILIES` MUST stay aligned with `facet_slug`
 * values written by migration 0063 (so the JSON-LD `Brand.identifier`
 * → `/marque/<slug>` link never produces a soft-404).
 */
const BRAND_FAMILIES: readonly {
  slug: string;
  label: string;
  pattern: RegExp | null;
  /**
   * PostgREST ILIKE wildcard patterns (the `*` wildcard form consumed by
   * `.or('name.ilike.<pattern>')`) forming a **superset** of `pattern`.
   * Spaces are replaced by `*` so the matcher tolerates hyphenation and
   * spacing variants the same way the regex's `\s*` does.
   *
   * These let the `sameBrand` cluster filter the brand **in the database**
   * (over the whole catalogue) instead of pulling a global `.limit(N)` page
   * and filtering in memory — the global cap silently dropped every brand
   * whose first sibling sorts past row N (Aman=109, Ritz-Carlton=390,
   * St. Regis=2436 …). `detectBrand(name)` then re-confirms each DB
   * candidate, so an ILIKE false positive (e.g. "East Regis" for
   * `*st*regis*`) is discarded. Empty when `pattern === null` (those
   * families resolve via the `affiliations` facet, never via this
   * name-based cluster, because `detectBrand` skips them).
   */
  ilike: readonly string[];
}[] = [
  // ── International collections (ADR-0021 — added 2026-05-28) ────────────
  // Aman: 37 published hotels — pattern matches "Aman Tokyo", "Amanjena",
  // "Amanpuri", … but NOT unrelated names like "Hotel Amano" (anchored
  // at start of name + must be followed by uppercase word boundary or
  // another lowercase letter for the portmanteau form).
  { slug: 'aman', label: 'Aman', pattern: /^aman(\b|[a-z])/iu, ilike: ['aman*'] },
  { slug: 'belmond', label: 'Belmond', pattern: /\bbelmond\b/iu, ilike: ['*belmond*'] },
  { slug: 'six-senses', label: 'Six Senses', pattern: /six\s*senses/iu, ilike: ['*six*senses*'] },
  { slug: 'bulgari', label: 'Bulgari', pattern: /\bbulgari\b/iu, ilike: ['*bulgari*'] },
  {
    slug: 'auberge-resorts',
    label: 'Auberge Resorts Collection',
    pattern: /auberge\s*resorts/iu,
    ilike: ['*auberge*resorts*'],
  },
  // ── French + Asian author collections ──────────────────────────────────
  {
    slug: 'cheval-blanc',
    label: 'Cheval Blanc',
    pattern: /cheval\s*blanc/iu,
    ilike: ['*cheval*blanc*'],
  },
  { slug: 'airelles', label: 'Airelles', pattern: /\bairelles\b/iu, ilike: ['*airelles*'] },
  {
    slug: 'four-seasons',
    label: 'Four Seasons',
    pattern: /four\s*seasons/iu,
    ilike: ['*four*seasons*'],
  },
  { slug: 'rosewood', label: 'Rosewood', pattern: /\brosewood\b/iu, ilike: ['*rosewood*'] },
  { slug: 'raffles', label: 'Raffles', pattern: /\braffles\b/iu, ilike: ['*raffles*'] },
  { slug: 'peninsula', label: 'The Peninsula', pattern: /\bpeninsula\b/iu, ilike: ['*peninsula*'] },
  {
    slug: 'mandarin-oriental',
    label: 'Mandarin Oriental',
    pattern: /mandarin\s*oriental/iu,
    ilike: ['*mandarin*oriental*'],
  },
  { slug: 'shangri-la', label: 'Shangri-La', pattern: /shangri-?\s*la/iu, ilike: ['*shangri*la*'] },
  { slug: 'park-hyatt', label: 'Park Hyatt', pattern: /park\s*hyatt/iu, ilike: ['*park*hyatt*'] },
  {
    slug: 'oetker-collection',
    label: 'Oetker Collection',
    pattern: /(le\s*bristol|hôtel\s*du\s*cap|fouquet's|lapog[ée]e|l'apog[ée]e)/iu,
    ilike: ['*bristol*', '*hôtel*du*cap*', '*fouquet*', '*apogée*', '*apogee*'],
  },
  {
    slug: 'dorchester-collection',
    label: 'Dorchester Collection',
    pattern: /(le\s*meurice|plaza\s*ath[ée]n[ée]e)/iu,
    ilike: ['*meurice*', '*plaza*athénée*', '*plaza*athenee*'],
  },
  { slug: 'les-k2', label: 'Les K2 Collections', pattern: /\bk2\b/iu, ilike: ['*k2*'] },
  { slug: 'caudalie', label: 'Caudalie', pattern: /caudalie/iu, ilike: ['*caudalie*'] },
  // ── Major American/Middle-Eastern/Asian chains backfilled by migration
  //    0063 (`affiliations[].kind = 'brand'`). Order matters: narrower
  //    needles like `ritz-carlton-reserve` must precede `ritz-carlton`.
  // ── 2026-05-29 ───────────────────────────────────────────────────────
  {
    slug: 'ritz-carlton-reserve',
    label: 'The Ritz-Carlton Reserve',
    pattern: /ritz[.\s-]*carlton[.\s-]*reserve/iu,
    ilike: ['*ritz*carlton*reserve*'],
  },
  {
    slug: 'ritz-carlton',
    label: 'The Ritz-Carlton',
    pattern: /ritz[.\s-]*carlton/iu,
    ilike: ['*ritz*carlton*'],
  },
  { slug: 'st-regis', label: 'St. Regis', pattern: /\bst\.?\s*regis\b/iu, ilike: ['*st*regis*'] },
  {
    slug: 'waldorf-astoria',
    label: 'Waldorf Astoria',
    pattern: /waldorf[\s-]*astoria/iu,
    ilike: ['*waldorf*astoria*'],
  },
  { slug: 'fairmont', label: 'Fairmont', pattern: /\bfairmont\b/iu, ilike: ['*fairmont*'] },
  { slug: 'kempinski', label: 'Kempinski', pattern: /\bkempinski\b/iu, ilike: ['*kempinski*'] },
  { slug: 'anantara', label: 'Anantara', pattern: /\banantara\b/iu, ilike: ['*anantara*'] },
  { slug: 'jumeirah', label: 'Jumeirah', pattern: /\bjumeirah\b/iu, ilike: ['*jumeirah*'] },
  { slug: 'como', label: 'COMO Hotels', pattern: /\bcomo\b/iu, ilike: ['*como*'] },
  { slug: 'capella', label: 'Capella', pattern: /\bcapella\b/iu, ilike: ['*capella*'] },
  { slug: 'viceroy', label: 'Viceroy', pattern: /\bviceroy\b/iu, ilike: ['*viceroy*'] },
  { slug: 'soneva', label: 'Soneva', pattern: /\bsoneva\b/iu, ilike: ['*soneva*'] },
  { slug: 'nayara', label: 'Nayara', pattern: /\bnayara\b/iu, ilike: ['*nayara*'] },
  // No regex — name overlaps too easily with the English word "grace".
  // Resolved exclusively through the affiliations facet slug.
  { slug: 'grace-hotels', label: 'Grace Hotels', pattern: null, ilike: [] },
  // Alias of `dorchester-collection` written by migration 0063. The two
  // co-exist transitionally; the route handler treats them as synonyms.
  { slug: 'dorchester', label: 'Dorchester Collection', pattern: null, ilike: [] },
];

/**
 * Detects the editorial brand family for a hotel from its name.
 * Returns `null` when no family matches — independent properties
 * (Negresco, Lutetia, Crillon, Villa La Coste, etc.) stay un-clustered.
 *
 * Families with `pattern === null` are skipped (they rely on the
 * structured `affiliations[]` column instead).
 */
export function detectBrand(name: string): { slug: string; label: string } | null {
  for (const f of BRAND_FAMILIES) {
    if (f.pattern === null) continue;
    if (f.pattern.test(name)) return { slug: f.slug, label: f.label };
  }
  return null;
}

/**
 * Builds the PostgREST `.or(...)` expression that narrows a `hotels` query to
 * the rows whose `name` could belong to `brandSlug` — i.e. a DB-side superset
 * of `detectBrand`. Returns `null` when the brand has no name patterns (the
 * affiliation-only families), so the caller skips the name-based query.
 *
 * This is the cornerstone of the fix for the silently-empty "Autres {marque}"
 * block: the brand facet is filtered **in the database, over the whole
 * catalogue**, so siblings that sort past any global page boundary are never
 * dropped. The caller still runs `detectBrand` on the (small) result set to
 * strip ILIKE false positives.
 */
export function buildBrandNameOrFilter(brandSlug: string): string | null {
  const family = BRAND_FAMILIES.find((f) => f.slug === brandSlug);
  if (family === undefined || family.ilike.length === 0) return null;
  return family.ilike.map((p) => `name.ilike.${p}`).join(',');
}

/**
 * Transitional duplicate slugs that resolve to the SAME brand entity as a
 * canonical sibling (written by migration 0063). They stay in
 * `BRAND_FAMILIES` so affiliation/`detectBrand` resolution keeps treating
 * them as synonyms, but they must NOT be pre-rendered, sitemapped, or
 * indexed — `/marque/<alias>` 308-redirects to the canonical slug
 * (`next.config.ts`). Maps alias → canonical slug.
 */
export const BRAND_ALIAS_TO_CANONICAL: Readonly<Record<string, string>> = {
  dorchester: 'dorchester-collection',
};

export function isBrandAliasSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(BRAND_ALIAS_TO_CANONICAL, slug);
}

/**
 * All known brand families surfaced by the `/marque/[slug]` index —
 * **excluding** transitional alias slugs (`BRAND_ALIAS_TO_CANONICAL`) so a
 * single brand entity never produces two indexable URLs.
 */
export const KNOWN_BRANDS = BRAND_FAMILIES.filter((f) => !isBrandAliasSlug(f.slug)).map((f) => ({
  slug: f.slug,
  label: f.label,
}));

const RelatedHotelRowSchema = z.object({
  slug: z.string(),
  slug_en: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string(),
  // International hotels have NULL region (migration 0033). Coerce to empty
  // string so the existing UI (which treats region as `string`) keeps
  // working — the consumer falls back to country labels for non-FR hotels.
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  stars: z.number().int(),
  is_palace: z.boolean(),
  hero_image: z.string().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
});

export type RelatedHotelRow = z.infer<typeof RelatedHotelRowSchema>;

export interface RelatedHotelsBundle {
  /** Other Palaces in the same city, capped to 6. */
  readonly sameCity: readonly RelatedHotelRow[];
  /** Other published hotels within ~75 km when coordinates are known, capped to 6. */
  readonly nearby: readonly RelatedHotelRow[];
  /** Other Palaces in the same department (excluding `sameCity`), capped to 6. */
  readonly sameDepartment: readonly RelatedHotelRow[];
  /** Other hotels of the same brand family (same region when set), capped to {@link BRAND_CLUSTER_LIMIT}. */
  readonly sameBrand: readonly RelatedHotelRow[];
  /** Brand label + slug when the family was detected. */
  readonly brand: { readonly slug: string; readonly label: string } | null;
  /** Other Palaces in the same region (excluding `sameCity`), capped to 6. */
  readonly sameRegion: readonly RelatedHotelRow[];
}

/** Max great-circle distance for the proximity carousel (Les hôtes à proximité). */
const NEARBY_MAX_METERS = 75_000;
const NEARBY_CANDIDATE_LIMIT = 120;
const CLUSTER_LIMIT = 6;
/**
 * Brand cluster cap. Higher than the geographic clusters because "Autres
 * {marque}" is a strong internal-link / GEO signal (the whole collection),
 * and the DB now returns only true brand siblings — so a generous cap stays
 * cheap. Applied **after** the brand facet is filtered in the database.
 */
const BRAND_CLUSTER_LIMIT = 12;
/**
 * Hard ceiling on rows pulled for the brand candidate query before the
 * `detectBrand` confirmation pass. The largest published brand (Ritz-Carlton)
 * has ~104 siblings, so 300 comfortably covers every family while still being
 * a bounded read — the ILIKE filter already restricts the scan to the brand.
 */
const BRAND_CANDIDATE_LIMIT = 300;
const PROXIMITY_CARD_LIMIT = 3;

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function boundingBoxDeltas(
  latitude: number,
  radiusMeters: number,
): {
  readonly latDelta: number;
  readonly lonDelta: number;
} {
  const latDelta = radiusMeters / 111_000;
  const lonDelta = radiusMeters / (111_000 * Math.cos((latitude * Math.PI) / 180));
  return { latDelta, lonDelta };
}

/**
 * Picks geographically coherent cards for the proximity block (kit pilot +
 * any surface that needs "nearby", not brand-wide maillage).
 *
 * Priority: same city → distance-ranked nearby → same department → same region.
 * Brand siblings are intentionally excluded — they belong in a dedicated
 * "same collection" section, not under "Les hôtes à proximité".
 */
export function pickProximityCards(
  bundle: RelatedHotelsBundle,
  currentRegion: string,
  limit: number = PROXIMITY_CARD_LIMIT,
): readonly RelatedHotelRow[] {
  const region = currentRegion.trim();
  const pool = [
    ...bundle.sameCity,
    ...bundle.nearby,
    ...bundle.sameDepartment,
    ...(region !== ''
      ? bundle.sameRegion.filter((row) => row.region === '' || row.region === region)
      : bundle.sameRegion),
  ];
  const seen = new Set<string>();
  const out: RelatedHotelRow[] = [];
  for (const row of pool) {
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

const RELATED_COLUMNS =
  'slug, slug_en, name, name_en, city, region, stars, is_palace, hero_image, description_fr, description_en';

const RELATED_COLUMNS_WITH_GEO = `${RELATED_COLUMNS}, latitude, longitude`;

/**
 * Fetches the related-hotels bundle for the maillage interne (skill:
 * seo-technical §Maillage). One query per cluster — every facet (city,
 * department, region, brand) is filtered **in the database** before any
 * `.limit(...)` cap, so no cluster can be silently emptied by a global
 * row cap. Each query is cached implicitly by Next.js because the helper
 * is called from a Server Component on an ISR route.
 *
 * Self is always excluded.
 */
export async function getRelatedHotels(args: {
  readonly currentSlug: string;
  readonly city: string;
  readonly region: string;
  readonly name: string;
  readonly department?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
}): Promise<RelatedHotelsBundle> {
  const supabase = getSupabaseAdminClient();
  const brand = detectBrand(args.name);
  const department = args.department?.trim() ?? '';
  const anchorLat = args.latitude ?? null;
  const anchorLon = args.longitude ?? null;

  // 1. Same city — ordered by `priority` then `name` for stable output.
  const cityRes = await supabase
    .from('hotels')
    .select(RELATED_COLUMNS)
    .eq('is_published', true)
    .eq('city', args.city)
    .neq('slug', args.currentSlug)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .limit(CLUSTER_LIMIT);

  // 2. Same department (excluding the current city to keep clusters distinct).
  const departmentRes =
    department !== ''
      ? await supabase
          .from('hotels')
          .select(RELATED_COLUMNS)
          .eq('is_published', true)
          .eq('department', department)
          .neq('city', args.city)
          .neq('slug', args.currentSlug)
          .order('priority', { ascending: true })
          .order('name', { ascending: true })
          .limit(CLUSTER_LIMIT)
      : { data: [] as unknown[] };

  // 3. Same region (excluding the current city to keep clusters distinct).
  const regionRes =
    args.region.trim() !== ''
      ? await supabase
          .from('hotels')
          .select(RELATED_COLUMNS)
          .eq('is_published', true)
          .eq('region', args.region)
          .neq('city', args.city)
          .neq('slug', args.currentSlug)
          .order('priority', { ascending: true })
          .order('name', { ascending: true })
          .limit(CLUSTER_LIMIT)
      : { data: [] as unknown[] };

  // 4. Distance-ranked nearby — bounding-box pre-filter, haversine sort in memory.
  const nearby: RelatedHotelRow[] = [];
  if (anchorLat !== null && anchorLon !== null) {
    const { latDelta, lonDelta } = boundingBoxDeltas(anchorLat, NEARBY_MAX_METERS);
    const nearbyRes = await supabase
      .from('hotels')
      .select(RELATED_COLUMNS_WITH_GEO)
      .eq('is_published', true)
      .neq('slug', args.currentSlug)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', anchorLat - latDelta)
      .lte('latitude', anchorLat + latDelta)
      .gte('longitude', anchorLon - lonDelta)
      .lte('longitude', anchorLon + lonDelta)
      .limit(NEARBY_CANDIDATE_LIMIT);

    const ranked: { row: RelatedHotelRow; distanceMeters: number }[] = [];
    for (const raw of nearbyRes.data ?? []) {
      const record = raw as Record<string, unknown>;
      const lat = parseCoordinate(record['latitude']);
      const lon = parseCoordinate(record['longitude']);
      if (lat === null || lon === null) continue;
      const parsed = RelatedHotelRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const distanceMeters = haversineMeters(anchorLat, anchorLon, lat, lon);
      if (distanceMeters > NEARBY_MAX_METERS) continue;
      ranked.push({ row: parsed.data, distanceMeters });
    }
    ranked.sort(
      (a, b) => a.distanceMeters - b.distanceMeters || a.row.name.localeCompare(b.row.name, 'fr'),
    );
    for (const item of ranked) {
      nearby.push(item.row);
      if (nearby.length >= CLUSTER_LIMIT) break;
    }
  }

  // 5. Same brand — the brand facet is filtered **in the database** via an
  //    ILIKE superset of the brand name pattern (see `buildBrandNameOrFilter`),
  //    NOT by paging the whole catalogue with a global `.limit(N)` and
  //    filtering in memory. The old approach silently dropped every brand
  //    whose first sibling sorts past row N (Aman=109, Ritz-Carlton=390,
  //    St. Regis=2436 over 2 219 published rows), so "Autres {marque}" was
  //    empty for almost every brand. We now cap **after** the brand filter.
  //    When the current hotel carries an admin region, brand siblings outside
  //    that region are excluded (e.g. Courchevel must not surface for Gordes);
  //    international brands have an empty region so the filter is a no-op and
  //    worldwide siblings surface. `detectBrand` re-confirms each row to drop
  //    ILIKE false positives.
  const sameBrand: RelatedHotelRow[] = [];
  const brandOrFilter = brand !== null ? buildBrandNameOrFilter(brand.slug) : null;
  if (brand !== null && brandOrFilter !== null) {
    const regionFilter = args.region.trim();
    let brandQuery = supabase
      .from('hotels')
      .select(RELATED_COLUMNS)
      .eq('is_published', true)
      .neq('slug', args.currentSlug)
      .or(brandOrFilter);
    if (regionFilter !== '') {
      brandQuery = brandQuery.eq('region', regionFilter);
    }
    const brandRes = await brandQuery
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(BRAND_CANDIDATE_LIMIT);
    const data = brandRes.data ?? [];
    for (const row of data) {
      const parsed = RelatedHotelRowSchema.safeParse(row);
      if (!parsed.success) continue;
      const detected = detectBrand(parsed.data.name);
      if (detected !== null && detected.slug === brand.slug) {
        sameBrand.push(parsed.data);
        if (sameBrand.length >= BRAND_CLUSTER_LIMIT) break;
      }
    }
  }

  const parseList = (raw: unknown): RelatedHotelRow[] => {
    if (!Array.isArray(raw)) return [];
    const out: RelatedHotelRow[] = [];
    for (const r of raw) {
      const p = RelatedHotelRowSchema.safeParse(r);
      if (p.success) out.push(p.data);
    }
    return out;
  };

  return {
    sameCity: parseList(cityRes.data),
    nearby,
    sameDepartment: parseList(departmentRes.data),
    sameBrand,
    brand,
    sameRegion: parseList(regionRes.data),
  };
}
