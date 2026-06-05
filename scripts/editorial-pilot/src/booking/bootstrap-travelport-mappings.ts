/**
 * Bootstrap deterministic Travelport supplier mappings for ONE hotel (Phase 3/4
 * activation). Turns the runtime fuzzy matcher into STORED data:
 *
 *   1. coordinate search (same as the live fiche path) -> best-match property
 *      => chainCode / propertyCode + roomTypes labels ;
 *   2. assign each Travelport room label to its best-overlap editorial room
 *      (hotel_rooms) ;
 *   3. upsert hotel_supplier_connections (travelport) + room_supplier_mappings.
 *
 * After running this, set MULTI_SUPPLIER_RATESHOPPING_ENABLED=true and the fiche
 * shows deterministic prices for this hotel via the orchestrator.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot travelport:bootstrap -- \
 *     --slug=prince-de-galles-paris [--dry-run] [--adults=1] [--radius=1]
 *
 * Skills : editorial-rankings-matrix, api-integration, redis-caching,
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
type BootEnv = z.infer<typeof EnvSchema>;

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

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

interface HotelRow {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface EditorialRoom {
  readonly id: string;
  readonly name_fr: string | null;
  readonly name_en: string | null;
  readonly room_code: string;
}

/** Token source for matching: FR + EN names + code (Travelport labels are EN). */
function roomTokens(room: EditorialRoom): ReadonlySet<string> {
  return normalizeName(`${room.name_en ?? ''} ${room.name_fr ?? ''} ${room.room_code}`);
}

function roomDisplay(room: EditorialRoom): string {
  return room.name_fr ?? room.name_en ?? room.room_code;
}

