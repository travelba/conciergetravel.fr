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

// ---------------------------------------------------------------------------
// WS5 phase 2 — Concierge humanizer for POIs (`hotels.points_of_interest`).
// One short, factual, voice-of-the-Concierge sentence per POI. The shape
// is intentionally tiny so the LLM can return a batch of ~10 in a single
// call without burning tokens on schema overhead.
//
// Hard rules enforced *after* parsing (style-guide §4-5):
//   - sentence length ≤ 25 words
//   - no banned phrases (`magnifique`, `incontournable`, `niché`, …)
// Both checks live in `linter.ts → lintConciergeText()` because they are
// already battle-tested on `concierge_advice`.
//
// `osm_id` is the matching key: the humanizer reads it back from the
// hotel row to rewrite the description in-place without touching the
// other POI fields (coords, walk distance, schema_type, …).
//
// `bucket_tip` is OPTIONAL: the LLM is asked to emit it on exactly one
// POI per bucket (the most representative). The persistence step keeps
// only the first non-empty tip per bucket (the reader already collapses
// duplicates), so the LLM does not need to be perfect about uniqueness.
// ---------------------------------------------------------------------------

const POI_DESC_MIN = 20;
const POI_DESC_MAX = 260;

export const ConciergePoiDescriptionSchema = z.object({
  osm_id: z.string().min(1).max(80),
  description_fr: z.string().min(POI_DESC_MIN).max(POI_DESC_MAX),
  bucket_tip_fr: z.string().min(POI_DESC_MIN).max(POI_DESC_MAX).optional(),
});
export type ConciergePoiDescription = z.infer<typeof ConciergePoiDescriptionSchema>;

export const ConciergePoiBatchSchema = z.object({
  pois: z.array(ConciergePoiDescriptionSchema).min(1).max(20),
});
export type ConciergePoiBatch = z.infer<typeof ConciergePoiBatchSchema>;

// ---------------------------------------------------------------------------
// Concierge-voice EVENT description schema (Phase 3)
//
// One short Concierge-voice paragraph per upcoming event (2-3 sentences,
// total 30-50 words). The hotel.upcoming_events jsonb cap stays at 280
// characters per the production reader schema, so we keep within that.
//
// Hard rules enforced *after* parsing (style-guide §4-5, identical to
// POI):
//   - sentence length ≤ 25 words
//   - no banned phrases
// Both checks live in `linter.ts → lintConciergeText()`.
//
// `dt_uuid` is the matching key when present (DATAtourisme UUID),
// `name + start_date` is the fallback (the reader already collapses
// duplicates by the same pair).
//
// The recommended format for the LLM (enforced by prompt, not schema):
//   "<Type d'événement> ouvert <au public|réservé sur invitation>,
//    du <X> au <Y>. <Conseil pratique actionnable du Concierge>."
// ---------------------------------------------------------------------------

const EVENT_DESC_MIN = 30;
const EVENT_DESC_MAX = 280;

export const ConciergeEventDescriptionSchema = z.object({
  match_key: z.string().min(1).max(120),
  description_fr: z.string().min(EVENT_DESC_MIN).max(EVENT_DESC_MAX),
});
export type ConciergeEventDescription = z.infer<typeof ConciergeEventDescriptionSchema>;

export const ConciergeEventBatchSchema = z.object({
  events: z.array(ConciergeEventDescriptionSchema).min(1).max(10),
});
export type ConciergeEventBatch = z.infer<typeof ConciergeEventBatchSchema>;

// ---------------------------------------------------------------------------
// Concierge-voice FAQ answer schema (Phase 4 — ADR-0011 C1)
//
// For every FAQ item on a hotel, the humanizer rewrites the answer
// in Concierge voice, marks the 5 best Q&A as `featured: true`, and
// MAY emit an optional `concierge_tip_fr` ("Mon conseil : …") on
// 1–2 items per hotel.
//
// Hard rules enforced *after* parsing (style-guide §4-5):
//   - 50–110 mots per answer
//   - ≤ 25 mots / phrase
//   - no banned phrases
//
// Featured curation rules (enforced in the prompt + verified by the
// orchestrator):
//   - exactly 5 featured per hotel
//   - prefer actionable / frequently-asked questions: parking,
//     petit-déj, check-in anticipé, transferts, animaux, taxes
//     locales, accessibilité, restaurants, distance aéroport.
//
// `match_key` keys the rewrite back to the source item — it is the
// original `question_fr` (or `question_en` fallback) sent in the
// input batch.
// ---------------------------------------------------------------------------

// Soft bounds — the orchestrator enforces the actual 15..110 word
// envelope. 60 chars is roughly 10 words: anything below that is
// almost certainly truncated LLM output.
const FAQ_ANSWER_MIN = 60;
const FAQ_ANSWER_MAX = 900;

export const ConciergeFaqAnswerSchema = z.object({
  match_key: z.string().min(1).max(300),
  answer_fr: z.string().min(FAQ_ANSWER_MIN).max(FAQ_ANSWER_MAX),
  // LLMs frequently omit `featured` when the value is `false` instead
  // of writing `featured: false`. We default to `false` so the schema
  // does not reject an otherwise-valid batch — the orchestrator
  // re-curates featured items in `clampFeatured` regardless.
  featured: z.boolean().optional().default(false),
  concierge_tip_fr: z.string().min(20).max(220).optional(),
});
export type ConciergeFaqAnswer = z.infer<typeof ConciergeFaqAnswerSchema>;

export const ConciergeFaqBatchSchema = z.object({
  faqs: z.array(ConciergeFaqAnswerSchema).min(1).max(20),
});
export type ConciergeFaqBatch = z.infer<typeof ConciergeFaqBatchSchema>;

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
