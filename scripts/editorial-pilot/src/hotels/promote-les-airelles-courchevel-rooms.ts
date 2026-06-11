/**
 * CLI — promote Les Airelles Courchevel room catalogue into `public.hotel_rooms`.
 *
 *   pnpm --filter @mch/editorial-pilot promote:les-airelles-courchevel-rooms
 *   pnpm --filter @mch/editorial-pilot promote:les-airelles-courchevel-rooms --dry-run
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG,
  LES_AIRELLES_COURCHEVEL_ROOM_CATALOG,
  lesAirellesCourchevelCatalogPatch,
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

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[promote-les-airelles-courchevel-rooms] catalogue=${LES_AIRELLES_COURCHEVEL_ROOM_CATALOG.length} dryRun=${dryRun}`,
  );

  if (dryRun) {
    for (const entry of LES_AIRELLES_COURCHEVEL_ROOM_CATALOG) {
      const sizeLabel = entry.size_sqm !== null ? `${entry.size_sqm} m²` : '—';
      console.log(`  ${entry.room_code} → ${entry.hero_image} · ${sizeLabel}`);
    }
    console.log('[promote-les-airelles-courchevel-rooms] DRY RUN — no write.');
    return;
  }

  const hotelId = await fetchHotelId(cfg, LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG);
  if (hotelId === null) {
    throw new Error(`Hotel not found: ${LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG}`);
  }

  for (const entry of LES_AIRELLES_COURCHEVEL_ROOM_CATALOG) {
    const payload = lesAirellesCourchevelCatalogPatch(entry);
    const existingId = await fetchRoomId(cfg, hotelId, entry.room_code);
    if (existingId === null) {
      await upsertRoom(cfg, hotelId, payload);
      console.log(`[promote-les-airelles-courchevel-rooms] inserted ${entry.slug}`);
      continue;
    }
    await patchRoom(cfg, existingId, payload);
    console.log(`[promote-les-airelles-courchevel-rooms] patched ${entry.slug} (${existingId})`);
  }
}

main().catch((err: unknown) => {
  console.error('[promote-les-airelles-courchevel-rooms] FATAL', err);
  process.exit(1);
});
