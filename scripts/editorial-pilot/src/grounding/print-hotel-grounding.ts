/**
 * CLI — print the DataForSEO grounding block (real People-Also-Ask + top
 * keywords) for a single hotel, ready to paste into the Perplexity FAQ research
 * template (`prompts/12-hotel-faq-perplexity-research.md`, `{{REAL_QUERIES_PAA}}`).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/grounding/print-hotel-grounding.ts --slug=le-meurice [--refresh]
 *
 * Degrade-safe: prints a notice when DFS is off so the research can still run
 * (LLM-only). Reuses the same cache + helper as the batch generators, so a slug
 * already grounded by another pipeline costs zero extra DFS requests.
 *
 * Skill: keyword-grounding-dataforseo.
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { loadDfsConfig } from './env-dfs.js';
import { groundHotel } from './hotel-grounding.js';
import {
  listHotels,
  projectHotelForLlm,
  type SupabaseRestConfig,
} from '../hotels/supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slug = argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
  const refresh = argv.includes('--refresh');
  if (slug === undefined || slug.length === 0) {
    console.error('--slug=<slug> is required');
    process.exit(1);
  }

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const rows = await listHotels(supabase, {
    slug,
    onlyPublished: false,
    requireDescription: false,
  });
  const row = rows[0];
  if (row === undefined) {
    console.error(`Hotel not found: ${slug}`);
    process.exit(1);
  }

  const dfsCfg = loadDfsConfig();
  if (dfsCfg === null) {
    console.log('(DataForSEO is OFF — no grounding. Run with LLM-only FAQ research.)');
    return;
  }

  const input = projectHotelForLlm(row);
  const { grounding, block } = await groundHotel(dfsCfg, input, refresh ? { refresh: true } : {});
  if (!grounding.grounded || block.length === 0) {
    console.log('(No grounding available for this hotel — LLM-only FAQ research.)');
    return;
  }
  console.log(block);
}

main().catch((err) => {
  console.error('[print-hotel-grounding] FATAL', err);
  process.exit(1);
});
