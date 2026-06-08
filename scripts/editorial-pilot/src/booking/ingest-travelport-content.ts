/**
 * Ingest Travelport static room content (photos + characteristics) into
 * `public.supplier_room_catalog` (migration 0071). Travelport's `SearchComplete`
 * v12 response embeds, per property, Leonardo Content Cloud media:
 *   - property `imageURLs` + `amenities` + `ratings` (hotel level) ;
 *   - per `roomType` : `roomImageURLs`, `characteristics` (class / category /
 *     bedTypes / balcony), `shortRoomDescription`.
 *
 * We cache the PER-ROOM payload (images + characteristics-derived amenities),
 * keyed by `(hotel_id, 'travelport', { labels: [shortRoomDescription] })` so the
 * key lines up with `room_supplier_mappings.supplier_room_key` (label-based).
 *
 * EEAT / indexability — IDENTICAL posture to RateHawk (cf. migration 0071):
 *   Travelport / Leonardo media usage rights are NOT confirmed for SEO. This
 *   cache feeds ONLY the non-indexed booking funnel as a room-visual fallback.
 *   Indexable pages keep our curated Cloudinary photos in `hotel_rooms`.
 *
 * Env (.env.local) : TRAVELPORT_* (auth + creds), NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot travelport:ingest -- \
 *     --slug=prince-de-galles-paris [--dry-run] [--adults=1] [--radius=1] \
 *     [--checkin=YYYY-MM-DD] [--nights=1] [--currency=EUR]
 *
 * Skills : api-integration, supabase-postgres-rls, redis-caching,
 *          windows-dev-environment.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  haversineMeters,
  normalizeName,
  searchByCoordinates,
  uniqueProperties,
  type PropertyItem,
  type SearchCompleteResponse,
  type TravelportCredentials,
  type TravelportRoomCharacteristics,
  type TravelportRoomType,
} from '@mch/integrations/travelport';
import type { IntegrationRedis } from '@mch/integrations/redis';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const EnvSchema = z.object({
  TRAVELPORT_AUTH_URL: z.string().url(),
  TRAVELPORT_API_BASE: z.string().url(),
  TRAVELPORT_USERNAME: z.string().min(1),
  TRAVELPORT_PASSWORD: z.string().min(1),
  TRAVELPORT_CLIENT_ID: z.string().min(1),
  TRAVELPORT_CLIENT_SECRET: z.string().min(1),
  TRAVELPORT_PCC: z.string().min(1),
  TRAVELPORT_ACCESS_GROUP: z.string().min(1),
  TRAVELPORT_CURRENCY: z.string().length(3).default('EUR'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});
type IngestEnv = z.infer<typeof EnvSchema>;

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

function createMemoryRedis(): IntegrationRedis {
  const store = new Map<string, string>();
  const redis = {
    get: (key: string): Promise<string | null> => Promise.resolve(store.get(key) ?? null),
    set: (
      key: string,
      value: unknown,
      opts?: { readonly nx?: boolean; readonly ex?: number },
    ): Promise<string | null> => {
      if (opts?.nx === true && store.has(key)) return Promise.resolve(null);
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return Promise.resolve('OK');
    },
    del: (...keys: readonly string[]): Promise<number> => {
      let removed = 0;
      for (const k of keys) if (store.delete(k)) removed += 1;
      return Promise.resolve(removed);
    },
  };
  return redis as unknown as IntegrationRedis;
}

function addDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface CatalogRow {
  readonly hotel_id: string;
  readonly supplier: 'travelport';
  readonly supplier_room_key: { readonly labels: readonly string[] };
  readonly room_name: string | null;
  readonly room_amenities: readonly string[];
  readonly images: readonly string[];
  readonly raw: unknown;
}

async function sbGet<T>(env: IngestEnv, path: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok)
    throw new Error(
      `Supabase GET ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  return (await res.json()) as T;
}

async function fetchHotelsBySlugs(env: IngestEnv, slugs: readonly string[]): Promise<HotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,slug,name,latitude,longitude');
  params.set('slug', `in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  params.set('latitude', 'not.is.null');
  params.set('longitude', 'not.is.null');
  const json = await sbGet<unknown>(env, `hotels?${params.toString()}`);
  if (!Array.isArray(json)) throw new Error('Supabase did not return an array of hotels');

  const rows: HotelRow[] = [];
  for (const raw of json) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    if (
      typeof r['id'] === 'string' &&
      typeof r['slug'] === 'string' &&
      typeof r['name'] === 'string' &&
      typeof r['latitude'] === 'number' &&
      typeof r['longitude'] === 'number'
    ) {
      rows.push({
        id: r['id'],
        slug: r['slug'],
        name: r['name'],
        latitude: r['latitude'],
        longitude: r['longitude'],
      });
    }
  }
  return rows;
}

function bestMatch(
  hotel: HotelRow,
  resp: SearchCompleteResponse,
): { readonly item: PropertyItem; readonly distanceMeters: number } | null {
  const wanted = normalizeName(hotel.name);
  const props = uniqueProperties(resp);
  let best: PropertyItem | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOverlap = 0;

  for (const it of props) {
    const center = it.propertyInfo?.geolocation?.center;
    if (center === undefined) continue;
    const distance = haversineMeters(
      hotel.latitude,
      hotel.longitude,
      center.latitude,
      center.longitude,
    );
    const overlap = [...normalizeName(it.name)].filter((t) => wanted.has(t)).length;
    if (
      overlap > 0 &&
      (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance))
    ) {
      bestOverlap = overlap;
      bestDistance = distance;
      best = it;
    }
  }
  if (best === undefined) return null;
  return { item: best, distanceMeters: Math.round(bestDistance) };
}

/** Normalised, human-readable amenity tags derived from room characteristics. */
function characteristicsToAmenities(c: TravelportRoomCharacteristics | undefined): string[] {
  if (c === undefined) return [];
  const out: string[] = [];
  if (typeof c.class?.description === 'string') out.push(c.class.description);
  if (typeof c.category?.description === 'string') out.push(c.category.description);
  for (const bed of c.bedTypes ?? []) {
    if (typeof bed.bedType !== 'string') continue;
    const qty = typeof bed.quantity === 'number' ? `${bed.quantity} ` : '';
    const size = typeof bed.size === 'string' ? ` (${bed.size})` : '';
    out.push(`${qty}${bed.bedType}${size}`.trim());
  }
  if (typeof c.balconyType?.description === 'string') out.push(c.balconyType.description);
  if (typeof c.maxOccupancy === 'number') out.push(`Max ${c.maxOccupancy} guests`);
  // Dédup en conservant l'ordre.
  return [...new Set(out)];
}

