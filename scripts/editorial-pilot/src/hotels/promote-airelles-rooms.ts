/**
 * CLI — promote Airelles room catalogue facts + hero photos into `public.hotel_rooms`.
 *
 * Patches `size_sqm`, `bed_type`, `hero_image` and a single-frame `images[]`
 * for every golden catalogue row (12 official categories). The indexable
 * Vasarely sub-page long copy is still sourced from `AIRELLES_INDEXABLE_ROOM`.
 *
 *   pnpm --filter @mch/editorial-pilot promote:airelles-rooms
 *   pnpm --filter @mch/editorial-pilot promote:airelles-rooms --dry-run
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  AIRELLES_INDEXABLE_ROOM,
  AIRELLES_PROMOTE_SLUG,
  AIRELLES_ROOM_CATALOG,
} from '@mch/domain/editorial';

import type { SupabaseRestConfig } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

function parseArgs(argv: readonly string[]): { readonly dryRun: boolean } {
  return { dryRun: argv.includes('--dry-run') };
}

async function fetchHotelId(cfg: SupabaseRestConfig, slug: string): Promise<string | null> {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('slug', `eq.${slug}`);
  params.set('limit', '1');
  const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`SELECT hotels failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  const row = json[0] as { id?: unknown };
  return typeof row.id === 'string' ? row.id : null;
}

async function fetchRoomId(
  cfg: SupabaseRestConfig,
  hotelId: string,
  roomCode: string,
): Promise<string | null> {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('hotel_id', `eq.${hotelId}`);
  params.set('room_code', `eq.${roomCode}`);
  params.set('limit', '1');
  const url = `${cfg.url}/rest/v1/hotel_rooms?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`SELECT hotel_rooms failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  const row = json[0] as { id?: unknown };
  return typeof row.id === 'string' ? row.id : null;
}

async function upsertRoom(
  cfg: SupabaseRestConfig,
  hotelId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotel_rooms`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ hotel_id: hotelId, ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UPSERT hotel_rooms failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function patchRoom(
  cfg: SupabaseRestConfig,
  roomId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotel_rooms?id=eq.${encodeURIComponent(roomId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH hotel_rooms failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

function catalogPatch(entry: (typeof AIRELLES_ROOM_CATALOG)[number]): Record<string, unknown> {
  return {
    room_code: entry.room_code,
    slug: entry.slug,
    name_fr: entry.name_fr,
    name_en: entry.name_en,
    description_fr: entry.description_fr,
    description_en: entry.description_en,
    max_occupancy: entry.max_occupancy,
    bed_type: entry.bed_type_fr,
    size_sqm: entry.size_sqm,
    is_signature: entry.is_signature === true,
    display_order: entry.display_order ?? null,
    hero_image: entry.hero_image,
    images: [
      {
        public_id: entry.hero_image,
        alt_fr: entry.hero_alt_fr,
        alt_en: entry.hero_alt_en,
        category: entry.size_sqm >= 50 ? 'suite' : 'room',
      },
    ],
  };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[promote-airelles-rooms] catalogue=${AIRELLES_ROOM_CATALOG.length} indexable=${AIRELLES_INDEXABLE_ROOM.slug} dryRun=${dryRun}`,
  );

  if (dryRun) {
    for (const entry of AIRELLES_ROOM_CATALOG) {
      console.log(`  ${entry.room_code} → ${entry.hero_image} · ${entry.size_sqm} m²`);
    }
    console.log('[promote-airelles-rooms] DRY RUN — no write.');
    return;
  }

  const hotelId = await fetchHotelId(cfg, AIRELLES_PROMOTE_SLUG);
  if (hotelId === null) {
    throw new Error(`Hotel not found: ${AIRELLES_PROMOTE_SLUG}`);
  }

  for (const entry of AIRELLES_ROOM_CATALOG) {
    const payload = catalogPatch(entry);
    const existingId = await fetchRoomId(cfg, hotelId, entry.room_code);
    if (existingId === null) {
      await upsertRoom(cfg, hotelId, payload);
      console.log(`[promote-airelles-rooms] inserted ${entry.slug}`);
      continue;
    }
    await patchRoom(cfg, existingId, payload);
    console.log(`[promote-airelles-rooms] patched ${entry.slug} (${existingId})`);
  }

  const indexable = AIRELLES_INDEXABLE_ROOM;
  const indexPayload: Record<string, unknown> = {
    room_code: indexable.room_code,
    slug: indexable.slug,
    name_fr: indexable.name_fr,
    name_en: indexable.name_en,
    description_fr: indexable.description_fr,
    description_en: indexable.description_en,
    long_description_fr: indexable.long_description_fr,
    long_description_en: indexable.long_description_en,
    max_occupancy: indexable.max_occupancy,
    bed_type: indexable.bed_type,
    size_sqm: indexable.size_sqm,
    is_signature: indexable.is_signature,
    display_order: indexable.display_order,
    hero_image: indexable.hero_image,
    images: indexable.images,
    amenities: [],
  };
  const vasarelyId = await fetchRoomId(cfg, hotelId, indexable.room_code);
  if (vasarelyId === null) {
    await upsertRoom(cfg, hotelId, indexPayload);
    console.log(`[promote-airelles-rooms] inserted indexable ${indexable.slug}`);
  } else {
    await patchRoom(cfg, vasarelyId, indexPayload);
    console.log(`[promote-airelles-rooms] patched indexable ${indexable.slug}`);
  }
}

main().catch((err: unknown) => {
  console.error('[promote-airelles-rooms] FATAL', err);
  process.exit(1);
});
