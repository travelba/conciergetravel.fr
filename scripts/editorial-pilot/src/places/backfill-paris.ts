/**
 * backfill-paris.ts — pilot backfill of the "lieux à visiter" catalogue
 * from the embedded `hotels.points_of_interest` JSONB (buckets visit/do).
 *
 * Plan §3.1 + §5.3. Idempotent. One-shot pipeline:
 *   1. Read published Paris hotels' embedded POIs (visit/do only).
 *   2. Dedupe across hotels (by osm_id, then by slug) into canonical
 *      `places` scaffolds — seeded with the POI editorial fields
 *      (description → factual_summary, tip → concierge_advice, photo).
 *   3. UPSERT `places` (on_conflict city_key,slug) — always as
 *      `is_published=false` scaffolds. A one-line OSM summary is NOT a
 *      publishable fiche: the dedicated strict gate `publish-places.ts`
 *      is the SOLE publisher and only flips rows that clear the full
 *      editorial envelope (faq + rich description + concierge advice).
 *      `--publish-thin` opts back into the legacy minimal auto-publish
 *      (coords + summary) for throwaway pilots only.
 *   4. Resolve `place_hotel_links` proximity in-memory (haversine) and
 *      UPSERT — so the maillage hôtel ↔ lieu works immediately.
 *   5. (optional) Match GetYourGuide products when GYG is configured.
 *
 * CLI
 * ---
 *   --city=<key>      city_key (default paris) — the canonical URL slug
 *   --city-match=<s>  hotels.city ILIKE substring filter (default Paris).
 *                     Use a common stem to capture fragmented source
 *                     display names, e.g. `--city-match=Lond` matches both
 *                     "London" and "Londres", `--city-match=Duba` matches
 *                     "Dubai" and "Dubaï".
 *   --city-name=<s>   display name stored in places.city (default =
 *                     --city-match). Set this when the match is a stem so
 *                     the stored label stays canonical (e.g.
 *                     `--city-match=Lond --city-name=Londres`).
 *   --max-radius-km=N geo-fence: drop embedded POIs farther than N km from
 *                     the matched-hotels centroid (default 0 = disabled).
 *                     Guards against cross-city contamination — some hotels
 *                     carry POIs from another city in points_of_interest
 *                     (e.g. a London hotel embedding Paris monuments). Pass
 *                     e.g. `--max-radius-km=30` for any non-Paris rollout.
 *   --max-meters=N    proximity cutoff metres (default 1500)
 *   --limit-per=N     max hotels linked per place (default 8)
 *   --publish-thin    legacy: auto-publish on coords + summary (off by
 *                     default — the strict gate publish-places.ts is the
 *                     canonical publisher)
 *   --no-proximity    skip the place_hotel_links resolve
 *   --gyg             match GetYourGuide products (needs GYG env)
 *   --dry-run         compute + print, write nothing
 *
 * Examples
 * --------
 *   pnpm places:backfill-paris --dry-run
 *   pnpm places:backfill-paris
 *   pnpm places:backfill-paris --city=londres --city-match=Lond --city-name=Londres --dry-run
 *   pnpm places:backfill-paris --city=dubai --city-match=Duba --city-name=Dubaï
 */
import {
  defaultBucketForKind,
  haversineMeters,
  rankByProximity,
  toGeoPoint,
  type GeoPoint,
  type PlaceBucket,
  type PlaceKind,
} from '@mch/domain/places';

import { loadPhotoEnv } from '../photos/env-photos.js';

import { slugify } from './place-slug.js';
import { selectTable, upsertRows, type SupabaseRestConfig } from './supabase-places.js';

// ---------------------------------------------------------------------------
// Source shapes (read-only projection of hotels.points_of_interest)
// ---------------------------------------------------------------------------

interface EmbeddedPoi {
  readonly name?: unknown;
  readonly name_en?: unknown;
  readonly type?: unknown;
  readonly bucket?: unknown;
  readonly category_fr?: unknown;
  readonly category_en?: unknown;
  readonly latitude?: unknown;
  readonly longitude?: unknown;
  readonly address?: unknown;
  readonly description_fr?: unknown;
  readonly description_en?: unknown;
  readonly tip_fr?: unknown;
  readonly tip_en?: unknown;
  readonly osm_id?: unknown;
  readonly image_public_id?: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly points_of_interest: unknown;
}

