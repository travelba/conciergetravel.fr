/**
 * Generic promote — writes kit-wave JSON payloads to `public.hotels`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot promote:kit-golden -- --slug=cheval-blanc-paris
 *   pnpm --filter @mch/editorial-pilot promote:kit-golden -- --wave5
 *   pnpm --filter @mch/editorial-pilot promote:kit-golden -- --wave5 --dry-run
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  KIT_WAVE_SLUGS,
  buildKitGoldenFieldsFromPayload,
  type KitGoldenInput,
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

const TRANSFORM_INPUT_COLUMNS = [
  'id',
  'slug',
  'name',
  'description_fr',
  'description_en',
  'awards',
  'amenities',
  'spa_info',
  'policies',
  'long_description_sections',
  'signature_experiences',
] as const;

interface PromoteRow extends KitGoldenInput {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

function parseArgs(argv: readonly string[]): {
  readonly slugs: readonly string[];
  readonly dryRun: boolean;
  readonly printJson: boolean;
} {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  let slugs: readonly string[];
  if (map.has('wave5')) slugs = [...KIT_WAVE_SLUGS];
  else {
    const slugRaw = map.get('slug');
    slugs =
      typeof slugRaw === 'string' && slugRaw.length > 0
        ? slugRaw.split(',').map((s) => s.trim())
        : [];
  }
  return {
    slugs,
    dryRun: map.has('dry-run'),
    printJson: map.has('print-json'),
  };
}

async function fetchPromoteRow(cfg: SupabaseRestConfig, slug: string): Promise<PromoteRow | null> {
  const params = new URLSearchParams();
  params.set('select', TRANSFORM_INPUT_COLUMNS.join(','));
  params.set('or', `(slug.eq.${slug},slug_en.eq.${slug})`);
  params.set('limit', '1');
  const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[promote-kit] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  return json[0] as PromoteRow;
}

async function patchRow(
  cfg: SupabaseRestConfig,
  hotelId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
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
    const responseBody = await res.text();
    throw new Error(`[promote-kit] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`);
  }
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'string') return `string(${value.length}c)`;
  if (typeof value === 'object') return `object(${Object.keys(value).length} keys)`;
  return String(value);
}

async function promoteSlug(
  cfg: SupabaseRestConfig,
  slug: string,
  dryRun: boolean,
  printJson: boolean,
): Promise<boolean> {
  console.log(`[promote-kit] slug=${slug} dryRun=${dryRun}`);
  const row = await fetchPromoteRow(cfg, slug);
  if (row === null) {
    console.error(`[promote-kit] no hotel row for "${slug}"`);
    return false;
  }
  const fields = buildKitGoldenFieldsFromPayload(slug, row);
  if (fields === null) {
    console.error(`[promote-kit] no kit payload for "${slug}"`);
    return false;
  }
  console.log(`[promote-kit] target: ${row.name} (${row.id})`);
  for (const [key, value] of Object.entries(fields)) {
    console.log(`  - ${key}: ${describeValue(value)}`);
  }
  if (printJson) console.log(JSON.stringify(fields, null, 2));
  if (dryRun) {
    console.log('[promote-kit] DRY RUN — no write');
    return true;
  }
  await patchRow(cfg, row.id, fields);
  console.log('[promote-kit] ✓ written');
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.slugs.length === 0) {
    console.error('Usage: --slug=x | --wave5 [--dry-run]');
    process.exit(1);
  }
  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  let ok = 0;
  for (const slug of args.slugs) {
    const success = await promoteSlug(cfg, slug, args.dryRun, args.printJson);
    if (success) ok += 1;
  }
  if (ok !== args.slugs.length) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('[promote-kit] fatal:', err);
  process.exit(1);
});
