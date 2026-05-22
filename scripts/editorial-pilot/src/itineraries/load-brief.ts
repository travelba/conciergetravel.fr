import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ItineraryBriefSchema, type ItineraryBrief } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIEFS_DIR = path.resolve(__dirname, '../../itineraries/briefs');

export async function loadItineraryBrief(slug: string): Promise<ItineraryBrief> {
  const filePath = path.join(BRIEFS_DIR, `${slug}.json`);
  const raw = await readFile(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  return ItineraryBriefSchema.parse(parsed);
}

export function listBriefSlugs(): string[] {
  // Sync listing via glob at runtime in run-itinerary; keep loader focused.
  return [];
}