interface PlaceScaffold {
  slug: string;
  source_ref: string | null;
  bucket: PlaceBucket;
  kind: PlaceKind;
  name: string;
  name_en: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  factual_summary_fr: string | null;
  factual_summary_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  concierge_advice: Readonly<Record<string, unknown>> | null;
  hero_image: string | null;
  is_published: boolean;
}

interface CliArgs {
  readonly cityKey: string;
  readonly cityMatch: string;
  readonly cityName: string;
  readonly maxRadiusKm: number;
  readonly maxMeters: number;
  readonly limitPer: number;
  readonly publish: boolean;
  readonly proximity: boolean;
  readonly gyg: boolean;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let cityKey = 'paris';
  let cityMatch = 'Paris';
  // Stored display label. Defaults to cityMatch (back-compat for paris /
  // gordes); set explicitly when --city-match is a stem.
  let cityName: string | null = null;
  // Geo-fence radius (km) around the matched-hotels centroid. 0 = disabled
  // (preserves the legacy paris/gordes behaviour for the running loop).
  let maxRadiusKm = 0;
  let maxMeters = 1500;
  let limitPer = 8;
  // Default: scaffolds stay unpublished. A bare OSM one-liner is not a
  // publishable fiche — the strict gate `publish-places.ts` is the sole
  // publisher. `--publish-thin` re-enables the legacy minimal auto-publish.
  let publish = false;
  let proximity = true;
  let gyg = false;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith('--city=')) cityKey = a.slice('--city='.length);
    else if (a.startsWith('--city-match=')) cityMatch = a.slice('--city-match='.length);
    else if (a.startsWith('--city-name=')) cityName = a.slice('--city-name='.length);
    else if (a.startsWith('--max-radius-km=')) maxRadiusKm = Number.parseFloat(a.slice(16));
    else if (a.startsWith('--max-meters=')) maxMeters = Number.parseInt(a.slice(13), 10);
    else if (a.startsWith('--limit-per=')) limitPer = Number.parseInt(a.slice(12), 10);
    else if (a === '--publish-thin') publish = true;
    else if (a === '--no-publish') publish = false;
    else if (a === '--no-proximity') proximity = false;
    else if (a === '--gyg') gyg = true;
    else if (a === '--dry-run') dryRun = true;
  }
  return {
    cityKey,
    cityMatch,
    cityName: cityName ?? cityMatch,
    maxRadiusKm: Number.isFinite(maxRadiusKm) && maxRadiusKm > 0 ? maxRadiusKm : 0,
    maxMeters,
    limitPer,
    publish,
    proximity,
    gyg,
    dryRun,
  };
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Infer (kind, bucket) from the embedded POI's `type` + optional explicit
 * `bucket`. Returns null for eat/shop/lodging/transit (out of scope —
 * those stay embedded in hotels.points_of_interest).
 */
function inferKindBucket(poi: EmbeddedPoi): { kind: PlaceKind; bucket: PlaceBucket } | null {
  const type = (str(poi.type) ?? '').toLowerCase();
  const explicit = str(poi.bucket);

  // Hard exclusions — food / shopping-as-commerce / lodging / transit.
  if (
    /(restaurant|bar|cafe|caf\u00e9|food|bistro|brasserie|hotel|h\u00f4tel|lodging|station|metro|m\u00e9tro|airport|a\u00e9roport|parking|gare)/u.test(
      type,
    )
  ) {
    return null;
  }

  let kind: PlaceKind | null = null;
  if (/(museum|gallery|mus\u00e9e|galerie)/u.test(type)) kind = 'museum';
  else if (
    /(monument|landmark|historic|cathedral|castle|chateau|ch\u00e2teau|arch|tower|tour)/u.test(type)
  )
    kind = 'monument';
  else if (/(garden|park|jardin|parc|botan)/u.test(type)) kind = 'garden';
  else if (/(church|temple|mosque|synagogue|basilica|chapel|\u00e9glise|culte|worship)/u.test(type))
    kind = 'place_of_worship';
  else if (/(viewpoint|observation|panorama|belv\u00e9d)/u.test(type)) kind = 'viewpoint';
  else if (/(theatre|theater|opera|op\u00e9ra|concert|philharm)/u.test(type)) kind = 'theatre';
  else if (/(mall|market|march\u00e9|department|boutique|shopping)/u.test(type)) kind = 'shopping';
  else if (/(bike|v\u00e9lo|cycling|kayak|cruise|tour|walk|outdoor|sport)/u.test(type))
    kind = 'guided_tour';
  else if (/(attraction|sight|monument|culture)/u.test(type)) kind = 'attraction';

  if (kind === null) {
    // No type signal → fall back on the explicit editorial bucket if any.
    if (explicit === 'visit') kind = 'attraction';
    else if (explicit === 'do') kind = 'guided_tour';
    else return null;
  }

  const bucket: PlaceBucket =
    explicit === 'visit' || explicit === 'do' ? explicit : defaultBucketForKind(kind);
  return { kind, bucket };
}

