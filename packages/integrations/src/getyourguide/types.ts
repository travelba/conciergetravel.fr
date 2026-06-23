import { z } from 'zod';

/**
 * GetYourGuide Partner API (reseller model) — request + response Zod
 * schemas (skill: api-integration). The Partner API uses opaque string
 * tour ids and a loosely-typed JSON envelope, so every response schema
 * is permissive (`.passthrough()`) and the parser drops entries that
 * miss the few fields we actually render.
 *
 * We model only the subset we need for the "lieux à visiter" fiches:
 * search-by-coordinates + tour details. Booking (Palier B) is out of
 * scope until Phase 6 — Palier A monetises via affiliate deeplinks.
 */
export const GygSearchInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Search radius in kilometres (default 2). */
  radiusKm: z.number().positive().max(50).optional(),
  /** Max products to return (default 6). */
  limit: z.number().int().min(1).max(50).optional(),
  /** BCP-47 locale (default 'fr'). */
  locale: z.string().min(2).max(10).optional(),
});

export type GygSearchInput = z.infer<typeof GygSearchInputSchema>;

/**
 * Permissive raw tour shape. The Partner API nests price + reviews in
 * varying envelopes across versions, so we accept several shapes and
 * normalise in the parser.
 */
export const GygRawTourSchema = z
  .object({
    tour_id: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().optional(),
    abstract: z.string().optional(),
    url: z.string().optional(),
    price: z
      .object({
        values: z.object({ amount: z.union([z.string(), z.number()]).optional() }).optional(),
        amount: z.union([z.string(), z.number()]).optional(),
        currency: z.string().optional(),
      })
      .passthrough()
      .optional(),
    currency: z.string().optional(),
    reviews: z
      .object({
        rating: z.union([z.string(), z.number()]).optional(),
        rating_count: z.union([z.string(), z.number()]).optional(),
        number_of_ratings: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough()
      .optional(),
    photos: z.array(z.object({ url: z.string().optional() }).passthrough()).optional(),
    pictures: z.array(z.object({ url: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough();

export type GygRawTour = z.infer<typeof GygRawTourSchema>;

/**
 * The Partner API wraps results under `data.tours[]` (v1) — but some
 * endpoints return a bare array. We accept both.
 */
export const GygSearchResponseSchema = z.union([
  z.object({ data: z.object({ tours: z.array(GygRawTourSchema) }).passthrough() }).passthrough(),
  z.object({ tours: z.array(GygRawTourSchema) }).passthrough(),
  z.array(GygRawTourSchema),
]);

export type GygSearchResponse = z.infer<typeof GygSearchResponseSchema>;

/**
 * Normalised tour, ready to upsert into `place_gyg_products`.
 * `priceFromMinor` is in minor units (cents). `deeplinkUrl` is filled
 * by the client (it depends on the partner_id, not on the API payload).
 */
export interface ParsedGygTour {
  readonly tourId: string;
  readonly title: string;
  readonly abstract: string | null;
  readonly priceFromMinor: number | null;
  readonly currency: string | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly imageUrl: string | null;
  readonly deeplinkUrl: string;
}
