/**
 * Sync editorial `hotel_rooms` + RateHawk `room_supplier_mappings` from ETG API.
 *
 * Source of truth: `fetchRoomGroups` → `hotel/info` when `content/v1` is empty.
 * One `hotel_rooms` row per `room_group`, 1:1 mapping via `rg_ext`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot ratehawk:sync-rooms -- \
 *     --slug=conrad-los-angeles --etg-id=conrad_los_angeles [--dry-run]
 */
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchRoomGroups,
  rgExtKey,
  type RateHawkClientConfig,
  type RateHawkRoomGroup,
} from '@mch/integrations/ratehawk';
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

const RATEHAWK_IMAGE_SIZE = '1024x768';

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

function slugifyRoom(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function roomSlugFromGroup(group: RateHawkRoomGroup, index: number): string {
  const base = slugifyRoom(group.name?.trim() ?? `room-${index + 1}`);
  if (group.rg_ext === undefined) return `${base}-${index + 1}`;
  const hash = createHash('sha256').update(rgExtKey(group.rg_ext)).digest('hex').slice(0, 6);
  return `${base}-${hash}`;
}

function roomCodeFromGroup(group: RateHawkRoomGroup): string {
  if (group.rg_ext === undefined) return 'RH_UNKNOWN';
  const hash = createHash('sha256').update(rgExtKey(group.rg_ext)).digest('hex').slice(0, 12);
  return `RH_${hash}`;
}

function maxOccupancyFromGroup(group: RateHawkRoomGroup): number {
  const cap = group.rg_ext?.['capacity'];
  return typeof cap === 'number' && cap > 0 ? cap : 2;
}

function imageUrlsFromGroup(group: RateHawkRoomGroup): readonly string[] {
  const fromImages = (group.images ?? []).map((u) => u.replace('{size}', RATEHAWK_IMAGE_SIZE));
  const fromExt = (group.images_ext ?? [])
    .map((i) => i.url)
    .filter((u): u is string => typeof u === 'string')
    .map((u) => u.replace('{size}', RATEHAWK_IMAGE_SIZE));
  return [...fromImages, ...fromExt];
}

async function sbGet<T>(env: z.infer<typeof EnvSchema>, path: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function sbWrite(
  env: z.infer<typeof EnvSchema>,
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<readonly Record<string, unknown>[]> {
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
    throw new Error(
      `Supabase ${method} ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const text = await res.text();
  if (text.length === 0) return [];
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed as readonly Record<string, unknown>[]) : [];
}

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const slug = flag('slug');
  const etgId = flag('etg-id');
  const dryRun = flag('dry-run') === 'true';

  if (slug === undefined || etgId === undefined) {
    console.error('[rh:sync-rooms] requis : --slug= --etg-id= [--dry-run]');
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
    `hotels?slug=eq.${encodeURIComponent(slug)}&select=id,name&limit=1`,
  );
  const hotel = hotels[0];
  if (hotel === undefined) {
    console.error(`[rh:sync-rooms] hôtel introuvable slug=${slug}`);
    process.exitCode = 1;
    return;
  }
  const hotelId = String(hotel['id']);
  const hotelName = String(hotel['name']);

  const groupsRes = await fetchRoomGroups(cfg, etgId, 'en');
  if (!groupsRes.ok) {
    console.error('[rh:sync-rooms] fetchRoomGroups KO', groupsRes.error);
    process.exitCode = 1;
    return;
  }

  const groups = groupsRes.value.filter(
    (g) => g.rg_ext !== undefined && (g.name?.trim().length ?? 0) > 0,
  );

  const seenRg = new Set<string>();
  const uniqueGroups = groups.filter((g) => {
    const key = rgExtKey(g.rg_ext ?? {});
    if (seenRg.has(key)) return false;
    seenRg.add(key);
    return true;
  });

  console.log(
    `[rh:sync-rooms] ${uniqueGroups.length} room_group(s) depuis API pour ${etgId}` +
      (uniqueGroups.length < groups.length
        ? ` (${groups.length - uniqueGroups.length} doublon(s) retirés)`
        : ''),
  );

  if (uniqueGroups.length === 0) {
    console.error('[rh:sync-rooms] aucun room_group exploitable');
    process.exitCode = 1;
    return;
  }

  const roomRows = uniqueGroups.map((group, index) => {
    const name = group.name?.trim() ?? `Room ${index + 1}`;
    const rgExt = group.rg_ext;
    if (rgExt === undefined) throw new Error('rg_ext missing after filter');
    const code = roomCodeFromGroup(group);
    const slugRoom = roomSlugFromGroup(group, index);
    return {
      hotel_id: hotelId,
      room_code: code,
      slug: slugRoom,
      name_fr: name,
      name_en: name,
      description_fr: `${name} — catégorie RateHawk pour ${hotelName}.`,
      description_en: `${name} — RateHawk room category at ${hotelName}.`,
      max_occupancy: maxOccupancyFromGroup(group),
      display_order: (index + 1) * 10,
      _rgExt: rgExt,
      _images: imageUrlsFromGroup(group),
      _amenities: group.room_amenities ?? [],
    };
  });

  const mappingRows = roomRows.map((row) => ({
    hotel_id: hotelId,
    hotel_room_id: '', // filled after insert
    supplier: 'ratehawk' as const,
    supplier_room_key: { rg_ext: row._rgExt },
    confidence: 'auto_high' as const,
  }));

  const catalogRows = roomRows.map((row) => ({
    hotel_id: hotelId,
    supplier: 'ratehawk' as const,
    supplier_room_key: { rg_ext: row._rgExt },
    room_name: row.name_en,
    room_amenities: row._amenities,
    images: row._images,
    raw: { source: 'hotel/info', rg_ext_key: rgExtKey(row._rgExt) },
  }));

  if (dryRun) {
    for (const row of roomRows) {
      console.log(`  - ${row.name_en} | occ=${row.max_occupancy} | code=${row.room_code}`);
    }
    return;
  }

  await sbWrite(env, 'DELETE', `room_supplier_mappings?hotel_id=eq.${hotelId}`);
  await sbWrite(env, 'DELETE', `hotel_rooms?hotel_id=eq.${hotelId}`);

  const remaining = await sbGet<readonly unknown[]>(
    env,
    `hotel_rooms?hotel_id=eq.${hotelId}&select=id&limit=1`,
  );
  if (remaining.length > 0) {
    throw new Error(`hotel_rooms delete incomplete for ${hotelId}`);
  }

  const inserted = await sbWrite(
    env,
    'POST',
    'hotel_rooms',
    roomRows.map(({ _rgExt: _r, _images: _i, _amenities: _a, ...row }) => row),
    'return=representation',
  );

  const mappingPayload = inserted.map((ins, index) => {
    const roomId = String(ins['id']);
    const src = roomRows[index];
    if (src === undefined) throw new Error('insert count mismatch');
    return {
      hotel_id: hotelId,
      hotel_room_id: roomId,
      supplier: 'ratehawk' as const,
      supplier_room_key: { rg_ext: src._rgExt },
      confidence: 'auto_high' as const,
    };
  });

  await sbWrite(env, 'POST', 'room_supplier_mappings', mappingPayload, 'return=minimal');

  await sbWrite(
    env,
    'POST',
    'supplier_room_catalog?on_conflict=hotel_id,supplier,supplier_room_key',
    catalogRows,
    'resolution=merge-duplicates,return=minimal',
  );

  await sbWrite(
    env,
    'POST',
    'hotel_supplier_connections?on_conflict=hotel_id,supplier',
    [
      {
        hotel_id: hotelId,
        supplier: 'ratehawk',
        supplier_property_key: { hotelId: etgId },
        enabled: true,
        priority: 100,
        currency: 'EUR',
      },
    ],
    'resolution=merge-duplicates,return=minimal',
  );

  console.log(
    `[rh:sync-rooms] OK — ${inserted.length} hotel_rooms + ${mappingPayload.length} mapping(s) + catalog`,
  );
}

main().catch((e: unknown) => {
  console.error('[rh:sync-rooms] fatal', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
