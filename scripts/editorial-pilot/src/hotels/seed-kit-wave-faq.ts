/**
 * Seed faq_content_kit (42) + faq_content promote (15) for kit wave 5 slugs.
 *
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/seed-kit-wave-faq.ts
 *   pnpm --filter @mch/editorial-pilot exec tsx src/hotels/seed-kit-wave-faq.ts -- --slug=cheval-blanc-paris
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  KIT_WAVE_SLUGS,
  buildKitWaveFaqKit,
  buildKitWaveFaqPromote,
  isKitWaveSlug,
} from '@mch/domain/editorial';

import { patchHotelById, selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

function parseArgs(argv: readonly string[]): {
  readonly slugs: readonly string[];
  readonly dryRun: boolean;
} {
  let slug: string | null = null;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg === '--dry-run') dryRun = true;
  }
  const slugs =
    slug !== null && slug.length > 0 ? slug.split(',').map((s) => s.trim()) : [...KIT_WAVE_SLUGS];
  return { slugs, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
    })
    .parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/u, ''),
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  for (const slug of args.slugs) {
    if (!isKitWaveSlug(slug)) {
      console.warn(`[skip] not a kit wave slug: ${slug}`);
      continue;
    }
    const rows = await selectHotels<{ id: string }>(cfg, {
      columns: 'id',
      filters: [`slug=eq.${slug}`],
      limit: 1,
    });
    if (rows.length === 0) {
      console.warn(`[skip] hotel not found: ${slug}`);
      continue;
    }
    const hotel = rows[0];
    if (hotel === undefined) continue;

    const kit = buildKitWaveFaqKit(slug);
    const promote = buildKitWaveFaqPromote(slug);
    console.log(`[seed-faq] ${slug} kit=${kit.length} promote=${promote.length}`);

    if (args.dryRun) continue;

    await patchHotelById(cfg, hotel.id, {
      faq_content_kit: kit,
      faq_content: promote,
    });
    console.log(`[seed-faq] ✓ ${slug} patched`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
