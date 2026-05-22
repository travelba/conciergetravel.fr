#!/usr/bin/env tsx
/**
 * Dump a composed itinerary as JSON to stdout (or to a file) WITHOUT
 * touching Postgres. The DB-side push is performed separately via the
 * Supabase MCP `execute_sql` tool — keeping the script pure makes it
 * usable in CI / agent loops that don't have a DB connection string.
 *
 * Usage:
 *   tsx src/itineraries/dump-itinerary.ts <slug-fr> --hotels='{"hint":"uuid","hint2":"uuid2"}' [--out=path.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { assertComposeQuality, composeItineraryFromBrief } from './compose-from-brief.js';
import { loadItineraryBrief } from './load-brief.js';
import { resolveHotelSlugHint } from './country-codes.js';
import { validateItinerary } from './validate-itinerary.js';
import type { ResolvedHotel } from './types.js';

function parseFlag(args: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  for (const a of args) {
    if (a.startsWith(prefix)) return a.slice(prefix.length);
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  if (slug === undefined) {
    console.error("Usage: dump-itinerary.ts <slug> --hotels='{...}' [--out=path]");
    process.exit(1);
  }

  const hotelsJson = parseFlag(args, 'hotels');
  const hotelsFile = parseFlag(args, 'hotels-file');
  let raw: string | null = null;
  if (hotelsFile !== null) {
    raw = readFileSync(hotelsFile, 'utf8');
  } else if (hotelsJson !== null) {
    raw = hotelsJson;
  } else {
    console.error("--hotels-file=path.json or --hotels='{...}' required");
    process.exit(1);
  }
  const hotelMap = JSON.parse(raw) as Record<string, { id: string; slug: string; name: string }>;

  const brief = await loadItineraryBrief(slug);

  const hotels: ResolvedHotel[] = [];
  for (const hint of brief.hotel_slugs_target) {
    const resolved = resolveHotelSlugHint(hint);
    const entry = hotelMap[resolved] ?? hotelMap[hint];
    if (entry !== undefined) {
      hotels.push({ id: entry.id, slug: entry.slug, name: entry.name });
    }
  }

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

  const out = parseFlag(args, 'out');
  const serialised = JSON.stringify(composed, null, 2);
  if (out !== null) {
    writeFileSync(out, serialised, 'utf8');
    console.error(`✓ wrote ${out}`);
  } else {
    console.log(serialised);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
