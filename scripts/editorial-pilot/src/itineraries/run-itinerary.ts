#!/usr/bin/env tsx
/**
 * Sprint 4 — compose itinerary from brief JSON, validate, push to Supabase.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot itineraries:run -- paris-luxe-3-jours
 *   pnpm --filter @mch/editorial-pilot itineraries:run -- paris-luxe-3-jours --dry-run
 *   pnpm --filter @mch/editorial-pilot itineraries:audit
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { assertComposeQuality, composeItineraryFromBrief } from './compose-from-brief.js';
import { loadItineraryBrief } from './load-brief.js';
import { countItineraries, pushItinerary, resolveHotelsForBrief } from './push-itinerary.js';
import { validateItinerary } from './validate-itinerary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../apps/web/.env.local') });

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const slug = args.find((a) => !a.startsWith('--'));

  if (slug === undefined) {
    const total = await countItineraries();
    console.log(`public.itineraries row count: ${total}`);
    console.error('Usage: tsx src/itineraries/run-itinerary.ts <slug-fr> [--dry-run]');
    process.exit(1);
  }

  console.log(`Loading brief ${slug}…`);
  const brief = await loadItineraryBrief(slug);

  console.log('Resolving hotels…');
  const hotels = await resolveHotelsForBrief(brief.hotel_slugs_target, brief.destination_city);
  console.log(
    hotels.length > 0
      ? `Found ${hotels.length} hotel(s): ${hotels.map((h) => h.slug).join(', ')}`
      : 'No hotels matched — sections will omit hotel_id',
  );

  const composed = composeItineraryFromBrief(brief, hotels);
  assertComposeQuality(composed);

  const validation = validateItinerary(composed);
  if (!validation.ok) {
    console.error('Validation failed:');
    for (const issue of validation.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  await pushItinerary(composed, { dryRun });
  const total = await countItineraries();
  console.log(`public.itineraries row count after push: ${total}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
