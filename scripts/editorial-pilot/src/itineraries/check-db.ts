#!/usr/bin/env tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { countItineraries, resolveHotelsForBrief } from '../itineraries/push-itinerary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../apps/web/.env.local') });

async function main(): Promise<void> {
  const total = await countItineraries();
  console.log(`itineraries count: ${total}`);

  const parisHotels = await resolveHotelsForBrief(
    ['ritz-paris', 'plaza-athenee-paris', 'hotel-de-crillon'],
    'Paris',
  );
  console.log('Paris palace slugs resolved:');
  for (const h of parisHotels) {
    console.log(`  ${h.slug} → ${h.name} (${h.id})`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
