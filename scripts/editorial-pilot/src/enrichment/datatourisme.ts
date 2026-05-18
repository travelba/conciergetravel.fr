/**
 * DATAtourisme API client.
 *
 * Public REST API at https://api.datatourisme.fr/v1 with JSON-LD payloads.
 * Quotas: ~10 req/s, 1000 req/h, 20-30 concurrent.
 * Doc: https://api.datatourisme.fr/v1/docs
 *
 * Exposes three high-level functions:
 *   - findHotelByName(query)       : fuzzy text search, hotel-typed only
 *   - fetchHotelByUuid(uuid)       : full structured hotel record
 *   - fetchPOIsAround(lat, lon, …) : nearby relevant tourist POIs
 *
 * All responses are validated through Zod and returned as plain TS types.
 */

import { z } from 'zod';
import { loadEnv } from '../env.js';

// ─── Public types ──────────────────────────────────────────────────────────

export interface DtClassification {
  readonly isPalace: boolean;
  readonly stars: number | null;
}

export interface DtContact {
  readonly website: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface DtLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly streetAddress: string;
  readonly postalCode: string;
  readonly city: string;
  readonly department: string;
  readonly region: string;
  readonly country: string;
}

export interface DtHotel {
  readonly uuid: string;
  readonly uri: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly location: DtLocation;
  readonly contact: DtContact;
  readonly descriptionShort: string | null;
  readonly descriptionLong: string | null;
  readonly classification: DtClassification;
  readonly lastUpdate: string;
}

/**
 * Bucket = the editorial section the POI will appear under on the
 * hotel detail page (`HotelLocation` component):
 *   - `visit` : "Choses à visiter" — patrimony, culture
 *   - `do`    : "Choses à faire" — outdoor, leisure, food experiences
 *   - `shop`  : "Commerces utiles" — daily-life amenities (DATAtourisme
 *               coverage is sparse here; the orchestrator complements
 *               with Overpass OSM data — see `@mch/integrations/overpass`)
 */
export type DtPoiBucket = 'visit' | 'do' | 'shop';

/**
 * Fine-grained category for UI grouping + Schema.org JSON-LD mapping.
 * `other` is the catch-all surfaced by the curator when no specific
 * category fits but the POI is still tourism-relevant.
 */
export type DtPoiCategory =
  | 'museum'
  | 'cultural'
  | 'religious'
  | 'theater'
  | 'building'
  | 'castle'
  | 'memorial'
  | 'park'
  | 'beach'
  | 'trail'
  | 'viewpoint'
  | 'winery'
  | 'sports'
  | 'restaurant'
  | 'store'
  | 'other';

export interface DtPoi {
  readonly uuid: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly bucket: DtPoiBucket;
  readonly category: DtPoiCategory;
  readonly distanceMeters: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly descriptionShort: string | null;
}

// ─── Zod schemas (lenient — DATAtourisme returns variable shapes) ──────────

const Multilingual = z.union([
  z.string(),
  z.record(z.string(), z.union([z.string(), z.array(z.string())])),
]);

const StringOrStringArray = z.union([z.string(), z.array(z.string())]);

