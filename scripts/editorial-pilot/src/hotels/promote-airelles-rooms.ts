/**
 * CLI — promote the Airelles indexable room sub-page payload into `public.hotel_rooms`.
 *
 * Ensures CDC §2.5 / ADR-0009: ≥1 indexable room (slug + long_description_fr ≥ 800
 * chars + ≥ 5 photos). Source: `@mch/domain/editorial` (`AIRELLES_INDEXABLE_ROOM`).
 *
 *   pnpm --filter @mch/editorial-pilot promote:airelles-rooms
 *   pnpm --filter @mch/editorial-pilot promote:airelles-rooms --dry-run
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { AIRELLES_INDEXABLE_ROOM, AIRELLES_PROMOTE_SLUG } from '@mch/domain/editorial';

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

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const room = AIRELLES_INDEXABLE_ROOM;
  const payload: Record<string, unknown> = {
    room_code: room.room_code,
    slug: room.slug,
    name_fr: room.name_fr,
    name_en: room.name_en,
    description_fr: room.description_fr,
    description_en: room.description_en,
    long_description_fr: room.long_description_fr,
    long_description_en: room.long_description_en,
    max_occupancy: room.max_occupancy,
    bed_type: room.bed_type,
    size_sqm: room.size_sqm,
    is_signature: room.is_signature,
    display_order: room.display_order,
    hero_image: room.hero_image,
    images: room.images,
    amenities: [],
  };

  console.log(
    `[promote-airelles-rooms] slug=${room.slug} long_fr=${room.long_description_fr.length}c images=${room.images.length} dryRun=${dryRun}`,
  );

  if (dryRun) {
    console.log('[promote-airelles-rooms] DRY RUN — no write.');
    return;
  }

  const hotelId = await fetchHotelId(cfg, AIRELLES_PROMOTE_SLUG);
  if (hotelId === null) {
    throw new Error(`Hotel not found: ${AIRELLES_PROMOTE_SLUG}`);
  }

  const existingId = await fetchRoomId(cfg, hotelId, room.room_code);
  if (existingId === null) {
    await upsertRoom(cfg, hotelId, payload);
    console.log(`[promote-airelles-rooms] inserted ${room.slug}`);
  } else {
    await patchRoom(cfg, existingId, payload);
    console.log(`[promote-airelles-rooms] patched ${room.slug} (${existingId})`);
  }
}

main().catch((err: unknown) => {
  console.error('[promote-airelles-rooms] FATAL', err);
  process.exit(1);
});
