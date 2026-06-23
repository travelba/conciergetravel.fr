import { z } from 'zod';

/**
 * Zod schemas for DataForSEO v3. The vendor responses are very large; we
 * model only the subset the editorial grounding consumes and keep every
 * object `.passthrough()` so unmodelled fields never fail a parse (the
 * vendor adds fields without versioning). Inputs are validated at the
 * boundary; outputs are normalised into the small shapes in this file.
 */

// ---------------------------------------------------------------------------
// Generic v3 task envelope
// ---------------------------------------------------------------------------

/** A single task inside the `tasks[]` envelope. */
export const DfsTaskSchema = z
  .object({
    id: z.string(),
    status_code: z.number(),
    status_message: z.string(),
    result: z.array(z.unknown()).nullish(),
  })
  .passthrough();

/** The top-level DataForSEO response envelope (all endpoints share it). */
export const DfsEnvelopeSchema = z
  .object({
    status_code: z.number(),
    status_message: z.string(),
    cost: z.number().nullish(),
    tasks: z.array(DfsTaskSchema).nullish(),
  })
  .passthrough();

export type DfsEnvelope = z.infer<typeof DfsEnvelopeSchema>;

/** DataForSEO success sentinel (both envelope-level and task-level). */
export const DFS_STATUS_OK = 20000 as const;

// ---------------------------------------------------------------------------
// Shared inputs
// ---------------------------------------------------------------------------

export const DfsLocaleInputSchema = z.object({
  /** Country-only location name, e.g. "France", "United States". */
  locationName: z.string().min(2),
  /** Language code, e.g. "fr", "en". */
  languageCode: z.string().min(2).max(5),
});
export type DfsLocaleInput = z.infer<typeof DfsLocaleInputSchema>;

// ---------------------------------------------------------------------------
// Keyword metric (related_keywords / keyword_suggestions / google_ads volume)
// ---------------------------------------------------------------------------

const KeywordInfoSchema = z
  .object({
    search_volume: z.number().nullish(),
    cpc: z.number().nullish(),
    competition: z.number().nullish(),
    competition_level: z.string().nullish(),
  })
  .passthrough();

const KeywordDataSchema = z
  .object({
    keyword: z.string().nullish(),
    keyword_info: KeywordInfoSchema.nullish(),
  })
  .passthrough();

/** A DataForSEO-Labs item wraps the metrics under `keyword_data`. */
export const LabsItemSchema = z
  .object({
    keyword_data: KeywordDataSchema.nullish(),
    keyword: z.string().nullish(),
  })
  .passthrough();

/**
 * DataForSEO-Labs `result[0]` holds the `items[]` collection. `items` is
 * typed as raw `unknown[]` and validated per-element by the normaliser, so
 * a single malformed item never voids the whole batch (vendor-drift safe).
 */
export const LabsResultSchema = z
  .object({
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

/** Google Ads `search_volume` returns the metrics directly in `result[]`. */
export const AdsVolumeItemSchema = z
  .object({
    keyword: z.string(),
    search_volume: z.number().nullish(),
    cpc: z.number().nullish(),
    competition: z.union([z.number(), z.string()]).nullish(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Search intent
// ---------------------------------------------------------------------------

const KeywordIntentSchema = z
  .object({
    label: z.string().nullish(),
    probability: z.number().nullish(),
  })
  .passthrough();

export const IntentItemSchema = z
  .object({
    keyword: z.string(),
    keyword_intent: KeywordIntentSchema.nullish(),
  })
  .passthrough();

export const IntentResultSchema = z
  .object({
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// SERP organic advanced — People Also Ask + related searches
// ---------------------------------------------------------------------------

/** A generic SERP element; only `type` is reliably present. */
export const SerpElementSchema = z
  .object({
    type: z.string(),
    // people_also_ask wraps `items: [{ type, title, ... }]`
    // related_searches uses `items: [string]`
    items: z.array(z.unknown()).nullish(),
    title: z.string().nullish(),
  })
  .passthrough();

export const SerpResultSchema = z
  .object({
    keyword: z.string().nullish(),
    items: z.array(z.unknown()).nullish(),
  })
  .passthrough();

const PaaElementSchema = z
  .object({
    type: z.string().nullish(),
    title: z.string().nullish(),
  })
  .passthrough();

export { PaaElementSchema };

// ---------------------------------------------------------------------------
// Normalised output shapes (what the grounding layer consumes)
// ---------------------------------------------------------------------------

export interface KeywordMetric {
  readonly keyword: string;
  readonly searchVolume: number | null;
  readonly cpc: number | null;
  /** 0..1 competition index when numeric; null otherwise. */
  readonly competition: number | null;
}

export interface KeywordIntent {
  readonly keyword: string;
  readonly intent: string | null;
  readonly probability: number | null;
}
