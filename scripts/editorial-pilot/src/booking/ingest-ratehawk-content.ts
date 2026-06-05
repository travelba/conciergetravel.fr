/**
 * Ingest RateHawk / ETG static room content into `public.supplier_room_catalog`
 * (migration 0071). Phase 2 of the multi-supplier plan.
 *
 * Pulls `room_groups` (name, amenities, images, `rg_ext`) for an ETG hotel and
 * upserts one cache row per room group, keyed by `(hotel_id, supplier,
 * supplier_room_key)`. This cache (a) helps build/validate
 * `room_supplier_mappings` and (b) feeds the NON-INDEXED booking funnel.
 *
 * RateHawk media/descriptions are contractually non-indexable — this cache is
 * funnel-only; indexable pages keep curated Cloudinary photos.
 *
 * Env (.env.local) : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   RATEHAWK_API_BASE, RATEHAWK_KEY_ID, RATEHAWK_API_KEY.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot ratehawk:ingest -- \
 *     --hotel-id=<etg_id> --supabase-hotel-id=<uuid> [--dry-run]
 *
 * Skills : api-integration, supabase-postgres-rls, windows-dev-environment.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createRateHawkConnector,
  rgExtKey,
  type RateHawkClientConfig,
} from '@mch/integrations/ratehawk';
import type { SupplierPropertyKey } from '@mch/integrations/supplier';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  RATEHAWK_API_BASE: z.string().url(),
  RATEHAWK_KEY_ID: z.string().min(1),
  RATEHAWK_API_KEY: z.string().min(1),
});

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

interface CatalogRow {
  readonly hotel_id: string;
  readonly supplier: 'ratehawk';
  readonly supplier_room_key: { readonly rg_ext: Readonly<Record<string, number>> };
  readonly room_name: string | null;
  readonly room_amenities: readonly string[];
  readonly images: readonly string[];
  readonly raw: unknown;
}

async function upsertCatalog(
  url: string,
  serviceRoleKey: string,
  rows: readonly CatalogRow[],
): Promise<void> {
  const endpoint = `${url}/rest/v1/supplier_room_catalog?on_conflict=hotel_id,supplier,supplier_room_key`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
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
    console.error('[ratehawk:ingest] env manquant :');
    console.error(
      parsedEnv.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const etgHotelId = flag('hotel-id');
  const supabaseHotelId = flag('supabase-hotel-id');
  const dryRun = flag('dry-run') === 'true';

  if (etgHotelId === undefined || supabaseHotelId === undefined) {
    console.error(
      '[ratehawk:ingest] requis : --hotel-id=<etg_id> --supabase-hotel-id=<uuid> [--dry-run]',
    );
    process.exitCode = 1;
    return;
  }

  const cfg: RateHawkClientConfig = {
    baseUrl: parsedEnv.data.RATEHAWK_API_BASE,
    keyId: parsedEnv.data.RATEHAWK_KEY_ID,
    apiKey: parsedEnv.data.RATEHAWK_API_KEY,
  };
  const connector = createRateHawkConnector(cfg);
  const propertyKey: SupplierPropertyKey = { supplier: 'ratehawk', hotelId: etgHotelId };

  const content = await connector.getStaticRoomContent({ propertyKey });
  if (!content.ok) {
    console.error(`[ratehawk:ingest] content KO: ${content.error.kind}`, content.error);
    process.exitCode = 1;
    return;
  }

  const rows: CatalogRow[] = [];
  for (const room of content.value) {
    if (room.roomKey.supplier !== 'ratehawk') continue;
    rows.push({
      hotel_id: supabaseHotelId,
      supplier: 'ratehawk',
      supplier_room_key: { rg_ext: room.roomKey.rgExt },
      room_name: room.name,
      room_amenities: room.amenities,
      images: room.imageUrls,
      raw: { rg_ext_key: rgExtKey(room.roomKey.rgExt) },
    });
  }

  console.log(`[ratehawk:ingest] ${rows.length} room_groups normalisés pour ${etgHotelId}.`);
  if (dryRun) {
    console.log('[ratehawk:ingest] --dry-run : aucune écriture. Aperçu :');
    for (const r of rows) {
      console.log(
        `  - ${r.room_name ?? '(sans nom)'} | imgs=${r.images.length} | rg=${JSON.stringify(r.supplier_room_key.rg_ext)}`,
      );
    }
    return;
  }

  if (rows.length === 0) {
    console.log('[ratehawk:ingest] rien à écrire.');
    return;
  }

  await upsertCatalog(
    parsedEnv.data.NEXT_PUBLIC_SUPABASE_URL,
    parsedEnv.data.SUPABASE_SERVICE_ROLE_KEY,
    rows,
  );
  console.log(`[ratehawk:ingest] upsert OK — ${rows.length} lignes dans supplier_room_catalog.`);
}

main().catch((err: unknown) => {
  console.error('[ratehawk:ingest] fatal', err);
  process.exitCode = 1;
});
