#!/usr/bin/env tsx
/**
 * Convert a composed itinerary JSON (produced by dump-itinerary.ts) into
 * a single Postgres UPSERT statement. The conversion itself lives in
 * `to-sql.ts` so the batch runner can call it directly.
 *
 * Usage:
 *   tsx src/itineraries/make-sql.ts <composed.json> [--out=path.sql]
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { itineraryToSql } from './to-sql.js';
import { GeneratedItinerarySchema } from './types.js';

function main(): void {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  if (input === undefined) {
    console.error('Usage: make-sql.ts <composed.json> [--out=path.sql]');
    process.exit(1);
  }

  const raw: unknown = JSON.parse(readFileSync(input, 'utf8'));
  const data = GeneratedItinerarySchema.parse(raw);

  const sql = itineraryToSql(data);

  const outFlag = args.find((a) => a.startsWith('--out='));
  if (outFlag !== undefined) {
    const out = outFlag.slice('--out='.length);
    writeFileSync(out, sql, 'utf8');
    console.error(`✓ wrote ${out}`);
  } else {
    console.log(sql);
  }
}

main();