async function sbGet<T>(env: BootEnv, path: string): Promise<T> {
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

async function sbWrite(
  env: BootEnv,
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<void> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? 'return=minimal',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok)
    throw new Error(
      `Supabase ${method} ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
}

function bestMatch(hotel: HotelRow, resp: SearchCompleteResponse): PropertyItem | null {
  const wanted = normalizeName(hotel.name);
  let best: PropertyItem | undefined;
  let bestOverlap = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const it of uniqueProperties(resp)) {
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
      best = it;
      bestOverlap = overlap;
      bestDistance = distance;
    }
  }
  return best ?? null;
}

interface LabelInfo {
  readonly label: string;
  readonly fromMinor: number | null;
}

/** Distinct Travelport room labels (shortRoomDescription) with their lowest EUR price. */
function distinctLabels(item: PropertyItem): LabelInfo[] {
  const byLabel = new Map<string, number | null>();
  for (const rt of item.roomTypes ?? []) {
    const label = rt.shortRoomDescription;
    if (label === undefined || label.trim().length === 0) continue;
    let lowest: number | null = byLabel.get(label) ?? null;
    for (const rate of rt.rates ?? []) {
      const amount = rate.price?.totalPrice?.amount;
      const currency = rate.price?.currencyCode;
      if (amount === undefined) continue;
      if (currency !== undefined && currency.toUpperCase() !== 'EUR') continue;
      const minor = Math.round(amount * 100);
      if (lowest === null || minor < lowest) lowest = minor;
    }
    byLabel.set(label, lowest);
  }
  return [...byLabel.entries()].map(([label, fromMinor]) => ({ label, fromMinor }));
}

async function main(): Promise<void> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[tp:bootstrap] env invalide :');
    console.error(
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  const env = parsed.data;
  const slug = flag('slug');
  const dryRun = flag('dry-run') === 'true';
  const adults = Number.parseInt(flag('adults') ?? '1', 10) || 1;
  const radius = Number.parseFloat(flag('radius') ?? '1') || 1;
  // Minimum shared distinctive tokens to auto-map a Travelport label to an
  // editorial room. >=2 avoids mapping on the lone generic token "suite"
  // (branded suites — Mosaïque, Macassar… — must be curated by a human via the
  // Payload HotelRooms collection; confidence='manual').
  const minOverlap = Math.max(1, Number.parseInt(flag('min-overlap') ?? '2', 10) || 2);
  if (slug === undefined) {
    console.error('[tp:bootstrap] requis : --slug=<hotel_slug> [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const hotels = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotels?slug=eq.${encodeURIComponent(slug)}&select=id,name,latitude,longitude&limit=1`,
  );
  const h0 = hotels[0];
  if (h0 === undefined) {
    console.error(`[tp:bootstrap] hôtel introuvable pour slug=${slug}`);
    process.exitCode = 1;
    return;
  }
  const hotel: HotelRow = {
    id: String(h0['id']),
    name: String(h0['name']),
    latitude: Number(h0['latitude']),
    longitude: Number(h0['longitude']),
  };

  const checkIn = todayPlus(30);
  const checkOut = todayPlus(31);
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

  console.log(
    `[tp:bootstrap] recherche Travelport pour « ${hotel.name} » (${checkIn} → ${checkOut})…`,
  );
  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius,
    unit: 'mi',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults,
    currency: env.TRAVELPORT_CURRENCY,
  });
  if (!search.ok) {
    console.error('[tp:bootstrap] recherche KO :', JSON.stringify(search.error));
    process.exitCode = 1;
    return;
  }
  const property = bestMatch(hotel, search.value);
  if (property === null) {
    console.error('[tp:bootstrap] aucune propriété Travelport ne correspond (nom + proximité).');
    process.exitCode = 1;
    return;
  }
  const labels = distinctLabels(property);
  console.log(
    `[tp:bootstrap] match : ${property.name} [${property.chainCode}/${property.propertyCode}] · ${labels.length} type(s) de chambre`,
  );
  for (const l of labels) {
    console.log(
      `    - ${l.label}${l.fromMinor !== null ? ` (dès ${(l.fromMinor / 100).toFixed(0)} €)` : ''}`,
    );
  }

  const rooms = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotel_rooms?hotel_id=eq.${hotel.id}&select=id,name_fr,name_en,room_code`,
  );
  const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  const editorialRooms: EditorialRoom[] = rooms.map((r) => ({
    id: String(r['id']),
    name_fr: str(r['name_fr']),
    name_en: str(r['name_en']),
    room_code: String(r['room_code']),
  }));
  console.log(`[tp:bootstrap] ${editorialRooms.length} chambre(s) éditoriale(s).`);

  // Assign each Travelport label to its best-overlap editorial room.
  const labelsByRoom = new Map<string, string[]>();
  for (const l of labels) {
    const wanted = normalizeName(l.label);
    if (wanted.size === 0) continue;
    let bestRoomId: string | undefined;
    let bestOverlap = 0;
    for (const room of editorialRooms) {
      const tokens = roomTokens(room);
      let overlap = 0;
      for (const t of tokens) if (wanted.has(t)) overlap += 1;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestRoomId = room.id;
      }
    }
    if (bestRoomId !== undefined && bestOverlap >= minOverlap) {
      const arr = labelsByRoom.get(bestRoomId) ?? [];
      arr.push(l.label);
      labelsByRoom.set(bestRoomId, arr);
    }
  }

  const mappingRows = [...labelsByRoom.entries()].map(([hotelRoomId, lbls]) => ({
    hotel_id: hotel.id,
    hotel_room_id: hotelRoomId,
    supplier: 'travelport' as const,
    supplier_room_key: { labels: lbls },
    confidence: 'auto_high' as const,
  }));

  const connectionRow = {
    hotel_id: hotel.id,
    supplier: 'travelport' as const,
    supplier_property_key: { chainCode: property.chainCode, propertyCode: property.propertyCode },
    enabled: true,
    priority: 100,
    currency: 'EUR' as const,
  };

  const mappedRoomIds = new Set(labelsByRoom.keys());
  const unmatched = editorialRooms.filter((r) => !mappedRoomIds.has(r.id));
  console.log(
    `[tp:bootstrap] mappings : ${mappingRows.length}/${editorialRooms.length} chambres reliées` +
      (unmatched.length > 0 ? ` · sans label : ${unmatched.map(roomDisplay).join(', ')}` : ''),
  );

  if (dryRun) {
    console.log('[tp:bootstrap] --dry-run : aucune écriture.');
    console.log(JSON.stringify({ connectionRow, mappingRows }, null, 2));
    return;
  }

  await sbWrite(
    env,
    'POST',
    'hotel_supplier_connections?on_conflict=hotel_id,supplier',
    [connectionRow],
    'resolution=merge-duplicates,return=minimal',
  );
  await sbWrite(
    env,
    'DELETE',
    `room_supplier_mappings?hotel_id=eq.${hotel.id}&supplier=eq.travelport`,
  );
  if (mappingRows.length > 0) {
    await sbWrite(env, 'POST', 'room_supplier_mappings', mappingRows, 'return=minimal');
  }
  console.log(
    `[tp:bootstrap] OK — connexion + ${mappingRows.length} mapping(s) écrits pour ${hotel.name}.`,
  );
}

main().catch((e: unknown) => {
  console.error('[tp:bootstrap] fatal', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
