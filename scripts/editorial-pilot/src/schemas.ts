import { z } from 'zod';

const ConfidenceSchema = z.enum(['high', 'medium-high', 'medium', 'medium-low', 'low']);

const SourceSchema = z.object({
  type: z.string(),
  url: z.string().url().optional(),
  qid: z.string().optional(),
  citation: z.string().optional(),
  consulted_at: z.string().optional(),
});

const KeyDateSchema = z.object({
  year: z.number().int(),
  event: z.string(),
  confidence: ConfidenceSchema.optional(),
});

const CulturalRefSchema = z.object({
  type: z.string(),
  item: z.string(),
  confidence: ConfidenceSchema.optional(),
});

const DiningSchema = z.object({
  name: z.string(),
  type: z.string(),
  chef: z.string().optional(),
  current_chef: z.string().optional(),
  michelin_stars: z.number().int().min(0).max(3).optional(),
  michelin_history_note: z.string().optional(),
  since_stars: z.union([z.number().int(), z.string()]).optional(),
  style: z.string().optional(),
  cuisine: z.string().optional(),
  designer: z.string().optional(),
  signature: z.string().optional(),
  feature: z.string().optional(),
  verified_confidence: ConfidenceSchema.optional(),
  source: z.string().optional(),
  note_to_check: z.string().optional(),
});

const PoiSchema = z.object({
  name: z.string(),
  distance_m: z.number().int().min(0),
  type: z.string(),
  note: z.string().optional(),
  confidence: ConfidenceSchema.optional(),
});

const ExternalSourceFactSchema = z.object({
  source: z.string(),
  url: z.string().url().optional(),
  verbatim: z.string().min(20),
  confidence: z.enum(['high', 'medium-high', 'medium', 'medium-low', 'low']).optional(),
});

/**
 * « Le Conseil du Concierge » — bloc 60-90 mots qui se rend en bas de
 * fiche hôtel. Voix Concierge (expert complice), contient un secret
 * opérationnel concret (chambre, timing, accès, table, service, spa).
 * Voir `docs/adr/0011-concierge-voice.md` et `EDITORIAL_VOICE.md` §4
 * bloc 8.
 *
 * Côté brief on tolère un texte source plus libre — la passe 8
 * (humanizer Concierge) le reformate au format exact 60-90 mots avant
 * upsert.
 */
const ConciergeTipForSchema = z.enum(['room', 'dining', 'timing', 'access', 'service', 'wellness']);

export const ConciergeAdviceLocaleSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(40),
  tip_for: ConciergeTipForSchema,
});

export const ConciergeAdviceBriefSchema = z.object({
  fr: ConciergeAdviceLocaleSchema,
  en: ConciergeAdviceLocaleSchema.optional(),
});

export type ConciergeAdviceBrief = z.infer<typeof ConciergeAdviceBriefSchema>;

/**
 * Pass 8 humanizer output — contract enforced post-LLM, with sentence
 * length checked separately by `linterPhraseLength` (see linter.ts).
 */
export const ConciergePass8OutputSchema = z.object({
  lead_concierge: z
    .string()
    .min(400, { message: 'lead_concierge too short (must reach ≈ 180-220 words)' })
    .max(2000, { message: 'lead_concierge too long (must stay ≈ 180-220 words)' }),
  concierge_advice: ConciergeAdviceBriefSchema.required({ fr: true, en: true }),
});

export type ConciergePass8Output = z.infer<typeof ConciergePass8OutputSchema>;

export const BriefSchema = z.object({
  slug: z.string().min(3),
  name: z.string().min(3),
  operator: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  country: z.string().length(2),
  address: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
    verified_confidence: ConfidenceSchema.optional(),
    source: z.string().optional(),
  }),
  classification: z.object({
    stars: z.number().int().min(1).max(5),
    atout_france_palace: z.boolean(),
    atout_france_palace_first_distinction_year: z.number().int().nullable().optional(),
    verified_confidence: ConfidenceSchema.optional(),
    source: z.string().optional(),
  }),
  history: z.object({
    opening_year: z.number().int().optional(),
    founder_or_first_operator: z.string().optional(),
    eden_roc_pavilion_year: z.number().int().optional(),
    verified_confidence: ConfidenceSchema.optional(),
    key_dates: z.array(KeyDateSchema).min(1),
    cultural_references: z.array(CulturalRefSchema).min(1),
  }),
  architecture: z.record(z.unknown()),
  capacity: z.record(z.unknown()),
  dining: z.array(DiningSchema).min(1),
  wellness: z.record(z.unknown()).optional(),
  service: z.record(z.unknown()),
  signature_features: z.array(z.string()).min(1),
  nearby_pois: z.array(PoiSchema).min(1),
  /**
   * Legacy "IATA insider" payload (kept for backward compatibility on
   * existing briefs). New briefs target `concierge_advice` below — see
   * `docs/adr/0011-concierge-voice.md`. Both fields can coexist on a
   * single brief during the migration window; pipelines should prefer
   * `concierge_advice` when present.
   */
  iata_insider: z
    .object({
      advisor_name: z.string(),
      advisor_role: z.string(),
      key_observation: z.string(),
      best_for: z.string(),
      honest_caveat: z.string(),
      alternative_recommendation: z.string().optional(),
    })
    .optional(),
  /**
   * « Le Conseil du Concierge » — bloc canonique exposé en bas de
   * fiche hôtel (cf. ADR-0011 et EDITORIAL_VOICE.md §4 bloc 8).
   * Le `body` est contraint 60-90 mots en aval (Payload + DB Zod
   * reader). Côté brief, on accepte un texte plus libre que le LLM
   * passe 8 (humanizer Concierge) reformatera ensuite.
   */
  concierge_advice: ConciergeAdviceBriefSchema.optional(),
  pricing_indication: z.record(z.unknown()).optional(),
  operational: z.record(z.unknown()).optional(),
  sources: z.array(SourceSchema).min(2),
  external_source_facts: z.array(ExternalSourceFactSchema).optional(),
  verification_required_before_publication: z.array(z.string()).min(1),
});

export type Brief = z.infer<typeof BriefSchema>;

export const FactCheckReportSchema = z.object({
  hotel_slug: z.string(),
  summary: z.object({
    facts_ok: z.number().int().min(0),
    warn_medium: z.number().int().min(0),
    warn_low: z.number().int().min(0),
    hallucinations: z.number().int().min(0),
    tbd_leftover: z.number().int().min(0),
    divergent_numbers: z.number().int().min(0),
    cultural_to_verify: z.number().int().min(0),
  }),
  findings: z.array(
    z.object({
      category: z.string(),
      severity: z.enum(['blocker', 'high', 'medium', 'low']),
      quote_from_text: z.string(),
      issue: z.string(),
      brief_reference: z.string(),
      recommended_action: z.string(),
    }),
  ),
  external_sources_required: z
    .array(
      z.object({
        fact: z.string(),
        suggested_source: z.string(),
        before_publication: z.boolean(),
      }),
    )
    .optional(),
  final_recommendation: z.enum(['READY_TO_PUBLISH', 'NEEDS_PASS_2BIS', 'MANUAL_REVIEW_REQUIRED']),
  blockers_for_publication: z.array(z.string()),
});

export type FactCheckReport = z.infer<typeof FactCheckReportSchema>;
