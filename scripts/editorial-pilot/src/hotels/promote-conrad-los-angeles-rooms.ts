/**
 * CLI — promote the Conrad Los Angeles room catalogue into `public.hotel_rooms`.
 *
 * Conrad LA's live inventory was seeded from a RateHawk SANDBOX property (fake
 * "river view" / "villa pool" rooms, no photos). This script REPLACES it with
 * the real Conrad LA taxonomy (conrad-los-angeles-rooms.ts):
 *   1. upsert each curated room (by room_code)
 *   2. delete any leftover room whose slug is not in the curated catalogue
 *      (the sandbox rows)
 *
 * booking_mode stays `travelport` — only the room CONTENT is curated.
 *
 *   pnpm --filter @mch/editorial-pilot promote:conrad-los-angeles-rooms
 *   pnpm --filter @mch/editorial-pilot promote:conrad-los-angeles-rooms --dry-run
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  CONRAD_LOS_ANGELES_PROMOTE_SLUG,
  CONRAD_LOS_ANGELES_ROOM_CATALOG,
  conradLosAngelesCatalogPatch,
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

function authHeaders(cfg: SupabaseRestConfig): Record<string, string> {
  return {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    Accept: 'application/json',
  };
}

async function fetchHotelId(cfg: SupabaseRestConfig, slug: string): Promise<string | null> {
  const params = new URLSearchParams();
  params.set('select', 'id');
  params.set('slug', `eq.${slug}`);
  params.set('limit', '1');
  const res = await fetch(`${cfg.url}/rest/v1/hotels?${params.toString()}`, {
    headers: authHeaders(cfg),
  });
  if (!res.ok) throw new Error(`SELECT hotels failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  const row = json[0] as { id?: unknown };
  return typeof row.id === 'string' ? row.id : null;
}

async function fetchRooms(
  cfg: SupabaseRestConfig,
  hotelId: string,
): Promise<Array<{ id: string; slug: string; room_code: string | null }>> {
  const params = new URLSearchParams();
  params.set('select', 'id,slug,room_code');
  params.set('hotel_id', `eq.${hotelId}`);
  const res = await fetch(`${cfg.url}/rest/v1/hotel_rooms?${params.toString()}`, {
    headers: authHeaders(cfg),
  });
  if (!res.ok) throw new Error(`SELECT hotel_rooms failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) return [];
  return json.flatMap((row) => {
    if (row === null || typeof row !== 'object') return [];
    const id = (row as { id?: unknown }).id;
    const slug = (row as { slug?: unknown }).slug;
    const roomCode = (row as { room_code?: unknown }).room_code;
    if (typeof id !== 'string') return [];
    return [
      {
        id,
        slug: typeof slug === 'string' ? slug : '',
        room_code: typeof roomCode === 'string' ? roomCode : null,
      },
    ];
  });
}

async function upsertRoom(
  cfg: SupabaseRestConfig,
  hotelId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/hotel_rooms`, {
    method: 'POST',
    headers: {
      ...authHeaders(cfg),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ hotel_id: hotelId, ...body }),
  });
  if (!res.ok) {
    throw new Error(
      `UPSERT hotel_rooms failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}

async function patchRoom(
  cfg: SupabaseRestConfig,
  roomId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/hotel_rooms?id=eq.${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(cfg),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `PATCH hotel_rooms failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}

async function deleteRoom(cfg: SupabaseRestConfig, roomId: string): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/hotel_rooms?id=eq.${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders(cfg), Prefer: 'return=minimal' },
  });
  if (!res.ok) {
    throw new Error(
      `DELETE hotel_rooms failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const env = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/u, ''),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const curatedSlugs = new Set(CONRAD_LOS_ANGELES_ROOM_CATALOG.map((e) => e.slug));
  console.log(
    `[promote-conrad-los-angeles-rooms] catalogue=${CONRAD_LOS_ANGELES_ROOM_CATALOG.length} dryRun=${dryRun}`,
  );

  const hotelId = await fetchHotelId(cfg, CONRAD_LOS_ANGELES_PROMOTE_SLUG);
  if (hotelId === null) throw new Error(`Hotel not found: ${CONRAD_LOS_ANGELES_PROMOTE_SLUG}`);

  const existing = await fetchRooms(cfg, hotelId);
  const toDelete = existing.filter((r) => !curatedSlugs.has(r.slug));

  if (dryRun) {
    for (const entry of CONRAD_LOS_ANGELES_ROOM_CATALOG) {
      const sizeLabel = entry.size_sqm !== null ? `${entry.size_sqm} m²` : '—';
      const photo = entry.hero_image !== null ? entry.hero_image.split('/').pop() : 'no-photo';
      console.log(`  upsert ${entry.slug.padEnd(28)} ${sizeLabel.padStart(7)} · ${photo}`);
    }
    for (const r of toDelete) {
      console.log(`  delete ${r.slug} (${r.id})`);
    }
    console.log('[promote-conrad-los-angeles-rooms] DRY RUN — no write.');
    return;
  }

  for (const entry of CONRAD_LOS_ANGELES_ROOM_CATALOG) {
    const payload = conradLosAngelesCatalogPatch(entry);
    const match = existing.find((r) => r.room_code === entry.room_code || r.slug === entry.slug);
    if (match === undefined) {
      await upsertRoom(cfg, hotelId, payload);
      console.log(`[promote-conrad-los-angeles-rooms] inserted ${entry.slug}`);
      continue;
    }
    await patchRoom(cfg, match.id, payload);
    console.log(`[promote-conrad-los-angeles-rooms] patched ${entry.slug} (${match.id})`);
  }

  for (const r of toDelete) {
    await deleteRoom(cfg, r.id);
    console.log(`[promote-conrad-los-angeles-rooms] deleted sandbox room ${r.slug} (${r.id})`);
  }

  console.log(
    `[promote-conrad-los-angeles-rooms] done — ${CONRAD_LOS_ANGELES_ROOM_CATALOG.length} curated, ${toDelete.length} sandbox removed.`,
  );
}

main().catch((err: unknown) => {
  console.error('[promote-conrad-los-angeles-rooms] FATAL', err);
  process.exit(1);
});