function roomImageUrls(rt: TravelportRoomType): string[] {
  const urls: string[] = [];
  for (const img of rt.roomImageURLs ?? []) {
    if (typeof img.url === 'string' && img.url.length > 0) urls.push(img.url);
  }
  return [...new Set(urls)];
}

function roomBookingCodes(rt: TravelportRoomType): string[] {
  const codes: string[] = [];
  for (const rate of rt.rates ?? []) {
    if (typeof rate.bookingCode === 'string' && rate.bookingCode.length > 0)
      codes.push(rate.bookingCode);
  }
  return [...new Set(codes)];
}

/**
 * Collapse Travelport `roomTypes` into one catalog row per distinct label.
 * Several roomTypes can share a `shortRoomDescription`; we merge their images,
 * amenities and booking codes.
 */
function buildRows(hotelId: string, item: PropertyItem): CatalogRow[] {
  interface Acc {
    label: string;
    images: Set<string>;
    amenities: Set<string>;
    bookingCodes: Set<string>;
    roomDescriptions: Set<string>;
  }
  const byLabel = new Map<string, Acc>();

  for (const rt of item.roomTypes ?? []) {
    const label = rt.shortRoomDescription?.trim();
    if (label === undefined || label.length === 0) continue;
    const acc = byLabel.get(label) ?? {
      label,
      images: new Set<string>(),
      amenities: new Set<string>(),
      bookingCodes: new Set<string>(),
      roomDescriptions: new Set<string>(),
    };
    for (const url of roomImageUrls(rt)) acc.images.add(url);
    for (const a of characteristicsToAmenities(rt.characteristics)) acc.amenities.add(a);
    for (const code of roomBookingCodes(rt)) acc.bookingCodes.add(code);
    for (const rate of rt.rates ?? []) {
      if (typeof rate.roomDescription === 'string') acc.roomDescriptions.add(rate.roomDescription);
    }
    byLabel.set(label, acc);
  }

  const rows: CatalogRow[] = [];
  for (const acc of byLabel.values()) {
    rows.push({
      hotel_id: hotelId,
      supplier: 'travelport',
      supplier_room_key: { labels: [acc.label] },
      room_name: acc.label,
      room_amenities: [...acc.amenities],
      images: [...acc.images],
      raw: {
        source: 'travelport.searchComplete.roomImageURLs',
        chainCode: item.chainCode,
        propertyCode: item.propertyCode,
        bookingCodes: [...acc.bookingCodes],
        roomDescriptions: [...acc.roomDescriptions],
      },
    });
  }
  return rows;
}