/**
 * Name-level exclusions the `type`/`bucket` signal misses. The embedded
 * POIs are hotel-authored: lodging (chambres d'hôtes, gîte, table d'hôtes)
 * leaks in mislabelled as an activity, and meta entries (access roads,
 * parking) are not visitable places. Excluded so /lieux never ships a
 * thin fiche for a B&B or a footpath.
 */
function isExcludedByName(name: string): boolean {
  return /(chambres?\s+d['’]?\s*h[oô]tes|g[iî]tes?|table\s+d['’]?\s*h[oô]tes|maison\s+d['’]?\s*h[oô]tes|bed\s+and\s+breakfast|b&b|guesthouse|chemin\s+d['’]?\s*acc[eè]s|^\s*acc[eè]s\b|parking|navette)/iu.test(
    name,
  );
}

/**
 * Collapse near-duplicate slugs that differ only by a leading article
 * ("les-caves-…" ⇄ "caves-…") so the same place referenced under two
 * phrasings yields ONE canonical fiche (no SEO near-duplicate).
 */
function dedupeKey(slug: string): string {
  return slug.replace(/^(les|le|la|l|the)-/u, '');
}

/**
 * Robust city centre from the matched hotels: the median lat/lng (median,
 * not mean, so a single mis-geocoded hotel can't drag the centroid). Used
 * by the geo-fence to reject embedded POIs that belong to another city.
 */
function hotelCentroid(hotels: readonly HotelRow[]): GeoPoint | null {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const h of hotels) {
    const p = toGeoPoint(h.latitude, h.longitude);
    if (p !== null) {
      lats.push(p.latitude);
      lngs.push(p.longitude);
    }
  }
  if (lats.length === 0) return null;
  const median = (xs: number[]): number => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  };
  return { latitude: median(lats), longitude: median(lngs) };
}

