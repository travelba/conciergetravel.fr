/**
 * CLI — promote the Conrad Los Angeles "golden template" editorial content into
 * the real `public.hotels` row.
 *
 * Golden content lives in `@mch/domain/editorial` (`conrad-los-angeles-golden.ts`),
 * shared with the apps/web local override via `patch-kit-golden-row.ts`.
 *
 * IMPORTANT — the golden field map INTENTIONALLY omits `booking_mode`, so this
 * PATCH never touches the row's `booking_mode='travelport'` pilot setting. The
 * kit golden overlays editorial + photo content only.
 *
 * Modes:
 *   --dry-run        fetch + build + print a per-field summary, NO write
 *   --slug=<slug>    target slug (default: conrad-los-angeles)
 *   --print-json     also dump the full payload that would be written
 *
 * Examples:
 *   pnpm --filter @mch/editorial-pilot promote:conrad-los-angeles-golden:dry
 *   pnpm --filter @mch/editorial-pilot promote:conrad-los-angeles-golden
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  CONRAD_LOS_ANGELES_PROMOTE_SLUG,
  buildConradLosAngelesGoldenFields,
  type ConradLosAngelesGoldenInput,
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
  'booking_mode',
  'description_fr',
  'description_en',
  'awards',
  'amenities',
  'spa_info',
  'policies',
  'long_description_sections',
  'signature_experiences',
] as const;

interface PromoteRow extends ConradLosAngelesGoldenInput {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly booking_mode: string | null;
}

function parseArgs(argv: readonly string[]): {
  readonly slug: string;
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
  const slugRaw = map.get('slug');
  return {
    slug:
      typeof slugRaw === 'string' && slugRaw.length > 0 ? slugRaw : CONRAD_LOS_ANGELES_PROMOTE_SLUG,
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
    throw new Error(
      `[promote-conrad-los-angeles] SELECT failed (${res.status}): ${body.slice(0, 300)}`,
    );
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
    throw new Error(
      `[promote-conrad-los-angeles] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`,
    );
  }
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'string') return `string(${value.length}c)`;
  if (typeof value === 'object') return `object(${Object.keys(value).length} keys)`;
  return String(value);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[promote-conrad-los-angeles] slug=${args.slug} dryRun=${args.dryRun}`);

  const row = await fetchPromoteRow(cfg, args.slug);
  if (row === null) {
    console.error(`[promote-conrad-los-angeles] no hotel row found for slug "${args.slug}".`);
    process.exit(1);
  }
  console.log(`[promote-conrad-los-angeles] target row: ${row.name} (${row.id})`);
  console.log(
    `[promote-conrad-los-angeles] booking_mode (preserved): ${row.booking_mode ?? 'null'}`,
  );

  const fields = buildConradLosAngelesGoldenFields({
    description_fr: row.description_fr,
    description_en: row.description_en,
    awards: row.awards,
    amenities: row.amenities,
    spa_info: row.spa_info,
    policies: row.policies,
    long_description_sections: row.long_description_sections,
    signature_experiences: row.signature_experiences,
  });

  if (Object.prototype.hasOwnProperty.call(fields, 'booking_mode')) {
    throw new Error(
      '[promote-conrad-los-angeles] SAFETY: golden field map must not contain booking_mode (travelport pilot must be preserved).',
    );
  }

  console.log('[promote-conrad-los-angeles] fields to write:');
  for (const [key, value] of Object.entries(fields)) {
    console.log(`  - ${key}: ${describeValue(value)}`);
  }

  if (args.printJson) {
    console.log('[promote-conrad-los-angeles] payload JSON:');
    console.log(JSON.stringify(fields, null, 2));
  }

  if (args.dryRun) {
    console.log('[promote-conrad-los-angeles] DRY RUN — no write performed.');
    return;
  }

  await patchRow(cfg, row.id, fields);
  console.log(
    `[promote-conrad-los-angeles] ✅ wrote ${Object.keys(fields).length} fields to ${row.slug} (booking_mode untouched).`,
  );
}

main().catch((err) => {
  console.error('[promote-conrad-los-angeles] FATAL', err);
  process.exit(1);
});