async function upsertCatalog(env: IngestEnv, rows: readonly CatalogRow[]): Promise<void> {
  const endpoint = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/supplier_room_catalog?on_conflict=hotel_id,supplier,supplier_room_key`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase upsert failed (${res.status}): ${body.slice(0, 400)}`);
  }
}

async function main(): Promise<void> {
  const parsedEnv = EnvSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    console.error('[travelport:ingest] env manquant :');
    console.error(
      parsedEnv.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  const env = parsedEnv.data;

  const slugsRaw = flag('slug');
  if (slugsRaw === undefined || slugsRaw === 'true') {
    console.error('[travelport:ingest] requis : --slug=slug-a[,slug-b] [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const slugs = slugsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const dryRun = flag('dry-run') === 'true';
  const checkIn = flag('checkin') ?? todayPlus(30);
  const nights = Number.parseInt(flag('nights') ?? '1', 10);
  const checkOut =
    flag('checkout') ?? addDays(checkIn, Number.isFinite(nights) ? Math.max(1, nights) : 1);
  const adults = Math.max(1, Number.parseInt(flag('adults') ?? '1', 10) || 1);
  const radiusMi = Math.max(1, Number.parseFloat(flag('radius') ?? '1') || 1);
  const currency = (flag('currency') ?? env.TRAVELPORT_CURRENCY).toUpperCase();

  const creds: TravelportCredentials = {
    authUrl: env.TRAVELPORT_AUTH_URL,
    apiBaseUrl: env.TRAVELPORT_API_BASE,
    clientId: env.TRAVELPORT_CLIENT_ID,
    clientSecret: env.TRAVELPORT_CLIENT_SECRET,
    username: env.TRAVELPORT_USERNAME,
    password: env.TRAVELPORT_PASSWORD,
    accessGroup: env.TRAVELPORT_ACCESS_GROUP,
    pcc: env.TRAVELPORT_PCC,
    redis: createMemoryRedis(),
  };

  const hotels = await fetchHotelsBySlugs(env, slugs);
  if (hotels.length === 0) {
    console.error(`[travelport:ingest] aucun hôtel trouvé pour : ${slugs.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[travelport:ingest] ${hotels.length} hôtel(s) · séjour ${checkIn} → ${checkOut} · ` +
      `${adults} adulte(s) · rayon ${radiusMi} mi · ${currency}${dryRun ? ' · DRY-RUN' : ''}\n`,
  );

  let totalRows = 0;
  let totalImages = 0;

  for (const hotel of hotels) {
    const search = await searchByCoordinates(creds, {
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      radius: radiusMi,
      unit: 'mi',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults,
      currency,
    });

    if (!search.ok) {
      console.log(`  ✗ ${hotel.name} — search KO : ${JSON.stringify(search.error)}`);
      continue;
    }

    const match = bestMatch(hotel, search.value);
    if (match === null) {
      console.log(`  · ${hotel.name} — aucune propriété Travelport rapprochée`);
      continue;
    }

    const rows = buildRows(hotel.id, match.item);
    const withImages = rows.filter((r) => r.images.length > 0).length;
    const imgs = rows.reduce((n, r) => n + r.images.length, 0);
    totalRows += rows.length;
    totalImages += imgs;

    console.log(
      `  ✓ ${hotel.name} → ${match.item.name} [${match.item.chainCode}/${match.item.propertyCode}] ` +
        `· ${rows.length} chambre(s), ${withImages} avec photo(s), ${imgs} image(s)`,
    );

    if (dryRun) {
      for (const r of rows) {
        console.log(
          `      - ${r.room_name ?? '(sans nom)'} | imgs=${r.images.length} | ` +
            `amenities=${r.room_amenities.length}`,
        );
      }
      continue;
    }

    if (rows.length > 0) await upsertCatalog(env, rows);
  }

  console.log(
    `\n[travelport:ingest] ${dryRun ? 'DRY-RUN — ' : ''}` +
      `${totalRows} ligne(s) catalogue, ${totalImages} image(s) au total.`,
  );
}

main().catch((err: unknown) => {
  console.error('[travelport:ingest] fatal', err);
  process.exitCode = 1;
});
