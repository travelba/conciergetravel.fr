import { z } from 'zod';

import { HotelCardV2Schema } from './hotel-card-v2';
import { formatZodIssues, v2ReadErr, v2ReadOk, type V2ReadResult } from './read-result';

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const HotelDetailV2Schema = HotelCardV2Schema.extend({
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
  factual_summary_fr: z.string().nullable(),
  factual_summary_en: z.string().nullable(),
  faq_content: JsonValueSchema.nullable(),
  policies: JsonValueSchema.nullable(),
  gallery_images: JsonValueSchema.nullable(),
  concierge_advice: JsonValueSchema.nullable(),
  long_description_sections: JsonValueSchema.nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  affiliations: JsonValueSchema.nullable(),
  region: z.string().nullable(),
  district: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  booking_mode: z.enum(['amadeus', 'little', 'email', 'display_only']),
  updated_at: z.string().datetime({ offset: true }),
});

export type HotelDetailV2 = z.infer<typeof HotelDetailV2Schema>;

export const parseHotelDetailV2 = (raw: unknown): V2ReadResult<HotelDetailV2> => {
  const parsed = HotelDetailV2Schema.safeParse(raw);
  if (!parsed.success) {
    return v2ReadErr({
      kind: 'parse_error',
      issues: formatZodIssues(parsed.error.issues),
    });
  }
  return v2ReadOk(parsed.data);
};
