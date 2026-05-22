/**
 * Offline equivalent of `push-itinerary.ts#resolveHotelsForBrief`.
 *
 * `push-itinerary.ts` queries Postgres directly to map brief slugs to
 * `public.hotels` UUIDs. That works for the dev who pushes to DB, but
 * the LLM batch (`run-all-briefs.ts`) runs without a Postgres URL in
 * `.env.local` — its only contract is producing SQL artifacts.
 *
 * To still link real `hotel_id`s into the LLM-generated SQL, this
 * helper resolves a brief's hotel slugs against the static snapshot
 * in `hotel-map.generated.ts`.
 *
 * Behaviour :
 *   - Brief slugs are deduplicated by their *resolved* form (after
 *     `resolveHotelSlugHint`). Two brief aliases pointing at the same
 *     DB slug yield ONE `ResolvedHotel`.
 *   - Slugs absent from the snapshot are logged to stderr but do not
 *     throw — the brief stays usable, the missing hotel simply ends up
 *     with `hotel_id: null` in that step.
 */
import { resolveHotelSlugHint } from './country-codes.js';
import { HOTEL_SLUG_TO_ENTRY } from './hotel-map.generated.js';
import type { ItineraryBrief, ResolvedHotel } from './types.js';

export function resolveHotelsFromSnapshot(brief: ItineraryBrief): readonly ResolvedHotel[] {
  const slugHints = new Set<string>();
  for (const hint of brief.hotel_slugs_target) slugHints.add(hint);
  for (const step of brief.steps_outline) {
    if (step.hotel_slug_hint !== undefined) slugHints.add(step.hotel_slug_hint);
  }

  const resolvedSlugs = new Set<string>();
  const out: ResolvedHotel[] = [];
  const missing: string[] = [];

  for (const hint of slugHints) {
    const dbSlug = resolveHotelSlugHint(hint);
    if (resolvedSlugs.has(dbSlug)) continue;
    const entry = HOTEL_SLUG_TO_ENTRY[dbSlug];
    if (entry === undefined) {
      missing.push(hint === dbSlug ? hint : `${hint} → ${dbSlug}`);
      continue;
    }
    resolvedSlugs.add(dbSlug);
    out.push({ id: entry.id, slug: dbSlug, name: entry.name });
  }

  if (missing.length > 0) {
    process.stderr.write(`      ⚠ hotel snapshot miss (${brief.slug_fr}): ${missing.join(', ')}\n`);
  }
  return out;
}
