/**
 * CLI — ingest `hotels.featured_reviews` (CDC §2.10 editorial pull-quotes)
 * from a **curated seed file** of REAL, citable press recognition.
 *
 * Why a seed file and not an LLM pipeline?
 * ----------------------------------------
 *   A `featured_reviews` entry is a quote ATTRIBUTED to a third party
 *   (Forbes Travel Guide, Condé Nast Traveler, Travel + Leisure,
 *   Michelin, …). Generating that text with an LLM would fabricate a
 *   press quote — forbidden by the editorial-integrity rules
 *   (`.cursor/rules/hotel-detail-page.mdc` Hard Rule 4/7,
 *   `EDITORIAL_VOICE.md`). So this pipeline only *ingests* quotes a human
 *   (or a careful, cited web-sourcing pass) has verified. Every entry
 *   MUST carry a `source_url` so provenance is one click away — the
 *   schema rejects any review without it.
 *
 * Seed shape (`featured-reviews/seed.json`):
 *   {
 *     "_doc": "free text — sourcing rules reminder",
 *     "hotels": [
 *       {
 *         "slug": "le-bristol-paris",
 *         "reviews": [
 *           {
 *             "source": "Forbes Travel Guide",
 *             "source_url": "https://www.forbestravelguide.com/hotels/...",
 *             "rating": 5, "max_rating": 5, "date_iso": "2025-01-01",
 *             "quote_fr": "…", "quote_en": "…"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Examples:
 *   pnpm exec tsx src/hotels/seed-featured-reviews.ts --dry-run
 *   pnpm exec tsx src/hotels/seed-featured-reviews.ts --slug=le-bristol-paris
 *   pnpm exec tsx src/hotels/seed-featured-reviews.ts --seed=featured-reviews/seed.json
 *
 * Skill: editorial-pilot, content-modeling, structured-data-schema-org.
 */

import { config as loadDotenv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import {
  findHotelIdBySlug,
  updateHotelFeaturedReviews,
  type FeaturedReviewPayload,
  type SupabaseRestConfig,
} from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Mirrors `FeaturedReviewSchema` in
// `apps/web/src/server/hotels/get-hotel-by-slug.ts`, but `source_url` is
// REQUIRED here (provenance gate for the ingestion path).
const SeedReviewSchema = z
  .object({
    source: z.string().min(1).max(120),
    source_url: z.string().url().startsWith('https://', 'source_url must be https'),
    author: z.string().min(1).max(160).optional(),
    quote_fr: z.string().min(1).max(500).optional(),
    quote_en: z.string().min(1).max(500).optional(),
    rating: z.number().min(0).max(100).optional(),
    max_rating: z.number().int().min(1).max(100).optional(),
    date_iso: z.string().regex(ISO_DATE_REGEX).optional(),
  })
  .refine((r) => r.quote_fr !== undefined || r.quote_en !== undefined, {
    message: 'at least one of quote_fr/quote_en is required',
  })
  .refine((r) => (r.rating !== undefined ? r.max_rating !== undefined : true), {
    message: 'rating requires max_rating',
  })
  .refine(
    (r) => (r.rating !== undefined && r.max_rating !== undefined ? r.rating <= r.max_rating : true),
    { message: 'rating must be ≤ max_rating' },
  );

const HotelSeedSchema = z.object({
  slug: z.string().min(1),
  reviews: z.array(SeedReviewSchema).min(1).max(8),
});

const SeedFileSchema = z.object({
  _doc: z.string().optional(),
  hotels: z.array(HotelSeedSchema),
});

interface CliArgs {
  readonly seedPath: string;
  readonly slug?: string;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const seedRaw = map.get('seed');
  const slugRaw = map.get('slug');
  const seedRel = typeof seedRaw === 'string' ? seedRaw : 'featured-reviews/seed.json';
  const seedPath = isAbsolute(seedRel) ? seedRel : resolve(PILOT_ROOT, seedRel);
  const out: CliArgs = { seedPath, dryRun: map.has('dry-run') };
  return typeof slugRaw === 'string' ? { ...out, slug: slugRaw } : out;
}

function toPayload(review: z.infer<typeof SeedReviewSchema>): FeaturedReviewPayload {
  const base: FeaturedReviewPayload = { source: review.source, source_url: review.source_url };
  return {
    ...base,
    ...(review.author !== undefined ? { author: review.author } : {}),
    ...(review.quote_fr !== undefined ? { quote_fr: review.quote_fr } : {}),
    ...(review.quote_en !== undefined ? { quote_en: review.quote_en } : {}),
    ...(review.rating !== undefined ? { rating: review.rating } : {}),
    ...(review.max_rating !== undefined ? { max_rating: review.max_rating } : {}),
    ...(review.date_iso !== undefined ? { date_iso: review.date_iso } : {}),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const env = SupabaseEnvSchema.safeParse(process.env);
  if (!env.success) {
    console.error(
      '[seed-featured-reviews] Missing env. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local',
    );
    process.exitCode = 1;
    return;
  }
  const cfg: SupabaseRestConfig = {
    url: env.data.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.data.SUPABASE_SERVICE_ROLE_KEY,
  };

  let raw: string;
  try {
    raw = await readFile(args.seedPath, 'utf8');
  } catch {
    console.error(`[seed-featured-reviews] Cannot read seed file: ${args.seedPath}`);
    process.exitCode = 1;
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    console.error(`[seed-featured-reviews] Seed file is not valid JSON: ${String(err)}`);
    process.exitCode = 1;
    return;
  }

  const seed = SeedFileSchema.safeParse(parsedJson);
  if (!seed.success) {
    console.error('[seed-featured-reviews] Seed file failed validation:');
    console.error(JSON.stringify(seed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }

  const blocks =
    args.slug !== undefined
      ? seed.data.hotels.filter((h) => h.slug === args.slug)
      : seed.data.hotels;

  if (blocks.length === 0) {
    console.warn(
      '[seed-featured-reviews] No hotel blocks to process (empty seed or slug filter miss).',
    );
    return;
  }

  console.log(
    `[seed-featured-reviews] ${blocks.length} hotel block(s) | seed=${args.seedPath} | ${args.dryRun ? 'DRY-RUN' : 'WRITE'}`,
  );

  let written = 0;
  let missed = 0;
  for (const block of blocks) {
    const found = await findHotelIdBySlug(cfg, block.slug);
    if (found === null) {
      console.warn(`  ✗ ${block.slug} — no matching hotel row (slug / slug_en)`);
      missed += 1;
      continue;
    }
    const payload = block.reviews.map(toPayload);
    if (args.dryRun) {
      console.log(`  • ${block.slug} (${found.name}) — ${payload.length} review(s) [dry-run]`);
      for (const r of payload)
        console.log(
          `      - ${r.source} ${r.rating ?? ''}${r.max_rating ? '/' + r.max_rating : ''}`,
        );
      continue;
    }
    await updateHotelFeaturedReviews(cfg, found.id, payload);
    console.log(`  ✓ ${block.slug} (${found.name}) — wrote ${payload.length} review(s)`);
    written += 1;
  }

  console.log(
    `[seed-featured-reviews] done — ${args.dryRun ? `${blocks.length} previewed` : `${written} written`}, ${missed} missed`,
  );
}

void main();
