import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Minimal, tolerant view of a `hotels.affiliations[]` entry (migration 0062 —
 * see `packages/db/src/schema/affiliations.ts` for the canonical contract and
 * ADR-0023). We only need the two slug fields for ranking eligibility:
 *   - `source`     : snake_case, mirrors `luxury_tier` values (e.g.
 *                    `relais_chateaux`, `four_seasons`, `world_50_best`).
 *   - `facet_slug` : kebab-case, the `/label/<slug>` / `/marque/<slug>` URL key.
 * `.passthrough()` keeps the rest of the payload intact; both slugs are
 * optional so a partially-formed entry never rejects the whole snapshot.
 */
const AffiliationSnapshotSchema = z
  .object({
    kind: z.string().optional(),
    source: z.string().optional(),
    facet_slug: z.string().optional(),
    display_name: z.string().optional(),
    verified: z.boolean().optional(),
  })
  .passthrough();

export type AffiliationSnapshot = z.infer<typeof AffiliationSnapshotSchema>;

const HotelRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  slug_en: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  stars: z.number().int(),
  is_palace: z.boolean(),
  city: z.string(),
  region: z.string().nullable(),
  country_code: z.string().nullable(),
  // C1 (2026-06-25): `luxury_tier` + `affiliations` enable precise eligibility
  // (brand / label / ranking filters) instead of name heuristics. Both are
  // `.optional()` so a stale snapshot generated before this field landed still
  // parses (treated as null / empty downstream). Regenerate the snapshot via
  // `src/guides/export-hotels-catalog-rest.ts` to populate them.
  luxury_tier: z.string().nullable().optional(),
  affiliations: z.array(AffiliationSnapshotSchema).nullable().optional(),
  description_fr: z.string().nullable(),
  address: z.string().nullable(),
  postal_code: z.string().nullable(),
  latitude: z.union([z.string(), z.number()]).nullable(),
  longitude: z.union([z.string(), z.number()]).nullable(),
});

export type HotelCatalogRow = z.infer<typeof HotelRowSchema>;

export async function loadHotelsCatalog(): Promise<readonly HotelCatalogRow[]> {
  const p = path.resolve(__dirname, '../../out/hotels-catalog.json');
  const raw = await fs.readFile(p, 'utf8');
  const parsed = z.array(HotelRowSchema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `[load-hotels-catalog] invalid JSON: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  return parsed.data;
}
