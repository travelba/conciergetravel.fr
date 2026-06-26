/**
 * CLI — backfill `hotels.name_en` + `hotels.slug_en` so every published fiche
 * exposes a complete hreflang `en` alternate (the EN route resolves on
 * `slug_en` first, then falls back to `slug` — see
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts` `getHotelBySlugUncached`).
 *
 * Policy (idempotent — only fills NULLs, never overwrites):
 *   - `name_en` ← `name`. Hotel names are proper nouns / brands; a faithful
 *     EN alternate is the same string, never a machine translation.
 *   - `slug_en` ← `slug`. The app already serves the EN page at the FR slug via
 *     fallback, so reusing `slug` keeps every live EN URL byte-identical (no
 *     redirect / no lost indexation) AND `slug` is already kebab-case ASCII.
 *     Uniqueness on `slug_en` is mandatory (the reader uses `.maybeSingle()`):
 *     a collision with an existing `slug_en` is resolved with a `-2`, `-3`…
 *     suffix.
 *
 * Examples:
 *   pnpm exec tsx src/hotels/backfill-hotel-name-slug-en.ts --dry-run
 *   pnpm exec tsx src/hotels/backfill-hotel-name-slug-en.ts
 *
 * Skill: editorial-pilot, seo-technical, content-modeling.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import type { SupabaseRestConfig } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

interface SlugRow {
  readonly id: string;
  readonly slug: string;
  readonly slug_en: string | null;
  readonly name: string;
  readonly name_en: string | null;
  readonly is_published: boolean;
}

function parseArgs(argv: readonly string[]): { dryRun: boolean; includeDrafts: boolean } {
  const set = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
  return { dryRun: set.has('dry-run'), includeDrafts: set.has('include-drafts') };
}

async function fetchAll(cfg: SupabaseRestConfig, onlyPublished: boolean): Promise<SlugRow[]> {
  const PAGE = 1000;
  const out: SlugRow[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', 'id,slug,slug_en,name,name_en,is_published');
    params.set('order', 'slug.asc');
    params.set('limit', String(PAGE));
    if (offset > 0) params.set('offset', String(offset));
    const filter = onlyPublished ? '&is_published=eq.true' : '';
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}${filter}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[backfill-en] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[backfill-en] SELECT did not return an array');
    out.push(...(json as SlugRow[]));
    if (json.length < PAGE) break;
    offset += json.length;
  }
  return out;
}

async function patch(
  cfg: SupabaseRestConfig,
  id: string,
  body: Record<string, string>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(id)}`;
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
    throw new Error(`[backfill-en] PATCH failed (${res.status}): ${responseBody.slice(0, 300)}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseEnv = SupabaseEnvSchema.parse(process.env);
  const supabase: SupabaseRestConfig = {
    url: supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Read the WHOLE catalogue (published + drafts) so the uniqueness set covers
  // every existing `slug_en`, even when we only WRITE published rows.
  const all = await fetchAll(supabase, false);
  const taken = new Set<string>();
  for (const r of all) {
    if (r.slug_en !== null && r.slug_en.length > 0) taken.add(r.slug_en);
  }

  const targets = all.filter(
    (r) =>
      (args.includeDrafts || r.is_published) &&
      (r.name_en === null ||
        r.name_en.length === 0 ||
        r.slug_en === null ||
        r.slug_en.length === 0),
  );

  console.log(
    `[backfill-en] catalogue=${all.length} existing-slug_en=${taken.size} targets=${targets.length} dryRun=${args.dryRun}`,
  );

  let nameWrites = 0;
  let slugWrites = 0;
  let suffixed = 0;

  for (const row of targets) {
    const body: Record<string, string> = {};

    if (row.name_en === null || row.name_en.length === 0) {
      body['name_en'] = row.name;
      nameWrites++;
    }

    if (row.slug_en === null || row.slug_en.length === 0) {
      let candidate = row.slug;
      if (taken.has(candidate)) {
        let n = 2;
        while (taken.has(`${candidate}-${n}`)) n++;
        candidate = `${candidate}-${n}`;
        suffixed++;
      }
      taken.add(candidate);
      body['slug_en'] = candidate;
      slugWrites++;
    }

    if (Object.keys(body).length === 0) continue;
    if (!args.dryRun) await patch(supabase, row.id, body);
  }

  console.log('---');
  console.log(
    `[backfill-en] DONE name_en=${nameWrites} slug_en=${slugWrites} (suffixed=${suffixed})${
      args.dryRun ? ' [dry-run — no writes]' : ''
    }`,
  );
}

main().catch((err) => {
  console.error('[backfill-en] FATAL', err);
  process.exit(1);
});