const AddressSchema = z
  .object({
    streetAddress: StringOrStringArray.optional(),
    postalCode: z.string().optional(),
    addressLocality: z.string().optional(),
    hasAddressCity: z
      .object({
        label: Multilingual.optional(),
        isPartOfDepartment: z
          .object({
            label: Multilingual.optional(),
            isPartOfRegion: z
              .object({
                label: Multilingual.optional(),
                isPartOfCountry: z.object({ label: Multilingual.optional() }).partial().optional(),
              })
              .partial()
              .optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

const IsLocatedAtSchema = z.object({
  geo: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  geoPoint: z.object({ lat: z.number(), lon: z.number() }).optional(),
  address: z.array(AddressSchema).optional(),
});

const HasContactSchema = z
  .object({
    homepage: StringOrStringArray.optional(),
    telephone: StringOrStringArray.optional(),
    email: StringOrStringArray.optional(),
  })
  .partial();

const HasDescriptionSchema = z
  .object({
    description: Multilingual.optional(),
    shortDescription: Multilingual.optional(),
  })
  .partial();

const HasReviewSchema = z
  .object({
    hasReviewValue: z
      .object({
        key: z.string().optional(),
        label: Multilingual.optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

const PoiObjectSchema = z
  .object({
    uuid: z.string(),
    uri: z.string().optional(),
    label: Multilingual.optional(),
    type: z.array(z.string()).optional(),
    isLocatedAt: z.array(IsLocatedAtSchema).optional(),
    hasContact: z.array(HasContactSchema).optional(),
    hasDescription: z.array(HasDescriptionSchema).optional(),
    hasReview: z.array(HasReviewSchema).optional(),
    lastUpdate: z.string().optional(),
  })
  .passthrough();

const CatalogResponseSchema = z.object({
  objects: z.array(PoiObjectSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
  }),
});

type PoiObject = z.infer<typeof PoiObjectSchema>;

// ─── Helpers (multilingual / array normalisation) ──────────────────────────

function firstString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = firstString(item);
      if (r !== null) return r;
    }
    return null;
  }
  return null;
}

function localized(v: unknown, prefer: 'fr' | 'en' = 'fr'): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const item of v) {
      const r = localized(item, prefer);
      if (r !== null) return r;
    }
    return null;
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const candidates = [
      `@${prefer}`,
      prefer,
      prefer === 'fr' ? '@en' : '@fr',
      prefer === 'fr' ? 'en' : 'fr',
    ];
    for (const k of candidates) {
      if (typeof obj[k] === 'string') return obj[k] as string;
      if (Array.isArray(obj[k])) {
        const first = (obj[k] as unknown[])[0];
        if (typeof first === 'string') return first;
      }
    }
  }
  return null;
}

// ─── Low-level fetch ───────────────────────────────────────────────────────

const env = loadEnv();
const API_KEY = env.DATATOURISME_API_KEY;
const API_BASE = env.DATATOURISME_API_BASE;

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      '[datatourisme] DATATOURISME_API_KEY is missing. Get one at https://info.datatourisme.fr/utiliser-les-donnees',
    );
  }
  return API_KEY;
}

async function dtFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const key = requireKey();
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-API-Key': key, Accept: 'application/json' },
      });
      if (res.ok) return await res.json();
      // Retry on 429 / 5xx, fail fast otherwise
      if (res.status >= 500 || res.status === 429) {
        const body = await res.text();
        lastError = new Error(
          `DATAtourisme ${res.status} on ${url.pathname}: ${body.slice(0, 200)}`,
        );
        await sleep(500 * attempt);
        continue;
      }
      const body = await res.text();
      throw new Error(`DATAtourisme ${res.status} on ${url.pathname}: ${body.slice(0, 500)}`);
    } catch (e) {
      lastError = e as Error;
      if (attempt < 3) await sleep(500 * attempt);
    }
  }
  throw lastError ?? new Error('DATAtourisme: unknown error');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Public API ────────────────────────────────────────────────────────────

const HOTEL_TYPE_FILTER = 'type[in]=Hotel,HotelTrade,LodgingBusiness,Accommodation';

/**
 * Fuzzy search a hotel by name (text + Paris dept filter if dept provided).
 * Returns up to `limit` candidates sorted by name match heuristic.
 */