function poiToScaffold(
  poi: EmbeddedPoi,
  publish: boolean,
  usedSlugs: Set<string>,
  dedupeKeys: Set<string>,
  cityKey: string,
  geoFence: { centroid: GeoPoint; maxMeters: number } | null,
): PlaceScaffold | null {
  const name = str(poi.name);
  if (name === null) return null;
  if (isExcludedByName(name)) return null;
  const lat = num(poi.latitude);
  const lng = num(poi.longitude);
  if (lat === null || lng === null) return null;

  // Geo-fence: a POI farther than maxMeters from the city centroid belongs
  // to another city (cross-city contamination in hotels.points_of_interest).
  if (geoFence !== null) {
    const dist = haversineMeters(geoFence.centroid, { latitude: lat, longitude: lng });
    if (dist > geoFence.maxMeters) return null;
  }

  const km = inferKindBucket(poi);
  if (km === null) return null;

  const slug = slugify(name);
  if (slug.length === 0) return null;
  // Skip the city-self-named meta entry ("Gordes" inside Gordes) — it
  // collides with the city_key and is never a distinct visitable place.
  if (slug === cityKey) return null;
  // One canonical fiche per base slug — first occurrence wins (collapses
  // the same place referenced by multiple hotels and across buckets, so
  // SEO never sees two near-duplicate fiches for the same monument). The
  // dedupe key is article-insensitive so "les-caves-…" ⇄ "caves-…" merge.
  const dk = dedupeKey(slug);
  if (usedSlugs.has(slug) || dedupeKeys.has(dk)) return null;
  usedSlugs.add(slug);
  dedupeKeys.add(dk);

  const osmId = str(poi.osm_id);
  const summaryFr = str(poi.description_fr);
  const summaryEn = str(poi.description_en);
  const tipFr = str(poi.tip_fr);
  const tipEn = str(poi.tip_en);

  const conciergeAdvice =
    tipFr !== null || tipEn !== null
      ? {
          ...(tipFr !== null ? { fr: { title: 'Le Conseil du Concierge', body: tipFr } } : {}),
          ...(tipEn !== null ? { en: { title: "The Concierge's Tip", body: tipEn } } : {}),
        }
      : null;

  return {
    slug,
    source_ref: osmId !== null ? `osm/${osmId}` : null,
    bucket: km.bucket,
    kind: km.kind,
    name,
    name_en: str(poi.name_en),
    latitude: lat,
    longitude: lng,
    address: str(poi.address),
    factual_summary_fr: summaryFr,
    factual_summary_en: summaryEn,
    description_fr: summaryFr,
    description_en: summaryEn,
    concierge_advice: conciergeAdvice,
    hero_image: str(poi.image_public_id),
    // Default false: a one-line OSM summary is a scaffold, not a fiche.
    // Only `--publish-thin` (legacy) flips on coords + summary; the strict
    // gate `publish-places.ts` is otherwise the sole publisher.
    is_published: publish && summaryFr !== null,
  };
}

function parsePois(raw: unknown): readonly EmbeddedPoi[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is EmbeddedPoi => typeof x === 'object' && x !== null);
}

