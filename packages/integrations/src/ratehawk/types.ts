/**
 * RateHawk / Emerging Travel Group (worldota) B2B v3 response shapes.
 *
 * We model only the fields we consume; everything else passes through. ETG
 * wraps every response in `{ status, error, data }`. Room identity across
 * search and static content is the `rg_ext` object — a flat map of integer
 * room descriptors. Matching ALL `rg_ext` fields links a live rate to its
 * static room group (images, amenities).
 *
 * Explicit interfaces + `z.ZodType<T>` annotations bound the inference depth
 * (same pattern as the Travelport `PropertyItem` schema — avoids TS7056).
 *
 * Docs: https://docs.emergingtravel.com/docs/integration-guide/
 */
import { z } from 'zod';

/** Flat integer room descriptor map (class, quality, bedding, capacity, ...). */
export const RgExtSchema = z.record(z.string(), z.number());
export type RgExt = z.infer<typeof RgExtSchema>;

export interface RateHawkPaymentType {
  readonly show_amount?: string | undefined;
  readonly show_currency_code?: string | undefined;
  readonly amount?: string | undefined;
  readonly currency_code?: string | undefined;
  readonly cancellation_penalties?:
    | {
        readonly free_cancellation_before?: string | null | undefined;
        readonly policies?:
          | ReadonlyArray<{ readonly start_at?: string | null | undefined }>
          | undefined;
      }
    | undefined;
}

export interface RateHawkHpRate {
  readonly book_hash: string;
  readonly room_name?: string | undefined;
  readonly meal?: string | undefined;
  readonly rg_ext?: RgExt | undefined;
  readonly payment_options?:
    | { readonly payment_types?: readonly RateHawkPaymentType[] | undefined }
    | undefined;
}

export interface RateHawkHotelPageResponse {
  readonly status?: string | undefined;
  readonly error?: string | null | undefined;
  readonly data?:
    | {
        readonly hotels?:
          | ReadonlyArray<{
              readonly id?: string | undefined;
              readonly rates?: readonly RateHawkHpRate[] | undefined;
            }>
          | undefined;
      }
    | null
    | undefined;
}

export interface RateHawkRoomGroup {
  readonly name?: string | undefined;
  readonly rg_ext?: RgExt | undefined;
  readonly room_amenities?: readonly string[] | undefined;
  readonly images?: readonly string[] | undefined;
  readonly images_ext?: ReadonlyArray<{ readonly url?: string | undefined }> | undefined;
}

export interface RateHawkHotelContentResponse {
  readonly status?: string | undefined;
  readonly error?: string | null | undefined;
  readonly data?:
    | {
        readonly hotels?:
          | ReadonlyArray<{
              readonly id?: string | undefined;
              readonly room_groups?: readonly RateHawkRoomGroup[] | undefined;
            }>
          | undefined;
      }
    | null
    | undefined;
}

const PaymentTypeSchema = z
  .object({
    show_amount: z.string().optional(),
    show_currency_code: z.string().optional(),
    amount: z.string().optional(),
    currency_code: z.string().optional(),
    cancellation_penalties: z
      .object({
        free_cancellation_before: z.string().nullable().optional(),
        policies: z.array(z.object({ start_at: z.string().nullable().optional() })).optional(),
      })
      .optional(),
  })
  .passthrough();

const HpRateSchema = z
  .object({
    book_hash: z.string(),
    room_name: z.string().optional(),
    meal: z.string().optional(),
    rg_ext: RgExtSchema.optional(),
    payment_options: z.object({ payment_types: z.array(PaymentTypeSchema).optional() }).optional(),
  })
  .passthrough();

export const HotelPageResponseSchema: z.ZodType<RateHawkHotelPageResponse> = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    data: z
      .object({
        hotels: z
          .array(z.object({ id: z.string().optional(), rates: z.array(HpRateSchema).optional() }))
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const RoomGroupSchema = z
  .object({
    name: z.string().optional(),
    rg_ext: RgExtSchema.optional(),
    room_amenities: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    images_ext: z.array(z.object({ url: z.string().optional() })).optional(),
  })
  .passthrough();

export const HotelContentResponseSchema: z.ZodType<RateHawkHotelContentResponse> = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    data: z
      .object({
        hotels: z
          .array(
            z.object({
              id: z.string().optional(),
              room_groups: z.array(RoomGroupSchema).optional(),
            }),
          )
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

/** Stable string form of an `rg_ext` for deterministic equality / map keys. */
export function rgExtKey(rgExt: RgExt): string {
  const entries = Object.entries(rgExt).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join('|');
}
