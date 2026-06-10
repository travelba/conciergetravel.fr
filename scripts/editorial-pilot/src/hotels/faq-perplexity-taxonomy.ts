/**
 * Perplexity hotel FAQ research — category taxonomy, volume bands, Zod
 * contracts. Shared by validate/sync/push scripts and CDC kit gates.
 *
 * Skill: hotel-faq-perplexity-enrichment
 */

import { z } from 'zod';

/** Factual FAQ kit — Perplexity research target band. */
export const FAQ_KIT_MIN_ITEMS = 40;
export const FAQ_KIT_MAX_ITEMS = 80;

/** Concierge-voice Q&A — separate from factual FAQ. */
export const CONCIERGE_QUESTIONS_MIN = 20;
export const CONCIERGE_QUESTIONS_MAX = 30;

/** CDC §2.11 promote subset stored in `faq_content` (JSON-LD + gates). */
export const FAQ_PROMOTE_MIN_ITEMS = 10;
export const FAQ_PROMOTE_MAX_ITEMS = 15;

/** Minimum questions per factual category in a complete kit. */
export const FAQ_KIT_MIN_PER_CATEGORY = 2;

export const FAQ_FACTUAL_CATEGORIES_FR = [
  'Arrivée & Départ',
  'Localisation & Accès',
  'Chambres & Équipements',
  'Services inclus',
  'Restauration',
  'Spa & Bien-être',
  'Activités & Loisirs',
  'Famille & Enfants',
  'Animaux',
  'Accessibilité',
  'Facturation & Politiques',
  'Durabilité',
] as const;

export type FaqFactualCategoryFr = (typeof FAQ_FACTUAL_CATEGORIES_FR)[number];

export const CONCIERGE_QUESTION_CATEGORIES_FR = [
  'Transferts & Transport',
  'Réservations de restaurants',
  'Réservations spa',
  'Excursions & Visites culturelles',
  'Occasions spéciales',
  'Shopping & Services de luxe',
  'Activités familiales',
  'Expériences personnalisées',
] as const;

export type ConciergeQuestionCategoryFr = (typeof CONCIERGE_QUESTION_CATEGORIES_FR)[number];

/** Maps Perplexity factual category → CDC intent bucket. */
export const FAQ_CATEGORY_TO_BUCKET: Readonly<
  Record<FaqFactualCategoryFr, 'before' | 'during' | 'after' | 'agency'>
> = {
  'Arrivée & Départ': 'before',
  'Localisation & Accès': 'before',
  'Chambres & Équipements': 'during',
  'Services inclus': 'during',
  Restauration: 'during',
  'Spa & Bien-être': 'during',
  'Activités & Loisirs': 'during',
  'Famille & Enfants': 'during',
  Animaux: 'during',
  Accessibilité: 'during',
  'Facturation & Politiques': 'agency',
  Durabilité: 'agency',
};

export const FAQ_CATEGORY_EN: Readonly<Record<FaqFactualCategoryFr, string>> = {
  'Arrivée & Départ': 'Arrival & Departure',
  'Localisation & Accès': 'Location & Access',
  'Chambres & Équipements': 'Rooms & Amenities',
  'Services inclus': 'Included Services',
  Restauration: 'Dining',
  'Spa & Bien-être': 'Spa & Wellness',
  'Activités & Loisirs': 'Activities & Leisure',
  'Famille & Enfants': 'Family & Kids',
  Animaux: 'Pets',
  Accessibilité: 'Accessibility',
  'Facturation & Politiques': 'Billing & Policies',
  Durabilité: 'Sustainability',
};

export const CONCIERGE_CATEGORY_EN: Readonly<Record<ConciergeQuestionCategoryFr, string>> = {
  'Transferts & Transport': 'Transfers & Transport',
  'Réservations de restaurants': 'Restaurant Reservations',
  'Réservations spa': 'Spa Bookings',
  'Excursions & Visites culturelles': 'Excursions & Cultural Visits',
  'Occasions spéciales': 'Special Occasions',
  'Shopping & Services de luxe': 'Shopping & Luxury Services',
  'Activités familiales': 'Family Activities',
  'Expériences personnalisées': 'Personalized Experiences',
};

const FaqFactualCategorySchema = z.enum(FAQ_FACTUAL_CATEGORIES_FR);
const ConciergeCategorySchema = z.enum(CONCIERGE_QUESTION_CATEGORIES_FR);

/** Raw Perplexity JSON — one research file per hotel. */
export const PerplexityFaqItemRawSchema = z.object({
  category: FaqFactualCategorySchema,
  question: z.string().min(8).max(260),
  answer: z.string().min(20).max(1400),
});

export const PerplexityConciergeItemRawSchema = z.object({
  category: ConciergeCategorySchema,
  question: z.string().min(8).max(260),
  concierge_reply: z.string().min(20).max(1400),
});

export const PerplexityHotelFaqResearchSchema = z.object({
  faq: z.array(PerplexityFaqItemRawSchema).min(FAQ_KIT_MIN_ITEMS).max(FAQ_KIT_MAX_ITEMS),
  concierge_questions: z
    .array(PerplexityConciergeItemRawSchema)
    .min(CONCIERGE_QUESTIONS_MIN)
    .max(CONCIERGE_QUESTIONS_MAX),
});

export type PerplexityHotelFaqResearch = z.infer<typeof PerplexityHotelFaqResearchSchema>;

/** Normalised row shape for `hotels.faq_content_kit` / promote `faq_content`. */
export interface NormalisedFaqKitItem {
  readonly category: 'before' | 'during' | 'after' | 'agency';
  readonly group_fr: string;
  readonly group_en: string;
  readonly question_fr: string;
  readonly answer_fr: string;
  readonly question_en?: string;
  readonly answer_en?: string;
  readonly featured?: boolean;
}

export interface NormalisedConciergeQuestion {
  readonly category_fr: string;
  readonly category_en: string;
  readonly question_fr: string;
  readonly reply_fr: string;
  readonly question_en?: string;
  readonly reply_en?: string;
}

export interface NormalisedHotelFaqKit {
  readonly kit: readonly NormalisedFaqKitItem[];
  readonly promote: readonly NormalisedFaqKitItem[];
  readonly conciergeQuestions: readonly NormalisedConciergeQuestion[];
}

export function isFaqFactualCategory(value: string): value is FaqFactualCategoryFr {
  return (FAQ_FACTUAL_CATEGORIES_FR as readonly string[]).includes(value);
}

export function isConciergeQuestionCategory(value: string): value is ConciergeQuestionCategoryFr {
  return (CONCIERGE_QUESTION_CATEGORIES_FR as readonly string[]).includes(value);
}
