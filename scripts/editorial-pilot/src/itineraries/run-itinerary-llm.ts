#!/usr/bin/env tsx
/**
 * LLM itinerary runner — compose with OpenAI + resolve hotels LIVE from
 * Postgres + push to Supabase, in one shot.
 *
 * `run-itinerary.ts` resolves hotels from the DB and pushes, but uses the
 * deterministic *templated* composer (destination-neutral prose).
 * `run-all-briefs.ts --llm` uses the OpenAI composer but resolves hotels
 * from the static `hotel-map.generated.ts` snapshot (≈ 51 hotels, only
 * those cited by the original 20 briefs) and only emits SQL.
 *
 * This runner combines the best of both: OpenAI prose quality + live DB
 * hotel resolution (so brand-new briefs citing Aman / Belmond / Maldives
 * hotels link real UUIDs without regenerating the snapshot) + direct push.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/itineraries/run-itinerary-llm.ts <slug-fr> [--draft] [--dry-run]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { composeItineraryWithLlm } from './compose-from-brief-llm.js';
import { loadItineraryBrief } from './load-brief.js';
import {
  countItineraries,
  pushItinerary,
  resolveHotelsForBrief,
  resolveRankingIdsBySlug,
} from './push-itinerary.js';
import type { GeneratedItinerary } from './types.js';
import { validateItinerary } from './validate-itinerary.js';
import { loadEnv } from '../env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../apps/web/.env.local') });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const publish = !args.includes('--draft');
  const slug = args.find((a) => !a.startsWith('--'));

  if (slug === undefined) {
    const total = await countItineraries();
    console.log(`public.itineraries row count: ${total}`);
    console.error(
      'Usage: tsx src/itineraries/run-itinerary-llm.ts <slug-fr> [--draft] [--dry-run]',
    );
    process.exit(1);
  }

  console.log(`Loading brief ${slug}…`);
  const brief = await loadItineraryBrief(slug);

  console.log('Resolving hotels (live DB)…');
  const hotels = await resolveHotelsForBrief(brief.hotel_slugs_target, brief.destination_city);
  console.log(
    hotels.length > 0
      ? `Found ${hotels.length} hotel(s): ${hotels.map((h) => h.slug).join(', ')}`
      : 'No hotels matched — sections will omit hotel_id',
  );

  console.log('Resolving related ranking IDs (live DB)…');
  const relatedRankingIds = await resolveRankingIdsBySlug(brief.related_ranking_slugs_target);
  if (relatedRankingIds.length > 0) {
    console.log(`Linked ${relatedRankingIds.length} ranking(s).`);
  }

  // The validator is strict (FAQ 50-100 words, sections ≥150, AEO 40-80).
  // LLM output occasionally drifts a few words out of band, so compose up
  // to 3 times and keep the first run that passes.
  const env = loadEnv();
  let validated: GeneratedItinerary | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`Composing with OpenAI (attempt ${attempt}/3)…`);
    const composed = await composeItineraryWithLlm(brief, hotels, env, {
      status: publish ? 'published' : 'draft',
    });
    const validation = validateItinerary({ ...composed, related_ranking_ids: relatedRankingIds });
    if (validation.ok && validation.data !== null) {
      validated = validation.data;
      break;
    }
    console.warn(`  Attempt ${attempt} failed validation:`);
    for (const issue of validation.issues) {
      console.warn(`    - ${issue.path}: ${issue.message}`);
    }
  }

  if (validated === null) {
    console.error('All 3 compose attempts failed validation. Aborting.');
    process.exit(1);
  }

  await pushItinerary(validated, { dryRun });
  const total = await countItineraries();
  console.log(
    `${dryRun ? '(dry-run) ' : ''}public.itineraries row count after push: ${total} — status=${
      publish ? 'published' : 'draft'
    }`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
