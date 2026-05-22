import { z } from 'zod';

export const ItineraryBriefStepSchema = z.object({
  step: z.number().int().positive(),
  duration_days: z.number().int().positive(),
  city: z.string().min(1),
  hotel_slug_hint: z.string().min(1).optional(),
  key_pois: z.array(z.string()).default([]),
  step_angle: z.string().min(1),
  title_fr_hint: z.string().min(1),
  title_en_hint: z.string().min(1),
});

export type ItineraryBriefStep = z.infer<typeof ItineraryBriefStepSchema>;

export const ItineraryBriefSchema = z.object({
  slug_fr: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  slug_en: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    .optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P0'),
  destination_country: z.string().min(1),
  destination_region: z.string().optional(),
  destination_city: z.string().optional(),
  themes: z.array(z.string()).default([]),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().optional(),
  travel_style: z.enum([
    'luxe',
    'famille',
    'couple',
    'solo',
    'aventure',
    'bien-etre',
    'gastronomie',
    'culture',
    'affaires',
  ]),
  season: z
    .enum(['printemps', 'ete', 'automne', 'hiver', 'toute-saison'])
    .optional()
    .default('toute-saison'),
  target_word_count: z.number().int().positive().optional(),
  meta_title_fr_hint: z.string().optional(),
  meta_desc_fr_hint: z.string().optional(),
  hotel_slugs_target: z.array(z.string()).default([]),
  related_guide_slugs_target: z.array(z.string()).default([]),
  related_ranking_slugs_target: z.array(z.string()).default([]),
  related_itinerary_slugs_target: z.array(z.string()).default([]),
  steps_outline: z.array(ItineraryBriefStepSchema).min(1),
  aeo_question_fr_hint: z.string().optional(),
  aeo_answer_fr_hint: z.string().optional(),
  faq_questions_to_cover: z.array(z.string()).default([]),
  concierge_secret_hint: z.string().optional(),
});

export type ItineraryBrief = z.infer<typeof ItineraryBriefSchema>;

export const GeneratedSectionSchema = z.object({
  step: z.number().int().positive(),
  title_fr: z.string(),
  title_en: z.string(),
  body_fr: z.string(),
  body_en: z.string(),
  hotel_id: z.string().uuid().nullable(),
  duration_days: z.number().int().positive(),
  city: z.string(),
  poi: z.array(z.string()).min(1),
});

export const GeneratedFaqSchema = z.object({
  q_fr: z.string(),
  a_fr: z.string(),
  q_en: z.string(),
  a_en: z.string(),
});

export const GeneratedItinerarySchema = z.object({
  slug_fr: z.string(),
  slug_en: z.string(),
  title_fr: z.string(),
  title_en: z.string(),
  meta_title_fr: z.string(),
  meta_title_en: z.string(),
  meta_desc_fr: z.string(),
  meta_desc_en: z.string(),
  intro_fr: z.string(),
  intro_en: z.string(),
  aeo_question_fr: z.string(),
  aeo_answer_fr: z.string(),
  aeo_question_en: z.string(),
  aeo_answer_en: z.string(),
  country_code: z.string().regex(/^[A-Z]{2}$/u),
  destination_region: z.string().nullable(),
  destination_city: z.string().nullable(),
  themes: z.array(z.string()),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  travel_style: ItineraryBriefSchema.shape.travel_style,
  season: z.enum(['printemps', 'ete', 'automne', 'hiver', 'toute-saison']),
  hotel_ids: z.array(z.string().uuid()),
  sections: z.array(GeneratedSectionSchema).min(1),
  faq_content: z.array(GeneratedFaqSchema).min(8),
  related_guide_slugs: z.array(z.string()),
  related_itinerary_slugs: z.array(z.string()),
  related_ranking_ids: z.array(z.string().uuid()),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  status: z.enum(['draft', 'published']),
});

export type GeneratedItinerary = z.infer<typeof GeneratedItinerarySchema>;

export interface ResolvedHotel {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}
