/**
 * Resolve and persist Makcorps `document_id` → `hotels.makcorps_hotel_id`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot makcorps:bootstrap -- \
 *     --slug=prince-de-galles-paris [--dry-run]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveMakcorpsHotelId } from '@mch/integrations/makcorps';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { patchHotelById, selectHotels } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });
loadDotenv({ path: resolve(__dirname, '../../../../apps/web/.env.local') });

const EnvSchema = z.object({
  MAKCORPS_API_BASE: z.string().url(),
  MAKCORPS_API_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const slug = flag('slug');
  const dryRun = flag('dry-run') === 'true';

  if (slug === undefined || slug.length === 0) {
    console.error('[makcorps:bootstrap] requis : --slug=hotel-slug [--dry-run]');
    process.exit(1);
  }

  const supabase = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const hotels = await selectHotels<{
    id: string;
    slug: string;
    name: string;
    city: string;
    makcorps_hotel_id: string | null;
  }>(supabase, {
    columns: 'id,slug,name,city,makcorps_hotel_id',
    filters: [`slug=eq.${encodeURIComponent(slug)}`],
    limit: 1,
  });

  const hotel = hotels[0];
  if (hotel === undefined) {
    console.error(`[makcorps:bootstrap] hôtel introuvable : ${slug}`);
    process.exit(1);
  }

  const cfg = { baseUrl: env.MAKCORPS_API_BASE, apiKey: env.MAKCORPS_API_KEY };
  const resolved = await resolveMakcorpsHotelId(cfg, {
    name: hotel.name,
    city: hotel.city,
  });

  if (!resolved.ok) {
    console.error('[makcorps:bootstrap] mapping Makcorps échoué', resolved.error);
    process.exit(1);
  }

  const makcorpsId = resolved.value;
  console.log(
    `[makcorps:bootstrap] ${slug} → makcorps_hotel_id=${makcorpsId}` +
      (hotel.makcorps_hotel_id === makcorpsId ? ' (déjà à jour)' : ''),
  );

  if (dryRun) {
    console.log('[makcorps:bootstrap] DRY RUN — aucune écriture.');
    return;
  }

  await patchHotelById(supabase, hotel.id, { makcorps_hotel_id: makcorpsId });
  console.log('[makcorps:bootstrap] OK — makcorps_hotel_id persisté.');
}

main().catch((err: unknown) => {
  console.error('[makcorps:bootstrap] FATAL', err);
  process.exit(1);
});