export async function findHotelByName(
  query: string,
  opts: { departmentInsee?: string; limit?: number } = {},
): Promise<readonly DtHotel[]> {
  const limit = opts.limit ?? 10;
  const filters: string[] = [HOTEL_TYPE_FILTER];
  if (opts.departmentInsee) {
    filters.push(
      `isLocatedAt.address.hasAddressCity.isPartOfDepartment.insee[eq]=${opts.departmentInsee}`,
    );
  }
  const raw = await dtFetch('/catalog', {
    search: `"${query}"`,
    filters: filters.join(' AND '),
    page_size: String(Math.min(limit * 2, 50)),
    lang: 'fr,en',
  });
  const parsed = CatalogResponseSchema.parse(raw);
  const hotels = parsed.objects.flatMap((o) => normalizeHotel(o) ?? []);
  // Heuristic: prefer exact substring match in name
  const ranked = hotels
    .map((h) => ({
      h,
      score: scoreNameMatch(h.name, query) + (h.classification.isPalace ? 5 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.h);
  return ranked.slice(0, limit);
}

/**
 * Paginated listing of every accommodation in a French département.
 * Used by `list-all-palaces.ts` to enumerate the full hotel catalog and
 * filter Palaces code-side, since DATAtourisme's review-URI filter syntax
 * for nested values is undocumented.
 */
export async function listHotelsInDepartment(
  departmentInsee: string,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<readonly DtHotel[]> {
  const pageSize = Math.min(opts.pageSize ?? 250, 250);
  const maxPages = opts.maxPages ?? 20;
  const filters = [
    HOTEL_TYPE_FILTER,
    `isLocatedAt.address.hasAddressCity.isPartOfDepartment.insee[eq]=${departmentInsee}`,
  ].join(' AND ');
  const all: DtHotel[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const raw = await dtFetch('/catalog', {
      filters,
      page_size: String(pageSize),
      page: String(page),
      lang: 'fr,en',
    });
    const parsed = CatalogResponseSchema.parse(raw);
    const hotels = parsed.objects.flatMap((o) => normalizeHotel(o) ?? []);
    all.push(...hotels);
    if (hotels.length < pageSize) break;
  }
  // Dedupe by UUID (paginated results occasionally repeat boundary items).
  const map = new Map<string, DtHotel>();
  for (const h of all) if (!map.has(h.uuid)) map.set(h.uuid, h);
  return [...map.values()];
}

export async function fetchHotelByUuid(uuid: string): Promise<DtHotel> {
  const fields = [
    'uuid',
    'uri',
    'label',
    'type',
    'isLocatedAt',
    'hasContact',
    'hasDescription',
    'hasReview',
    'lastUpdate',
  ].join(',');
  const raw = await dtFetch(`/catalog/${uuid}`, { fields, lang: 'fr,en' });
  const parsed = PoiObjectSchema.parse(raw);
  const hotel = normalizeHotel(parsed);
  if (!hotel) {
    throw new Error(
      `[datatourisme] fetchHotelByUuid(${uuid}): cannot normalize, missing critical fields`,
    );
  }
  return hotel;
}

/**
 * Fetch tourist POIs around a hotel. Returns a curated, deduplicated,
 * ranked list bucketed by editorial section (visit / do / shop).
 *
 * Filtering policy:
 *   - exclude competing hotels / lodging (`Hotel`, `HotelTrade`, `LodgingBusiness`)
 *   - keep `Store` ONLY when classified under `shop` (we then prefer
 *     Overpass OSM for daily-life amenities since DATAtourisme is sparse there)
 *   - bucket cap: max 8 visit, 6 do, 5 shop per hotel (configurable)
 *
 * The `radius` arg used to be a single number; it is now an object
 * with one entry per bucket so urban Palaces (Paris, Nice) can use
 * tight 500m / 1500m / 2000m radii while alpine Palaces (Courchevel,
 * Megève) get loose 1500m / 5000m / 10000m radii. Callers that pass
 * a flat number get the same value applied to all three buckets
 * (back-compat).
 */
export interface FetchPoisRadii {
  readonly visit: number;
  readonly do: number;
  readonly shop: number;
}

export interface FetchPoisCaps {
  readonly visit: number;
  readonly do: number;
  readonly shop: number;
}

export const DEFAULT_RADII_URBAN: FetchPoisRadii = { visit: 1500, do: 2000, shop: 500 };
export const DEFAULT_RADII_RURAL: FetchPoisRadii = { visit: 5000, do: 10_000, shop: 1500 };
export const DEFAULT_CAPS: FetchPoisCaps = { visit: 8, do: 6, shop: 5 };

export async function fetchPOIsAround(
  latitude: number,
  longitude: number,
  opts: {
    radiusMeters?: number | FetchPoisRadii;
    excludeUuid?: string;
    limit?: number;
    caps?: FetchPoisCaps;
  } = {},
): Promise<readonly DtPoi[]> {
  const limit = opts.limit ?? 80;
  const caps = opts.caps ?? DEFAULT_CAPS;

  // Resolve the per-bucket radii. We use the largest radius to fetch
  // once, then filter per bucket in `curatePoiSelection`. This avoids
  // three round-trips to DATAtourisme (saves quota, reduces latency).
  const radii: FetchPoisRadii =
    typeof opts.radiusMeters === 'number'
      ? { visit: opts.radiusMeters, do: opts.radiusMeters, shop: opts.radiusMeters }
      : (opts.radiusMeters ?? DEFAULT_RADII_URBAN);
  const maxRadius = Math.max(radii.visit, radii.do, radii.shop);

  const filters: string[] = [];
  if (opts.excludeUuid) filters.push(`uuid[ne]=${opts.excludeUuid}`);

  const raw = await dtFetch('/catalog', {
    geo_distance: `${latitude},${longitude},${maxRadius}m`,
    ...(filters.length > 0 ? { filters: filters.join(' AND ') } : {}),
    page_size: String(Math.min(limit, 250)),
    lang: 'fr,en',
  });
  const parsed = CatalogResponseSchema.parse(raw);
  const pois = parsed.objects.flatMap((o) => normalizePoi(o, latitude, longitude) ?? []);
  return curatePoiSelection(pois, radii, caps);
}

// ─── Normalization (PoiObject → DtHotel / DtPoi) ───────────────────────────

function normalizeHotel(o: PoiObject): DtHotel | null {
  const types = o.type ?? [];
  const isHotel = types.some((t) => /Hotel|Lodging|Accommodation/iu.test(t));
  if (!isHotel) return null;

  const name = localized(o.label);
  if (!name) return null;

  const loc = o.isLocatedAt?.[0];
  if (!loc) return null;

  const lat = loc.geo?.latitude ?? loc.geoPoint?.lat;
  const lon = loc.geo?.longitude ?? loc.geoPoint?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const addr = loc.address?.[0];
  const street = firstString(addr?.streetAddress) ?? '';
  const postal = addr?.postalCode ?? '';
  const city = addr?.addressLocality ?? localized(addr?.hasAddressCity?.label) ?? '';
  const department = localized(addr?.hasAddressCity?.isPartOfDepartment?.label) ?? '';
  const region = localized(addr?.hasAddressCity?.isPartOfDepartment?.isPartOfRegion?.label) ?? '';
  const country =
    localized(addr?.hasAddressCity?.isPartOfDepartment?.isPartOfRegion?.isPartOfCountry?.label) ??
    'France';

  const contact = o.hasContact?.[0];
  const website = firstString(contact?.homepage);
  const phone = firstString(contact?.telephone);
  const email = firstString(contact?.email);

  const descShort = localized(o.hasDescription?.[0]?.shortDescription);
  const descLong = localized(o.hasDescription?.[0]?.description);

  const reviews = o.hasReview ?? [];
  const isPalace = reviews.some((r) => r.hasReviewValue?.key === 'LabelRating_Palace');
  const stars = extractStars(reviews);

  return {
    uuid: o.uuid,
    uri: o.uri ?? '',
    name,
    types,
    location: {
      latitude: lat,
      longitude: lon,
      streetAddress: street,
      postalCode: postal,
      city,
      department,
      region,
      country,
    },
    contact: { website, phone, email },
    descriptionShort: descShort,
    descriptionLong: descLong,
    classification: { isPalace, stars },
    lastUpdate: o.lastUpdate ?? '',
  };
}

function extractStars(reviews: ReadonlyArray<z.infer<typeof HasReviewSchema>>): number | null {
  for (const r of reviews) {
    const key = r.hasReviewValue?.key;
    if (!key) continue;
    const m = /^ScaleRating_(\d)etoile/u.exec(key);
    if (m && m[1]) return Number(m[1]);
  }
  return null;
}

function normalizePoi(o: PoiObject, originLat: number, originLon: number): DtPoi | null {
  const name = localized(o.label);
  if (!name) return null;
  const loc = o.isLocatedAt?.[0];
  const lat = loc?.geo?.latitude ?? loc?.geoPoint?.lat;
  const lon = loc?.geo?.longitude ?? loc?.geoPoint?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const types = o.type ?? [];
  const classification = classifyPoi(types);
  if (classification === null) return null;

  const description = localized(o.hasDescription?.[0]?.shortDescription);
  const dist = haversineMeters(originLat, originLon, lat, lon);

  return {
    uuid: o.uuid,
    name,
    types,
    bucket: classification.bucket,
    category: classification.category,
    distanceMeters: Math.round(dist),
    latitude: lat,
    longitude: lon,
    descriptionShort: description,
  };
}

interface PoiClassification {
  readonly bucket: DtPoiBucket;
  readonly category: DtPoiCategory;
}

/**
 * Map a DATAtourisme EDT type set to one of our 3 editorial buckets +
 * a fine-grained category. Returns null when the POI is irrelevant
 * for hotel guests (competing hotels, sound equipment rentals, etc.).
 *
 * Bucket assignment:
 *   - `visit` = patrimony, culture, heritage          (high editorial value)
 *   - `do`    = outdoor activities, leisure, food     (experiential)
 *   - `shop`  = daily-life amenities                  (utilitarian)
 *
 * The match order matters: a `Castle` that's also a `Museum` should
 * land in `visit/castle`, not `visit/museum`. We test the most
 * specific types first.
 */
function classifyPoi(types: readonly string[]): PoiClassification | null {
  // Exclusions — competing lodging never appears, regardless of other tags.
  const competingLodging = ['Hotel', 'HotelTrade', 'LodgingBusiness', 'Accommodation', 'Camping'];
  if (types.some((t) => competingLodging.includes(t))) {
    // Allow if explicitly also Restaurant (some restaurants register as
    // `Hotel-Restaurant` when serving on-site).
    if (!types.includes('Restaurant') && !types.includes('GourmetRestaurant')) return null;
  }

  // ── VISIT bucket — patrimony & culture ────────────────────────────
  if (types.includes('Castle') || types.includes('CastleAndFort')) {
    return { bucket: 'visit', category: 'castle' };
  }
  if (types.includes('MemorialSite') || types.includes('CommemorativeSite')) {
    return { bucket: 'visit', category: 'memorial' };
  }
  if (types.includes('Museum')) {
    return { bucket: 'visit', category: 'museum' };
  }
  if (types.includes('RemarkableBuilding') || types.includes('CivilSite')) {
    return { bucket: 'visit', category: 'building' };
  }
  if (types.includes('ReligiousSite')) {
    return { bucket: 'visit', category: 'religious' };
  }
  if (types.includes('Theater')) {
    return { bucket: 'visit', category: 'theater' };
  }
  if (types.includes('CulturalSite') || types.includes('ArchaeologicalSite')) {
    return { bucket: 'visit', category: 'cultural' };
  }

  // ── DO bucket — experiences ───────────────────────────────────────
  if (types.includes('Viewpoint') || types.includes('PanoramicSite')) {
    return { bucket: 'do', category: 'viewpoint' };
  }
  if (types.includes('BeachAndPool') || types.includes('Beach')) {
    return { bucket: 'do', category: 'beach' };
  }
  if (
    types.includes('Trail') ||
    types.includes('HikingTrail') ||
    types.includes('BikeTrail') ||
    types.includes('Tour')
  ) {
    return { bucket: 'do', category: 'trail' };
  }
  if (
    types.includes('WineryAndAlcohol') ||
    types.includes('WineCellar') ||
    types.includes('Vineyard')
  ) {
    return { bucket: 'do', category: 'winery' };
  }
  if (
    types.includes('SportsAndLeisureActivity') ||
    types.includes('SkiArea') ||
    types.includes('GolfCourse')
  ) {
    return { bucket: 'do', category: 'sports' };
  }
  if (types.includes('Park') || types.includes('ParkAndGarden')) {
    return { bucket: 'do', category: 'park' };
  }
  if (types.includes('GourmetRestaurant') || types.includes('Restaurant')) {
    return { bucket: 'do', category: 'restaurant' };
  }

  // ── SHOP bucket — daily-life amenities (sparse in DATAtourisme) ───
  if (
    types.includes('Store') ||
    types.includes('ConvenienceStore') ||
    types.includes('FoodEstablishment')
  ) {
    return { bucket: 'shop', category: 'store' };
  }

  // Unknown type — drop. We deliberately do NOT have a catch-all
  // `other` bucket: better to under-report than to surface random
  // EDT entries (e.g. a 30-year-old benchmark dataset of campsites).
  return null;
}

/**
 * Per-bucket curated selection.
 *
 * For each bucket:
 *   - filter to POIs assigned to that bucket
 *   - filter to POIs within the bucket-specific radius
 *   - sort by distance asc
 *   - cap at the bucket's max
 *
 * Then concatenate in editorial priority: visit → do → shop. The
 * orchestrator (sync-hotel-pois) preserves this order so the front-end
 * already gets a sensible default ordering even before bucket-aware UI.
 */
function curatePoiSelection(
  pois: readonly DtPoi[],
  radii: FetchPoisRadii,
  caps: FetchPoisCaps,
): readonly DtPoi[] {
  const buckets: readonly DtPoiBucket[] = ['visit', 'do', 'shop'];
  const out: DtPoi[] = [];
  for (const bucket of buckets) {
    const radius = radii[bucket];
    const cap = caps[bucket];
    const items = pois
      .filter((p) => p.bucket === bucket && p.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, cap);
    out.push(...items);
  }
  return out;
}

function scoreNameMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 100;
  if (n.includes(q)) return 50;
  const qTokens = q.split(/\s+/u).filter((t) => t.length > 2);
  const matched = qTokens.filter((t) => n.includes(t)).length;
  return matched * 5;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS — upcoming local events around a hotel (CDC §2 bloc "À proximité")
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Editorial bucket for the "Que se passe-t-il pendant votre séjour ?"
 * block on the hotel detail page.
 *
 * Mapped to a Schema.org `Event` subclass in `packages/seo/jsonld/event.ts`:
 *   concert → MusicEvent
 *   expo    → ExhibitionEvent
 *   festival→ Festival
 *   sport   → SportsEvent
 *   theater → TheaterEvent
 *   other   → Event (generic)
 */
export type DtEventCategory =
  | 'concert'
  | 'expo'
  | 'festival'
  | 'sport'
  | 'theater'
  | 'other';

export interface DtEventPricing {
  readonly type: 'free' | 'paid';
  readonly amountEur: number | null;
}

export interface DtEvent {
  readonly uuid: string;
  readonly name: string;
  readonly types: readonly string[];
  readonly category: DtEventCategory;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string | null; // YYYY-MM-DD, optional
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly distanceMeters: number;
  readonly descriptionShort: string | null;
  readonly officialUrl: string | null;
  readonly pricing: DtEventPricing | null;
}

// ─── Event Zod schema (permissive — DT shapes vary by region/owner) ────────

/**
 * DATAtourisme returns dates as either:
 *   - `"2026-05-15"` plain ISO date
 *   - `"2026-05-15T20:00:00+02:00"` full datetime
 *   - sometimes as a `{ "@value": "..." }` shape inside arrays
 * We tolerate all three and normalise to `YYYY-MM-DD`.
 */
const DateString = z.union([
  z.string(),
  z.object({ '@value': z.string() }).transform((o) => o['@value']),
  z.array(z.union([z.string(), z.object({ '@value': z.string() })])).transform((arr) => {
    for (const it of arr) {
      if (typeof it === 'string') return it;
      if (typeof it === 'object' && it !== null && '@value' in it) return it['@value'];
    }
    return '';
  }),
]);

/**
 * DT events store the actual run dates in `takesPlaceAt[*]` (a list
 * of occurrences) — NOT in a top-level `startDate/endDate`. We
 * tolerate the convention of swapped dates (some feeds publish
 * `startDate > endDate` when they mean "season runs from Nov to May
 * of next year" — unintuitive but consistent in their data).
 */
const TakesPlaceAtSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .passthrough();

/**
 * `offers[].priceSpecification[].minPrice[]` is the canonical price
 * surface. `minPrice` is an array (DT models "from X €" as a list
 * with one element). We pluck the first.
 */
const PriceSpecificationSchema = z
  .object({
    minPrice: z.array(z.number()).optional(),
    maxPrice: z.array(z.number()).optional(),
    priceCurrency: z.string().optional(),
  })
  .passthrough();
const OffersEntrySchema = z
  .object({
    priceSpecification: z.array(PriceSpecificationSchema).optional(),
  })
  .passthrough();

const EventObjectSchema = z
  .object({
    uuid: z.string(),
    uri: z.string().optional(),
    label: Multilingual.optional(),
    type: z.array(z.string()).optional(),
    isLocatedAt: z.array(IsLocatedAtSchema).optional(),
    hasContact: z.array(HasContactSchema).optional(),
    hasDescription: z.array(HasDescriptionSchema).optional(),
    /** The real date surface — list of run windows. */
    takesPlaceAt: z.array(TakesPlaceAtSchema).optional(),
    offers: z.array(OffersEntrySchema).optional(),
    lastUpdate: z.string().optional(),
  })
  .passthrough();

const EventCatalogResponseSchema = z.object({
  objects: z.array(EventObjectSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
    total_pages: z.number(),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
  }),
});

type EventObject = z.infer<typeof EventObjectSchema>;

// ─── Classification ────────────────────────────────────────────────────────

function classifyEvent(types: readonly string[]): DtEventCategory {
  if (
    types.some((t) =>
      /Concert|Music(Event|Show|Performance)?|Recital|Opera|OperaShow/u.test(t),
    )
  ) {
    return 'concert';
  }
  if (types.some((t) => /Exhibition|Expo|TemporaryExhibition/u.test(t))) {
    return 'expo';
  }
  if (types.some((t) => /Festival|Carnaval|Carnival/u.test(t))) {
    return 'festival';
  }
  if (
    types.some((t) => /SportsEvent|Sport|Race|Tournament|Championship|Marathon|Regatta/u.test(t))
  ) {
    return 'sport';
  }
  if (types.some((t) => /Theater|TheaterEvent|TheatreEvent|Dance|DanceEvent|Show/u.test(t))) {
    return 'theater';
  }
  return 'other';
}

// ─── Date normalisation ────────────────────────────────────────────────────

/** Returns `YYYY-MM-DD` (UTC date part) or null. */
function normaliseDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Plain YYYY-MM-DD: accept as-is.
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;
  // Full datetime: keep only the date portion (DT timezones vary).
  const m = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)/u);
  if (m && m[1]) return m[1];
  // Fallback: try the JS Date parser.
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ─── Normalisation (EventObject → DtEvent) ─────────────────────────────────

/**
 * Pick the most relevant occurrence from `takesPlaceAt[]`:
 *   - Skip entries that have already ended (`endDate < today`).
 *   - Among the remaining, take the one with the closest *upcoming*
 *     edge (= `min(startDate, endDate)` that is ≥ today, or `today`
 *     if the event is already running).
 *
 * DT occasionally publishes `startDate > endDate` (season inversion).
 * We normalise by always treating the lower one as "start" and the
 * higher one as "end" so the rest of the pipeline can rely on
 * `start <= end`.
 */
function pickRelevantOccurrence(
  occurrences: ReadonlyArray<{ startDate?: string | undefined; endDate?: string | undefined }>,
  todayIso: string,
): { start: string; end: string | null } | null {
  const normalised: Array<{ start: string; end: string | null }> = [];
  for (const occ of occurrences) {
    const a = normaliseDate(occ.startDate);
    const b = normaliseDate(occ.endDate);
    if (a === null && b === null) continue;
    if (a !== null && b !== null) {
      // Swap so start <= end.
      const [start, end] = a <= b ? [a, b] : [b, a];
      if (end < todayIso) continue;
      normalised.push({ start, end });
    } else {
      const single = a ?? b;
      if (single !== null && single >= todayIso) {
        normalised.push({ start: single, end: null });
      }
    }
  }
  if (normalised.length === 0) return null;
  // Sort by start ascending so we pick the next upcoming run.
  normalised.sort((x, y) => x.start.localeCompare(y.start));
  return normalised[0] ?? null;
}

function normalizeEvent(
  o: EventObject,
  originLat: number,
  originLon: number,
  todayIso: string,
): DtEvent | null {
  const name = localized(o.label);
  if (name === null) return null;

  // Location: `isLocatedAt[0].geo` for events too.
  const loc = o.isLocatedAt?.[0];
  const lat = loc?.geo?.latitude ?? loc?.geoPoint?.lat;
  const lon = loc?.geo?.longitude ?? loc?.geoPoint?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  // Date surface — required.
  const occ = pickRelevantOccurrence(o.takesPlaceAt ?? [], todayIso);
  if (occ === null) return null;
  const { start, end } = occ;

  const addr = loc?.address?.[0];
  const street = firstString(addr?.streetAddress);
  const city = addr?.addressLocality ?? localized(addr?.hasAddressCity?.label);
  const venueAddress =
    street !== null && city !== null
      ? `${street}, ${city}`
      : (street ?? city ?? null);

  const types = o.type ?? [];
  const category = classifyEvent(types);

  const description = localized(o.hasDescription?.[0]?.shortDescription)
    ?? localized(o.hasDescription?.[0]?.description);

  const contact = o.hasContact?.[0];
  const officialUrl = firstString(contact?.homepage);

  // Pricing: `offers[0].priceSpecification[0].minPrice[0]`.
  let pricing: DtEventPricing | null = null;
  const priceSpec = o.offers?.[0]?.priceSpecification?.[0];
  const minPrice = priceSpec?.minPrice?.[0];
  if (typeof minPrice === 'number') {
    pricing =
      minPrice === 0
        ? { type: 'free', amountEur: null }
        : { type: 'paid', amountEur: minPrice };
  }

  return {
    uuid: o.uuid,
    name,
    types,
    category,
    startDate: start,
    endDate: end,
    // Venue name: city for now (DT rarely carries a `name` distinct
    // from the host city). The LLM has city + venueName separately
    // so duplicated values just collapse in the description.
    venueName: addr?.addressLocality ?? localized(addr?.hasAddressCity?.label) ?? null,
    venueAddress,
    latitude: lat,
    longitude: lon,
    distanceMeters: Math.round(haversineMeters(originLat, originLon, lat, lon)),
    descriptionShort: description,
    officialUrl,
    pricing,
  };
}

// ─── fetchEventsAround ─────────────────────────────────────────────────────

/**
 * Filter expression for `type[in]=` selecting the abstract `Event`
 * class — DT's reasoner indexes every event subtype under `Event`,
 * so a single filter catches them all. Trying to filter on subtypes
 * (`Concert`, `Festival`, …) silently returns 0 results because the
 * regional ODTs use the `Exhibition / ExhibitionEvent` shape rather
 * than `Concert / MusicEvent`.
 */
const EVENT_TYPE_FILTER = 'type[in]=Event';

/**
 * Fields the catalog endpoint must include in the response. Without
 * an explicit `fields=`, DT trims `takesPlaceAt` and `offers` from
 * the payload — which is exactly where the start/end dates and
 * pricing live for events. Reproduces verbatim the per-event view
 * obtained via `/catalog/{uuid}`.
 */
const EVENT_FIELDS =
  'uuid,uri,type,label,isLocatedAt,hasContact,hasDescription,takesPlaceAt,offers,lastUpdate';

export interface FetchEventsOptions {
  /** Default urban: 10 km, rural: 30 km — caller decides. */
  readonly radiusMeters?: number;
  /** Default `7` — start the window today + 7 days to skip noise (last-minute changes). */
  readonly lookaheadDays?: number;
  /** Default `60` — events further out look stale on a quick-stay page. */
  readonly horizonDays?: number;
  /** Default `5` — cap on returned events (sorted by start_date asc). */
  readonly limit?: number;
}

/**
 * Fetch upcoming events around a coordinate, sorted by start_date ascending.
 *
 * Schema notes
 * ------------
 * DT's `/catalog` endpoint mixes POIs and events under a single response
 * shape (the schema differs only by `@type`). We hit it with an event
 * type filter + a `hasBeginning[gte]=YYYY-MM-DD` date filter. The
 * regional ODTs use either `startDate` or `hasBeginning`; we filter on
 * `hasBeginning` (the reasoner-projected canonical) which works across
 * all 24 regions we've seen.
 *
 * Idempotency
 * -----------
 * Repeating the call within a few minutes returns the same set (DT
 * caches its catalog response at a 5-min granularity).
 */
export async function fetchEventsAround(
  latitude: number,
  longitude: number,
  options: FetchEventsOptions = {},
): Promise<readonly DtEvent[]> {
  const radius = options.radiusMeters ?? 10_000;
  const lookahead = options.lookaheadDays ?? 0;
  const horizon = options.horizonDays ?? 60;
  const limit = options.limit ?? 5;

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = new Date(Date.now() + horizon * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const lookaheadIso = new Date(Date.now() + lookahead * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // No server-side date filter — `takesPlaceAt.*.startDate` is nested
  // and DT's filter DSL doesn't traverse into arrays of objects
  // (returns 0 results, see debug-events.mjs). We fetch the geo +
  // type-filtered slice and apply the date window in-process.
  //
  // `page_size` is generous because most events are filtered out by
  // the date window (DT publishes year-round programming that ends
  // outside our 60-day horizon).
  const raw = await dtFetch('/catalog', {
    geo_distance: `${latitude},${longitude},${radius}m`,
    filters: EVENT_TYPE_FILTER,
    fields: EVENT_FIELDS,
    page_size: '100',
    lang: 'fr,en',
  });

  const parsed = EventCatalogResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      `[dt-events] schema parse failed: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
    );
    return [];
  }

  const events = parsed.data.objects
    .map((o) => normalizeEvent(o, latitude, longitude, todayIso))
    .filter((e): e is DtEvent => e !== null);

  // Date window: keep events whose run **overlaps** [lookahead, horizon].
  // - end >= lookahead (event is not over yet at the look-ahead floor)
  // - start <= horizon (event starts within the look-ahead horizon)
  const inWindow = events.filter((e) => {
    const lastDay = e.endDate ?? e.startDate;
    return lastDay >= lookaheadIso && e.startDate <= horizonIso;
  });

  return inWindow
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, limit);
}