async function resolveProximity(
  cfg: SupabaseRestConfig,
  cityKey: string,
  maxMeters: number,
  limitPer: number,
  dryRun: boolean,
): Promise<void> {
  const places = await selectTable<{
    id: string;
    latitude: number | null;
    longitude: number | null;
  }>(cfg, 'places', {
    columns: 'id, latitude, longitude',
    filters: ['is_published=eq.true', `city_key=eq.${cityKey}`],
    order: 'id.asc',
  });
  const hotels = await selectTable<{
    id: string;
    latitude: number | null;
    longitude: number | null;
  }>(cfg, 'hotels', {
    columns: 'id, latitude, longitude',
    filters: ['is_published=eq.true', 'latitude=not.is.null'],
    order: 'id.asc',
  });
  const hotelCoords = (h: { latitude: number | null; longitude: number | null }): GeoPoint | null =>
    toGeoPoint(h.latitude, h.longitude);

  let links = 0;
  for (const place of places) {
    const anchor = toGeoPoint(place.latitude, place.longitude);
    if (anchor === null) continue;
    const ranked = rankByProximity(anchor, hotels, hotelCoords, { maxMeters, limit: limitPer });
    if (ranked.length === 0) continue;
    const rows = ranked.map((r) => ({
      place_id: place.id,
      hotel_id: r.item.id,
      distance_meters: r.distanceMeters,
      walk_minutes: r.walkMinutes,
    }));
    links += rows.length;
    if (!dryRun) await upsertRows(cfg, 'place_hotel_links', rows, 'place_id,hotel_id');
  }
  console.log(
    `[backfill-paris] proximity ${dryRun ? 'DRY-RUN ' : ''}${String(places.length)} places → ${String(links)} links.`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[backfill-paris] city_key=${args.cityKey} name="${args.cityName}" match=ILIKE *${args.cityMatch}* ` +
      `publish=${String(args.publish)} proximity=${String(args.proximity)} dry=${String(args.dryRun)}`,
  );

  const hotels = await selectTable<HotelRow>(cfg, 'hotels', {
    columns: 'id, city, country_code, latitude, longitude, points_of_interest',
    filters: ['is_published=eq.true', `city=ilike.*${encodeURIComponent(args.cityMatch)}*`],
    order: 'id.asc',
  });
  console.log(`[backfill-paris] ${String(hotels.length)} hotels matched.`);

  // Build the optional geo-fence from the matched-hotels centroid.
  let geoFence: { centroid: GeoPoint; maxMeters: number } | null = null;
  if (args.maxRadiusKm > 0) {
    const centroid = hotelCentroid(hotels);
    if (centroid === null) {
      console.warn('[backfill-paris] --max-radius-km set but no hotel coords — geo-fence skipped.');
    } else {
      geoFence = { centroid, maxMeters: args.maxRadiusKm * 1000 };
      console.log(
        `[backfill-paris] geo-fence centroid=${centroid.latitude.toFixed(4)},${centroid.longitude.toFixed(4)} radius=${String(args.maxRadiusKm)}km`,
      );
    }
  }

  const usedSlugs = new Set<string>();
  const dedupeKeys = new Set<string>();
  const bySourceRef = new Map<string, PlaceScaffold>();
  const scaffolds: PlaceScaffold[] = [];
  let countryCode = 'FR';
  let poiTotal = 0;

  for (const hotel of hotels) {
    if (hotel.country_code !== null && hotel.country_code.length === 2) {
      countryCode = hotel.country_code;
    }
    const pois = parsePois(hotel.points_of_interest);
    for (const poi of pois) {
      poiTotal += 1;
      // Cross-hotel dedupe by osm_id before building (so the same museum
      // referenced by 5 hotels yields ONE place).
      const osmId = str(poi.osm_id);
      if (osmId !== null && bySourceRef.has(`osm/${osmId}`)) continue;
      const sc = poiToScaffold(poi, args.publish, usedSlugs, dedupeKeys, args.cityKey, geoFence);
      if (sc === null) continue;
      if (sc.source_ref !== null) bySourceRef.set(sc.source_ref, sc);
      scaffolds.push(sc);
    }
  }

  const published = scaffolds.filter((s) => s.is_published).length;
  console.log(
    `[backfill-paris] ${String(poiTotal)} embedded POIs → ${String(scaffolds.length)} canonical places ` +
      `(${String(published)} publishable).`,
  );

  if (scaffolds.length === 0) {
    console.log('[backfill-paris] nothing to upsert.');
    return;
  }

  if (args.dryRun) {
    for (const s of scaffolds.slice(0, 40)) {
      console.log(
        `  ${s.is_published ? 'PUB' : 'drf'}  ${s.bucket}/${s.kind}  ${s.slug}  (${s.name})`,
      );
    }
    if (scaffolds.length > 40) console.log(`  … +${String(scaffolds.length - 40)} more`);
  } else {
    // Chunk the upsert so a large pilot stays under PostgREST payload limits.
    const CHUNK = 200;
    for (let i = 0; i < scaffolds.length; i += CHUNK) {
      const slice = scaffolds.slice(i, i + CHUNK);
      await upsertRows(
        cfg,
        'places',
        slice.map((s) => ({
          slug: s.slug,
          source_ref: s.source_ref,
          city_key: args.cityKey,
          city: args.cityName,
          country_code: countryCode,
          bucket: s.bucket,
          kind: s.kind,
          name: s.name,
          name_en: s.name_en,
          latitude: s.latitude,
          longitude: s.longitude,
          address: s.address,
          factual_summary_fr: s.factual_summary_fr,
          factual_summary_en: s.factual_summary_en,
          description_fr: s.description_fr,
          description_en: s.description_en,
          concierge_advice: s.concierge_advice,
          hero_image: s.hero_image,
          is_published: s.is_published,
        })),
        'city_key,slug',
      );
    }
    console.log(`[backfill-paris] upserted ${String(scaffolds.length)} places.`);
  }

  if (args.proximity) {
    await resolveProximity(cfg, args.cityKey, args.maxMeters, args.limitPer, args.dryRun);
  }

  if (args.gyg) {
    console.log(
      '[backfill-paris] GYG matching requested — run `pnpm places:source --city=' +
        args.cityKey +
        '` (Google + GYG) for product enrichment, or wire GYG-by-coords here when the Partner token is set.',
    );
  }
}

main().catch((e: unknown) => {
  console.error('[backfill-paris] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
