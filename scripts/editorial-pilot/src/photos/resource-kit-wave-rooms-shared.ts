/**
 * Patches `hotel_rooms.images[]` for kit wave slugs from curated press-* maps (D15–D16).
 *
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/resource-kit-wave-rooms-shared.ts -- --slug=cheval-blanc-paris
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  buildKitWaveRoomAuditContext,
  getKitWaveRoomConfig,
  isKitWaveSlug,
  kitWaveVisibleRoomSlugs,
  lesAirellesCourchevelCatalogPatch,
  LES_AIRELLES_COURCHEVEL_ROOM_CATALOG,
  LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG,
} from '@mch/domain/editorial';

import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

function parseArgs(argv: readonly string[]): {
  readonly slug: string;
  readonly dryRun: boolean;
  readonly force: boolean;
} {
  let slug = '';
  let dryRun = false;
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--force') force = true;
  }
  if (!isKitWaveSlug(slug)) {
    throw new Error(`--slug must be one of kit wave slugs, got "${slug}"`);
  }
  return { slug, dryRun, force };
}

async function fetchRoomRows(
  cfg: SupabaseRestConfig,
  hotelId: string,
): Promise<Array<{ id: string; slug: string; imageCount: number }>> {
  const params = new URLSearchParams();
  params.set('select', 'id,slug,images');
  params.set('hotel_id', `eq.${hotelId}`);
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
  if (!Array.isArray(json)) return [];
  return json.flatMap((row) => {
    if (row === null || typeof row !== 'object') return [];
    const id = (row as { id?: unknown }).id;
    const slug = (row as { slug?: unknown }).slug;
    const images = (row as { images?: unknown }).images;
    if (typeof id !== 'string' || typeof slug !== 'string' || slug.length === 0) return [];
    const imageCount = Array.isArray(images) ? images.length : 0;
    return [{ id, slug, imageCount }];
  });
}

function buildImagePatch(
  hotelSlug: string,
  roomSlug: string,
  galleryAltFr: string,
  galleryAltEn: string,
): Record<string, unknown> | null {
  const config = getKitWaveRoomConfig(hotelSlug);
  if (config === null) return null;
  const curated = config.roomImages[roomSlug];
  if (curated === undefined) return null;
  const frames: Array<{ public_id: string; alt_fr: string; alt_en: string; category: string }> = [
    {
      public_id: curated.hero,
      alt_fr: galleryAltFr,
      alt_en: galleryAltEn,
      category: roomSlug.includes('suite') ? 'suite' : 'room',
    },
  ];
  if (curated.second !== undefined) {
    frames.push({
      public_id: curated.second,
      alt_fr: `${galleryAltFr} — vue secondaire`,
      alt_en: `${galleryAltEn} — secondary view`,
      category: roomSlug.includes('suite') ? 'suite' : 'room',
    });
  }
  return { images: frames };
}

async function patchRoom(
  cfg: SupabaseRestConfig,
  roomId: string,
  body: Record<string, unknown>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log(`[dry-run] PATCH hotel_rooms id=${roomId}`, JSON.stringify(body));
    return;
  }
  const url = `${cfg.url}/rest/v1/hotel_rooms?id=eq.${roomId}`;
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
    throw new Error(`PATCH hotel_rooms ${roomId} failed (${res.status}) ${await res.text()}`);
  }
}

export async function runKitWaveRoomResource(
  slug: string,
  dryRun: boolean,
  force = false,
): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/u, ''),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const hotels = await selectHotels<{ id: string; name: string }>(cfg, {
    columns: 'id,name',
    filters: [`slug=eq.${slug}`],
    limit: 1,
  });
  if (hotels.length === 0) throw new Error(`Hotel not found: ${slug}`);
  const hotel = hotels[0];
  if (hotel === undefined) throw new Error(`Hotel not found: ${slug}`);

  if (slug === LES_AIRELLES_COURCHEVEL_PROMOTE_SLUG) {
    for (const entry of LES_AIRELLES_COURCHEVEL_ROOM_CATALOG) {
      const rooms = await fetchRoomRows(cfg, hotel.id);
      const match = rooms.find((r) => r.slug === entry.slug);
      if (match === undefined) {
        console.warn(`[skip] room missing in DB: ${entry.slug}`);
        continue;
      }
      await patchRoom(cfg, match.id, lesAirellesCourchevelCatalogPatch(entry), dryRun);
      console.log(`[ok] ${entry.slug}`);
    }
    return;
  }

  const dbRooms = await fetchRoomRows(cfg, hotel.id);
  const auditCtx = buildKitWaveRoomAuditContext(
    slug,
    dbRooms.map((r) => ({ slug: r.slug, imageCount: r.imageCount })),
  );
  const visible = kitWaveVisibleRoomSlugs(
    slug,
    dbRooms.map((r) => r.slug),
  );

  for (const roomSlug of visible) {
    const row = dbRooms.find((r) => r.slug === roomSlug);
    if (row === undefined) continue;
    if (row.imageCount >= 1 && !force) {
      console.log(`[skip] ${roomSlug} already has ${String(row.imageCount)} image(s)`);
      continue;
    }
    const patch = buildImagePatch(
      slug,
      roomSlug,
      `Chambre ${roomSlug.replace(/-/gu, ' ')} — ${hotel.name}`,
      `Room ${roomSlug.replace(/-/gu, ' ')} — ${hotel.name}`,
    );
    if (patch === null) {
      console.warn(`[skip] no curated map for ${roomSlug}`);
      continue;
    }
    await patchRoom(cfg, row.id, patch, dryRun);
    console.log(`[ok] ${roomSlug}`);
  }

  console.log(
    `[done] ${slug} visible=${visible.join(',')} auditPickFirst=${auditCtx.orderedRoomSlugs[0] ?? 'none'}`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await runKitWaveRoomResource(args.slug, args.dryRun, args.force);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/gu, '/'))
) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
