import { z } from 'zod';

import { formatZodIssues, v2ReadErr, v2ReadOk, type V2ReadResult } from './read-result';

const HotelSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case');

const CountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'country_code must be ISO 3166-1 alpha-2 uppercase');

/** Boolean amenity flags projected by v2.build_amenities_facet (ADR-0033). */
export const AmenitiesFacetSchema = z
  .object({
    has_spa: z.boolean().optional(),
    has_pool: z.boolean().optional(),
    has_restaurant: z.boolean().optional(),
    has_parking: z.boolean().optional(),
    wifi: z.boolean().optional(),
    pets_allowed: z.boolean().optional(),
    has_gym: z.boolean().optional(),
    has_kids_club: z.boolean().optional(),
    is_all_inclusive: z.boolean().optional(),
  })
  .strict();

export type AmenitiesFacet = z.infer<typeof AmenitiesFacetSchema>;

export const HotelCardV2Schema = z.object({
  id: z.string().uuid(),
  slug: HotelSlugSchema,
  slug_en: HotelSlugSchema.nullable(),
  name: z.string().min(1),
  name_en: z.string().min(1).nullable(),
  city: z.string().min(1),
  country_code: CountryCodeSchema,
  stars: z.number().int().min(1).max(5),
  hero_image: z.string().min(1).nullable(),
  rating_score: z.number().min(0).max(10).nullable(),
  rating_count: z.number().int().min(0).nullable(),
  luxury_tier: z.string().min(1).nullable(),
  price_hint: z.number().int().min(0).nullable(),
  amenities_facet: AmenitiesFacetSchema,
});

export type HotelCardV2 = z.infer<typeof HotelCardV2Schema>;

export const parseHotelCardV2 = (raw: unknown): V2ReadResult<HotelCardV2> => {
  const parsed = HotelCardV2Schema.safeParse(raw);
  if (!parsed.success) {
    return v2ReadErr({
      kind: 'parse_error',
      issues: formatZodIssues(parsed.error.issues),
    });
  }
  return v2ReadOk(parsed.data);
};
