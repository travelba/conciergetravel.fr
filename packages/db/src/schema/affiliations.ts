import { z } from 'zod';

/**
 * Hotel affiliation contract — `public.hotels.affiliations jsonb` (migration 0062).
 *
 * An affiliation is a hotel's link to a third-party entity that confers
 * positioning, distinction, or operational identity. Four kinds exist:
 *
 * - `brand` — Operational chain (mono-affiliation by definition). The hotel
 *   is owned, operated, or branded under this name. Examples: Four Seasons,
 *   Aman, Grecotel, Oetker Collection, Dorchester Collection. A hotel has
 *   **at most one** `brand` affiliation. The luxury_tier column mirrors
 *   the brand slug when present (e.g. `four_seasons` / `oetker_collection`).
 *
 * - `label` — Stackable certification or consortium membership. The hotel
 *   keeps its own identity and joins the network. Examples: Relais &
 *   Châteaux, Atout France Palaces, Forbes Travel Guide 5-Star, Leading
 *   Hotels of the World, Small Luxury Hotels, Michelin Keys. A hotel may
 *   carry **several** `label` affiliations simultaneously.
 *
 * - `ranking` — Annual editorial classement. Examples: Travel + Leisure
 *   World's Best, Condé Nast Gold List, World's 50 Best Hotels. Usually
 *   carries a `since_year` and is renewable.
 *
 * - `guide` — Reference in a curatorial guide. Examples: Tablet Hotels,
 *   Mr & Mrs Smith. Lower distinction signal than `label` or `ranking`.
 *
 * The migration 0062 backfills this column from the misused
 * `external_sources` entries that had been stored as scaffold traces.
 * Going forward `external_sources` reverts to its original 0038 semantics
 * (provenance of facts: `{field, value, source, confidence, collected_at}`).
 *
 * Skill: content-modeling, supabase-postgres-rls.
 * ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.
 */

/** Discriminator for the kind of third-party affiliation. */
export const HotelAffiliationKindSchema = z.enum(['brand', 'label', 'ranking', 'guide']);

export type HotelAffiliationKind = z.infer<typeof HotelAffiliationKindSchema>;

/**
 * Canonical Zod schema for a single entry in `hotels.affiliations[]`.
 *
 * The slug fields enforce two distinct conventions:
 *   - `source` is snake_case (matches the `luxury_tier` enum values where
 *     applicable, e.g. `relais_chateaux`, `four_seasons`, `palace_atout_france`).
 *   - `facet_slug` is kebab-case (used for `/marque/<slug>` and
 *     `/label/<slug>` URLs), e.g. `relais-chateaux`, `four-seasons`.
 */
export const HotelAffiliationSchema = z.object({
  kind: HotelAffiliationKindSchema,

  /**
   * Canonical snake_case slug. Matches the corresponding `luxury_tier`
   * enum value when the source has a tier entry. Examples:
   * `relais_chateaux`, `palace_atout_france`, `forbes_5_star`,
   * `michelin_3_keys`, `lhw_member`, `small_luxury_hotels`,
   * `world_50_best`, `tl_worlds_best`, `cn_gold_list`, `oetker_collection`,
   * `grecotel`, `four_seasons`, `aman`.
   */
  source: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/u, 'source must be snake_case (a-z0-9_)'),

  /**
   * Human-readable display name (UI + JSON-LD `award.name`). Example:
   * "Relais & Châteaux", "Atout France Palaces 2026", "Forbes Travel
   * Guide Five-Star 2025".
   */
  display_name: z.string().min(1).max(160),

  /**
   * `true` when the affiliation has been confirmed against the source's
   * own published list (e.g. atout-france.fr/palaces) and not just
   * scraped from a vendor aggregator. JSON-LD emits the affiliation in
   * `Hotel.award[]` **only** when `verified: true`.
   */
  verified: z.boolean().default(false),

  /** Year of first joining / latest renewal. Used in display ("R&C depuis 2018"). */
  since_year: z.number().int().min(1850).max(2100).optional(),

  /** Direct URL to the affiliation's own page on the source's site. */
  source_url: z.string().url().optional(),

  /**
   * Kebab-case slug used for `/marque/<facet_slug>` (kind=brand) or
   * `/label/<facet_slug>` (kind=label) URLs. When omitted, the renderer
   * derives one from `source` by replacing `_` with `-`.
   */
  facet_slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/u, 'facet_slug must be kebab-case (a-z0-9-)')
    .optional(),

  /** ISO-8601 timestamp of the last scrape / verification. */
  scraped_at: z.string().datetime().optional(),

  /** Source-specific opaque payload (preserved for re-ingestion). */
  metadata: z.record(z.unknown()).optional(),
});

export type HotelAffiliation = z.infer<typeof HotelAffiliationSchema>;

/** Whole-column schema — used by the Payload validator and DB readers. */
export const HotelAffiliationsArraySchema = z.array(HotelAffiliationSchema);

export type HotelAffiliationsArray = z.infer<typeof HotelAffiliationsArraySchema>;

/**
 * Defensive parser that swallows individual malformed entries instead of
 * rejecting the whole array. Returns only the entries that pass Zod
 * validation. Used by the JSON-LD builder and `/marque/[brandSlug]` page
 * so a single bad row does not crash the hotel detail render.
 */
export function parseAffiliationsLenient(raw: unknown): HotelAffiliation[] {
  if (!Array.isArray(raw)) return [];
  const out: HotelAffiliation[] = [];
  for (const entry of raw) {
    const parsed = HotelAffiliationSchema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Convenience selector — returns only entries of a given kind, ordered by
 * `since_year` descending (most recent renewal first), then by display
 * name for stability.
 */
export function selectAffiliationsByKind(
  affiliations: readonly HotelAffiliation[],
  kind: HotelAffiliationKind,
): HotelAffiliation[] {
  return affiliations
    .filter((a) => a.kind === kind)
    .slice()
    .sort((a, b) => {
      const aYear = a.since_year ?? 0;
      const bYear = b.since_year ?? 0;
      if (aYear !== bYear) return bYear - aYear;
      return a.display_name.localeCompare(b.display_name, 'fr');
    });
}
