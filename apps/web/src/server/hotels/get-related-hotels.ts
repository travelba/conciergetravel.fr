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
}[] = [
  // ── International collections (ADR-0021 — added 2026-05-28) ────────────
  // Aman: 37 published hotels — pattern matches "Aman Tokyo", "Amanjena",
  // "Amanpuri", … but NOT unrelated names like "Hotel Amano" (anchored
  // at start of name + must be followed by uppercase word boundary or
  // another lowercase letter for the portmanteau form).
  { slug: 'aman', label: 'Aman', pattern: /^aman(\b|[a-z])/iu },
  { slug: 'belmond', label: 'Belmond', pattern: /\bbelmond\b/iu },
  { slug: 'six-senses', label: 'Six Senses', pattern: /six\s*senses/iu },
  { slug: 'bulgari', label: 'Bulgari', pattern: /\bbulgari\b/iu },
  {
    slug: 'auberge-resorts',
    label: 'Auberge Resorts Collection',
    pattern: /auberge\s*resorts/iu,
  },
  // ── French + Asian author collections ──────────────────────────────────
  { slug: 'cheval-blanc', label: 'Cheval Blanc', pattern: /cheval\s*blanc/iu },
  { slug: 'airelles', label: 'Airelles', pattern: /\bairelles\b/iu },
  { slug: 'four-seasons', label: 'Four Seasons', pattern: /four\s*seasons/iu },
  { slug: 'rosewood', label: 'Rosewood', pattern: /\brosewood\b/iu },
  { slug: 'raffles', label: 'Raffles', pattern: /\braffles\b/iu },
  { slug: 'peninsula', label: 'The Peninsula', pattern: /\bpeninsula\b/iu },
  { slug: 'mandarin-oriental', label: 'Mandarin Oriental', pattern: /mandarin\s*oriental/iu },
  { slug: 'shangri-la', label: 'Shangri-La', pattern: /shangri-?\s*la/iu },
  { slug: 'park-hyatt', label: 'Park Hyatt', pattern: /park\s*hyatt/iu },
  {
    slug: 'oetker-collection',
    label: 'Oetker Collection',
    pattern: /(le\s*bristol|hôtel\s*du\s*cap|fouquet's|lapog[ée]e|l'apog[ée]e)/iu,
  },
  {
    slug: 'dorchester-collection',
    label: 'Dorchester Collection',
    pattern: /(le\s*meurice|plaza\s*ath[ée]n[ée]e)/iu,
  },
  { slug: 'les-k2', label: 'Les K2 Collections', pattern: /\bk2\b/iu },
  { slug: 'caudalie', label: 'Caudalie', pattern: /caudalie/iu },
  // ── Major American/Middle-Eastern/Asian chains backfilled by migration
  //    0063 (`affiliations[].kind = 'brand'`). Order matters: narrower
  //    needles like `ritz-carlton-reserve` must precede `ritz-carlton`.
  // ── 2026-05-29 ───────────────────────────────────────────────────────
  {
    slug: 'ritz-carlton-reserve',
    label: 'The Ritz-Carlton Reserve',
    pattern: /ritz[.\s-]*carlton[.\s-]*reserve/iu,
  },
  { slug: 'ritz-carlton', label: 'The Ritz-Carlton', pattern: /ritz[.\s-]*carlton/iu },
  { slug: 'st-regis', label: 'St. Regis', pattern: /\bst\.?\s*regis\b/iu },
  { slug: 'waldorf-astoria', label: 'Waldorf Astoria', pattern: /waldorf[\s-]*astoria/iu },
  { slug: 'fairmont', label: 'Fairmont', pattern: /\bfairmont\b/iu },
  { slug: 'kempinski', label: 'Kempinski', pattern: /\bkempinski\b/iu },
  { slug: 'anantara', label: 'Anantara', pattern: /\banantara\b/iu },
  { slug: 'jumeirah', label: 'Jumeirah', pattern: /\bjumeirah\b/iu },
  { slug: 'como', label: 'COMO Hotels', pattern: /\bcomo\b/iu },
  { slug: 'capella', label: 'Capella', pattern: /\bcapella\b/iu },
  { slug: 'viceroy', label: 'Viceroy', pattern: /\bviceroy\b/iu },
  { slug: 'soneva', label: 'Soneva', pattern: /\bsoneva\b/iu },
  { slug: 'nayara', label: 'Nayara', pattern: /\bnayara\b/iu },
  // No regex — name overlaps too easily with the English word "grace".
  // Resolved exclusively through the affiliations facet slug.
  { slug: 'grace-hotels', label: 'Grace Hotels', pattern: null },
  // Alias of `dorchester-collection` written by migration 0063. The two
  // co-exist transitionally; the route handler treats them as synonyms.
  { slug: 'dorchester', label: 'Dorchester Collection', pattern: null },
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

/** All known brand families — surfaced by the `/marque/[slug]` index. */
export const KNOWN_BRANDS = BRAND_FAMILIES.map((f) => ({ slug: f.slug, label: f.label }));

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
  /** Other Palaces of the same brand family (same region when set), capped to 6. */
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
 * seo-technical §Maillage). One query per cluster (city, region) plus
 * one in-memory brand filter — at most three Supabase round-trips,
 * cached implicitly by Next.js because the helper is called from a
 * Server Component on an ISR route.
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

  // 5. Same brand — published catalog filtered in memory. When the current
  //    hotel carries an admin region, brand siblings outside that region are
  //    excluded (e.g. Courchevel must not surface for Gordes).
  const sameBrand: RelatedHotelRow[] = [];
  if (brand !== null) {
    const brandRes = await supabase
      .from('hotels')
      .select(RELATED_COLUMNS)
      .eq('is_published', true)
      .neq('slug', args.currentSlug)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(100);
    const data = brandRes.data ?? [];
    const regionFilter = args.region.trim();
    for (const row of data) {
      const parsed = RelatedHotelRowSchema.safeParse(row);
      if (!parsed.success) continue;
      if (regionFilter !== '' && parsed.data.region !== regionFilter) continue;
      const detected = detectBrand(parsed.data.name);
      if (detected !== null && detected.slug === brand.slug) {
        sameBrand.push(parsed.data);
        if (sameBrand.length >= CLUSTER_LIMIT) break;
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
