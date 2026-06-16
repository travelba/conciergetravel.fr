/**
 * Bootstrap RateHawk supplier mappings for ONE catalogue hotel.
 *
 *   1. geo SERP near hotel coordinates → best name/id token overlap ;
 *   2. hotelpage + content → room_groups (`rg_ext`) ;
 *   3. map `rg_ext` → editorial `hotel_rooms` by name tokens ;
 *   4. upsert `hotel_supplier_connections` (ratehawk) + `room_supplier_mappings`.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot ratehawk:bootstrap -- --slug=prince-de-galles-paris
 *   pnpm --filter @mch/editorial-pilot ratehawk:bootstrap -- --slug=... --etg-id=6530623 [--dry-run]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchHotelContent,
  searchHotelPage,
  type RateHawkClientConfig,
} from '@mch/integrations/ratehawk';
import { normalizeName } from '@mch/integrations/travelport';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });
loadDotenv({ path: resolve(__dirname, '../../../../apps/web/.env.local') });

const EnvSchema = z.object({
  RATEHAWK_API_BASE: z.string().url(),
  RATEHAWK_KEY_ID: z.string().min(1),
  RATEHAWK_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

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

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function roomTokens(room: EditorialRoom): ReadonlySet<string> {
  return normalizeName(`${room.name_en ?? ''} ${room.name_fr ?? ''} ${room.room_code}`);
}

function roomDisplay(room: EditorialRoom): string {
  return room.name_fr ?? room.name_en ?? room.room_code;
}

async function sbGet<T>(env: z.infer<typeof EnvSchema>, path: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function sbWrite(
  env: z.infer<typeof EnvSchema>,
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
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${path} failed (${res.status})`);
  }
}

async function findEtgHotelId(
  cfg: RateHawkClientConfig,
  hotel: HotelRow,
  forcedId: string | undefined,
): Promise<string | null> {
  if (forcedId !== undefined && forcedId.length > 0) return forcedId;

  const auth = `Basic ${btoa(`${cfg.keyId}:${cfg.apiKey}`)}`;
  const stay = {
    checkin: todayPlus(30),
    checkout: todayPlus(33),
    guests: [{ adults: 2, children: [] as number[] }],
    currency: 'EUR',
    language: 'en',
    residency: 'fr',
  };
  const res = await fetch(new URL('/api/b2b/v3/search/serp/geo/', cfg.baseUrl).toString(), {
    method: 'POST',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      latitude: hotel.latitude,
      longitude: hotel.longitude,
      radius: 1200,
      ...stay,
    }),
  });
  const j = (await res.json()) as {
    data?: { hotels?: ReadonlyArray<{ id?: string; rates?: readonly unknown[] }> };
  };
  const wanted = normalizeName(hotel.name);
  let bestId: string | undefined;
  let bestOverlap = 0;
  let bestRates = 0;
  for (const h of j.data?.hotels ?? []) {
    const id = h.id ?? '';
    if (id.length === 0) continue;
    const hay = normalizeName(id.replaceAll('_', ' '));
    let overlap = 0;
    for (const t of wanted) if (hay.has(t)) overlap += 1;
    const rates = h.rates?.length ?? 0;
    if (overlap > bestOverlap || (overlap === bestOverlap && overlap > 0 && rates > bestRates)) {
      bestId = id;
      bestOverlap = overlap;
      bestRates = rates;
    }
  }
  if (bestId !== undefined && bestOverlap >= 2) return bestId;
  return null;
}

async function main(): Promise<void> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[rh:bootstrap] env invalide');
    process.exitCode = 1;
    return;
  }
  const env = parsed.data;
  const slug = flag('slug');
  const dryRun = flag('dry-run') === 'true';
  const etgIdOverride = flag('etg-id');
  const minOverlap = Math.max(1, Number.parseInt(flag('min-overlap') ?? '2', 10) || 2);

  if (slug === undefined) {
    console.error('[rh:bootstrap] requis : --slug=<hotel_slug> [--etg-id=] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const cfg: RateHawkClientConfig = {
    baseUrl: env.RATEHAWK_API_BASE,
    keyId: env.RATEHAWK_KEY_ID,
    apiKey: env.RATEHAWK_API_KEY,
  };

  const hotels = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotels?slug=eq.${encodeURIComponent(slug)}&select=id,name,latitude,longitude&limit=1`,
  );
  const h0 = hotels[0];
  if (h0 === undefined) {
    console.error(`[rh:bootstrap] hôtel introuvable slug=${slug}`);
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
  const stay = {
    checkin: checkIn,
    checkout: checkOut,
    adults: 2,
    currency: 'EUR' as const,
    language: 'en',
    residency: 'fr',
  };

  const etgId = await findEtgHotelId(cfg, hotel, etgIdOverride);
  if (etgId === null) {
    console.warn(
      `[rh:bootstrap] aucun hôtel ETG trouvé pour « ${hotel.name} » (sandbox).` +
        ' Passez --etg-id= ou attendez les clés prod / GIATA.',
    );
    process.exitCode = 0;
    return;
  }

  console.log(`[rh:bootstrap] ETG id=${etgId} pour « ${hotel.name} » (${checkIn} → ${checkOut})`);

  const hp = await searchHotelPage(cfg, etgId, stay);
  if (!hp.ok) {
    console.error('[rh:bootstrap] hotelpage KO', hp.error);
    process.exitCode = 1;
    return;
  }
  const rates = hp.value.data?.hotels?.[0]?.rates ?? [];
  console.log(`[rh:bootstrap] hotelpage : ${rates.length} tarif(s)`);

  const content = await fetchHotelContent(cfg, [etgId], 'en');
  const groups = content.ok === true ? (content.value.data?.hotels?.[0]?.room_groups ?? []) : [];
  console.log(`[rh:bootstrap] content : ${groups.length} room_group(s)`);

  const rooms = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotel_rooms?hotel_id=eq.${hotel.id}&select=id,name_fr,name_en,room_code`,
  );
  const editorialRooms: EditorialRoom[] = rooms.map((r) => ({
    id: String(r['id']),
    name_fr: r['name_fr'] === null || r['name_fr'] === undefined ? null : String(r['name_fr']),
    name_en: r['name_en'] === null || r['name_en'] === undefined ? null : String(r['name_en']),
    room_code: String(r['room_code']),
  }));

  const rgByRoom = new Map<string, Readonly<Record<string, number>>>();
  for (const g of groups) {
    if (g.rg_ext === undefined) continue;
    const wanted = normalizeName(g.name ?? '');
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
      rgByRoom.set(bestRoomId, g.rg_ext);
    }
  }

  const mappingRows = [...rgByRoom.entries()].map(([hotelRoomId, rgExt]) => ({
    hotel_id: hotel.id,
    hotel_room_id: hotelRoomId,
    supplier: 'ratehawk' as const,
    supplier_room_key: { rgExt },
    confidence: 'auto_high' as const,
  }));

  const connectionRow = {
    hotel_id: hotel.id,
    supplier: 'ratehawk' as const,
    supplier_property_key: { hotelId: etgId },
    enabled: true,
    priority: 100,
    currency: 'EUR' as const,
  };

  const mappedRoomIds = new Set(rgByRoom.keys());
  const unmatched = editorialRooms.filter((r) => !mappedRoomIds.has(r.id));
  console.log(
    `[rh:bootstrap] mappings : ${mappingRows.length}/${editorialRooms.length} chambres · ${rates.length} tarifs live` +
      (unmatched.length > 0 ? ` · sans rg_ext : ${unmatched.map(roomDisplay).join(', ')}` : ''),
  );

  if (dryRun) {
    console.log('[rh:bootstrap] --dry-run');
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
    `room_supplier_mappings?hotel_id=eq.${hotel.id}&supplier=eq.ratehawk`,
  );
  if (mappingRows.length > 0) {
    await sbWrite(env, 'POST', 'room_supplier_mappings', mappingRows, 'return=minimal');
  }
  console.log(`[rh:bootstrap] OK — connexion ratehawk + ${mappingRows.length} mapping(s).`);
}

main().catch((e: unknown) => {
  console.error('[rh:bootstrap] fatal', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
