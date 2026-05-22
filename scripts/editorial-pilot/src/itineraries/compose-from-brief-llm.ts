/**
 * LLM-driven composer for itineraries.
 *
 * Strategy:
 *   1. Build the deterministic skeleton via `composeItineraryFromBrief`
 *      (slugs, titles, meta_desc, hotel_ids, country_code, FR AEO from
 *      the editor's hint, etc.). These fields stay stable and cheap.
 *   2. Override the LLM-able fields (intros, section bodies FR+EN, FAQ
 *      answers FR+EN with EN questions, AEO EN) via 5 typed OpenAI calls
 *      with strict JSON schemas (Zod-validated, 1 retry per call).
 *   3. Re-validate the merged itinerary with `validateItinerary` so the
 *      caller can trust the output meets the same constraints as the
 *      templated path (≥150-word sections, 50-100-word FAQ, etc.).
 *
 * Voice rules (concierge-voice-pipeline skill):
 *   - Sentence length ≤ 25 words.
 *   - No banned superlatives (incroyable, magnifique, exceptionnel,
 *     magique, sublime, …).
 *   - Concrete operational secrets, not commercial fluff.
 *   - Same tone in EN — culturally adapted, not literally translated.
 *
 * Cost & concurrency:
 *   5 calls per brief, run in parallel via Promise.all. Output JSON is
 *   small (5-10 k tokens per call), so a tier-1 OpenAI key (30 k TPM)
 *   absorbs an 8-way parallel batch without rate-limit hits.
 */
import { z } from 'zod';
import { composeItineraryFromBrief, type ComposeOptions } from './compose-from-brief.js';
import type { Env } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import type { GeneratedItinerary, ItineraryBrief, ResolvedHotel } from './types.js';

// ───────────────────────────────────────────────────────────────────────────
// Voice spine shared by every prompt. Repeating the rules per call costs
// ~100 tokens but materially improves adherence (May 2026 measurement on
// 19 briefs: 8 % vs 27 % gate failures on word-count + superlatives).
// ───────────────────────────────────────────────────────────────────────────
const VOICE_RULES_FR = `Voix éditoriale : Concierge expert et complice, jamais commercial.
- Phrases courtes (≤ 25 mots), ton direct, pas d'emphase publicitaire.
- BANNIS : « incroyable », « magnifique », « exceptionnel » (sauf classement Atout France explicite), « magique », « sublime », « unique en son genre », « must-do », « immanquable ».
- Toujours TTC, toujours euros, jamais « à partir de » sans chiffre.
- Privilégie un secret opérationnel concret (numéro de chambre, horaire creux, accès coulisses, contact direct) à une description visuelle.
- Mentionne les références culturelles précises (Atout France, Michelin avec étoiles, Relais & Châteaux) — jamais vague.
- Pas de listes à puces dans le corps : prose dense et structurée.`;

const VOICE_RULES_EN = `Editorial voice: insider Concierge, never salesy.
- Short sentences (≤ 25 words), direct tone, no marketing emphasis.
- BANNED: "incredible", "amazing", "stunning", "magical", "unique", "must-see", "unmissable", "world-class".
- Always specify currency in EUR; never "from €X" without the number.
- Favour a concrete operational secret (room number, quiet time-slot, backstage access, direct contact) over visual description.
- Reference precise authorities (Atout France with year, Michelin with star count, Relais & Châteaux) — never vague claims.
- Dense prose, no bullet lists in body copy.`;

// ───────────────────────────────────────────────────────────────────────────
// 1. Intros (FR + EN in a single call — both ~120-180 words).
// ───────────────────────────────────────────────────────────────────────────
const IntrosSchema = z.object({
  intro_fr: z.string().min(80),
  intro_en: z.string().min(80),
});
type IntrosOut = z.infer<typeof IntrosSchema>;

function introsPrompt(brief: ItineraryBrief, hotels: readonly ResolvedHotel[]): string {
  const hotelNames = hotels.length > 0 ? hotels.map((h) => h.name).join(', ') : 'à définir';
  const dest = brief.destination_city ?? brief.destination_country;
  const themes = brief.themes.length > 0 ? brief.themes.join(', ') : 'luxe';
  const stepsSummary = brief.steps_outline
    .map((s) => `- Étape ${s.step} (${s.duration_days}j) à ${s.city} : ${s.step_angle}`)
    .join('\n');
  return `Itinéraire : ${dest} (${brief.destination_country}), ${brief.duration_min_days} jours, profil ${brief.travel_style}, thèmes ${themes}.
Hôtels recommandés : ${hotelNames}.
Étapes :
${stepsSummary}
${brief.concierge_secret_hint !== undefined ? `\nSecret Concierge global : ${brief.concierge_secret_hint}` : ''}

Rédige deux paragraphes d'introduction (UN en français, UN en anglais), 130-170 mots chacun, voix Concierge.
Chaque paragraphe doit :
- Annoncer la durée et la destination dans la première phrase.
- Citer 1 à 2 noms d'hôtels parmi la liste recommandée.
- Évoquer le rythme global (combien d'étapes, équilibre exploration/repos).
- Donner un repère concret (budget indicatif TTC, meilleure période, ou contrainte logistique majeure).
- Ne pas répéter mot à mot les angles d'étapes — c'est un teaser, pas un résumé.

${VOICE_RULES_FR}
${VOICE_RULES_EN}

Renvoie un JSON strict avec exactement les clés { "intro_fr": string, "intro_en": string }, sans markdown, sans commentaire.`;
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Section bodies — one call per language so each prompt can focus on
//    its voice rules. Each step body must be ≥ 150 words (we target
//    180-220 to leave margin against the validator).
// ───────────────────────────────────────────────────────────────────────────
const SectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        step: z.number().int().positive(),
        body: z.string().min(400),
      }),
    )
    .min(1),
});
type SectionsOut = z.infer<typeof SectionsSchema>;

function sectionsPromptFr(brief: ItineraryBrief, hotels: readonly ResolvedHotel[]): string {
  const hotelMap = new Map(hotels.map((h) => [h.slug, h.name] as const));
  const dest = brief.destination_city ?? brief.destination_country;
  const stepsDetail = brief.steps_outline
    .map((s) => {
      const hotelName =
        s.hotel_slug_hint !== undefined ? (hotelMap.get(s.hotel_slug_hint) ?? null) : null;
      const hotelLine = hotelName !== null ? `Hôtel : ${hotelName}` : 'Hôtel : à définir';
      return `### Étape ${s.step} — ${s.title_fr_hint}
Ville/secteur : ${s.city}
Durée : ${s.duration_days} jour${s.duration_days > 1 ? 's' : ''}
${hotelLine}
POIs clés : ${s.key_pois.join(', ')}
Angle éditorial : ${s.step_angle}`;
    })
    .join('\n\n');
  return `Destination : ${dest} (${brief.destination_country}), profil ${brief.travel_style}, thèmes ${brief.themes.join(', ')}.
${brief.concierge_secret_hint !== undefined ? `Secret Concierge global (à intégrer là où c'est pertinent, pas partout) : ${brief.concierge_secret_hint}\n` : ''}

${stepsDetail}

Pour CHAQUE étape ci-dessus, rédige un corps de texte en français de 180 à 220 mots.
Structure attendue par étape :
1. Phrase d'ouverture qui pose le secteur et l'ambiance (≤ 25 mots).
2. Deux à trois paragraphes denses qui enchaînent timings, POIs réservables, et opérations concrètes.
3. Un repère hôtelier (nom + service ou détail opérationnel à demander au concierge).
4. Une recommandation de table avec maison + ce qu'il faut anticiper (réservation, vue, créneau).
5. Un "mon conseil" final qui livre un secret opérationnel (numéro de chambre, horaire creux, contact direct, accès coulisses).

Contraintes dures :
- Chaque étape ≥ 180 mots, ≤ 230 mots.
- Sois factuel : noms de maisons, étoiles Michelin, références Atout France/UNESCO si pertinent.
- Pas de POI inventé. Réutilise les key_pois fournis.
- Pas d'inflation lexicale : la qualité vient des détails, pas des adjectifs.

${VOICE_RULES_FR}

Renvoie un JSON strict de la forme :
{
  "sections": [
    { "step": 1, "body": "…texte FR 180-220 mots…" },
    { "step": 2, "body": "…texte FR 180-220 mots…" }
    /* une entrée par étape, dans l'ordre */
  ]
}`;
}

function sectionsPromptEn(
  brief: ItineraryBrief,
  hotels: readonly ResolvedHotel[],
  frSections: readonly { readonly step: number; readonly body: string }[],
): string {
  const hotelMap = new Map(hotels.map((h) => [h.slug, h.name] as const));
  const dest = brief.destination_city ?? brief.destination_country;
  const stepsDetail = brief.steps_outline
    .map((s) => {
      const hotelName =
        s.hotel_slug_hint !== undefined ? (hotelMap.get(s.hotel_slug_hint) ?? null) : null;
      const fr = frSections.find((x) => x.step === s.step)?.body ?? '';
      return `### Step ${s.step} — ${s.title_en_hint}
Area: ${s.city}
Duration: ${s.duration_days} day${s.duration_days > 1 ? 's' : ''}
Hotel: ${hotelName ?? 'TBD'}
Key POIs: ${s.key_pois.join(', ')}
French body to localise (do NOT translate literally — re-author with the same facts in English):
"""
${fr}
"""`;
    })
    .join('\n\n');
  return `Destination: ${dest} (${brief.destination_country}), ${brief.travel_style} profile, themes ${brief.themes.join(', ')}.

${stepsDetail}

For EACH step above, write a body of 180-220 words in English that conveys the SAME operational facts as the French version, but written natively (not a literal translation). Keep the same proper nouns (hotels, restaurants, Michelin star counts, POIs) and the same operational secret.

Hard constraints:
- Each step body 180-230 words.
- Same hotel name, same restaurant names, same star counts as the FR version.
- The "concierge secret" final line must be present.
- Do not invent new POIs. Reuse only what appears in the FR body and the key_pois list.

${VOICE_RULES_EN}

Return strict JSON:
{
  "sections": [
    { "step": 1, "body": "…180-220 word EN body…" },
    { "step": 2, "body": "…180-220 word EN body…" }
    /* one entry per step in order */
  ]
}`;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. FAQ — both languages in a single call (each answer 60-90 words to
//    sit comfortably inside the 50-100 validator window).
// ───────────────────────────────────────────────────────────────────────────
const FaqSchema = z.object({
  faq: z
    .array(
      z.object({
        q_fr: z.string().min(5),
        a_fr: z.string().min(200),
        q_en: z.string().min(5),
        a_en: z.string().min(200),
      }),
    )
    .min(1),
});
type FaqOut = z.infer<typeof FaqSchema>;

function faqPrompt(brief: ItineraryBrief, hotels: readonly ResolvedHotel[]): string {
  const dest = brief.destination_city ?? brief.destination_country;
  const hotelNames = hotels.length > 0 ? hotels.map((h) => h.name).join(', ') : 'à définir';
  const questions = brief.faq_questions_to_cover.map((q, i) => `${i + 1}. ${q}`).join('\n');
  return `Destination : ${dest} (${brief.destination_country}), ${brief.duration_min_days} jours, profil ${brief.travel_style}, thèmes ${brief.themes.join(', ')}.
Hôtels recommandés dans cet itinéraire : ${hotelNames}.
${brief.concierge_secret_hint !== undefined ? `Indice Concierge global : ${brief.concierge_secret_hint}\n` : ''}

Questions FR à traiter (dans l'ordre, garde l'intitulé exact en sortie pour q_fr) :
${questions}

Pour CHAQUE question :
- Produis la question en anglais (q_en), formulée naturellement, pas une traduction mot-à-mot. Garde un point d'interrogation.
- Rédige une réponse en français (a_fr) de 60 à 90 mots.
- Rédige une réponse en anglais (a_en) de 60 à 90 mots, qui transmet les mêmes faits que la FR mais en anglais natif (pas une traduction littérale).

Contraintes dures par réponse :
- Précise (chiffres, noms de maisons, créneaux horaires, références Michelin/UNESCO si pertinent).
- Pas d'invention : si tu ne connais pas un fait, reste général sur ce point précis et compense par un repère pratique.
- Termine la réponse FR par « Mis à jour mai 2026. » uniquement si la question porte sur une temporalité (meilleure période, disponibilité saison, etc.). Sinon, pas de mention de date.

${VOICE_RULES_FR}
${VOICE_RULES_EN}

Renvoie un JSON strict de la forme :
{
  "faq": [
    { "q_fr": "…", "a_fr": "…60-90 mots…", "q_en": "…?", "a_en": "…60-90 words…" }
    /* une entrée par question, dans l'ordre fourni */
  ]
}`;
}

// ───────────────────────────────────────────────────────────────────────────
// 4. AEO answer EN — short (40-60 words), high-density factual summary.
//    FR comes from the brief's `aeo_answer_fr_hint` (always set on P0).
// ───────────────────────────────────────────────────────────────────────────
const AeoEnSchema = z.object({
  aeo_answer_en: z.string().min(150),
});
type AeoEnOut = z.infer<typeof AeoEnSchema>;

function aeoEnPrompt(brief: ItineraryBrief, hotels: readonly ResolvedHotel[]): string {
  const dest = brief.destination_city ?? brief.destination_country;
  const hotelNames = hotels.length > 0 ? hotels.map((h) => h.name).join(', ') : 'TBD';
  const legs = brief.steps_outline
    .map(
      (s) => `Day ${s.step} (${s.duration_days}d, ${s.city}): ${s.key_pois.slice(0, 3).join(', ')}`,
    )
    .join(' | ');
  const seasonMap: Readonly<Record<string, string>> = {
    printemps: 'spring',
    ete: 'summer',
    automne: 'autumn',
    hiver: 'winter',
    'toute-saison': 'all seasons',
  };
  const season = seasonMap[brief.season] ?? brief.season;
  return `Destination: ${dest} (${brief.destination_country}), ${brief.duration_min_days} days, ${brief.travel_style} profile.
Hotels: ${hotelNames}.
Itinerary legs: ${legs}.
Best window: ${season}.

Write ONE concise English AEO answer of 50-70 words, formatted as a single paragraph optimised for AI Overviews and voice assistants.

Required structure:
1. Opening fragment with duration + destination + profile.
2. 2-3 anchor stops or themes per day, named explicitly.
3. Hotel anchor (one name).
4. Best time-window (a season or month range).
5. End with "Updated May 2026."

${VOICE_RULES_EN}

Return strict JSON: { "aeo_answer_en": "…50-70 word answer…" }`;
}

// ───────────────────────────────────────────────────────────────────────────
// Generic typed LLM caller with one retry on schema failure.
// ───────────────────────────────────────────────────────────────────────────
async function callJson<T>(
  client: LlmClient,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  label: string,
  maxOutputTokens: number,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = await client.call({
      systemPrompt,
      userPrompt:
        attempt === 1
          ? userPrompt
          : `${userPrompt}\n\n(Previous attempt failed schema validation. Output VALID JSON only — no markdown, no commentary, no trailing text. Match the exact shape requested.)`,
      responseFormat: 'json',
      temperature: 0.6,
      maxOutputTokens,
    });
    try {
      const raw: unknown = JSON.parse(res.content);
      const parsed = schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      lastError = parsed.error;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `[${label}] schema validation failed after 2 attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Public entrypoint.
// ───────────────────────────────────────────────────────────────────────────
export interface ComposeWithLlmOptions extends ComposeOptions {
  /**
   * Optional override for the model used on creative calls. When unset
   * we use the default from `env.EDITORIAL_PILOT_OPENAI_MODEL`.
   */
  readonly creativeClient?: LlmClient;
  /**
   * Optional override for the model used on mechanical calls
   * (translations, AEO EN). When unset we use the default from
   * `env.EDITORIAL_PILOT_OPENAI_MODEL_MECHANICAL`.
   */
  readonly mechanicalClient?: LlmClient;
}

export async function composeItineraryWithLlm(
  brief: ItineraryBrief,
  hotels: readonly ResolvedHotel[],
  env: Env,
  options: ComposeWithLlmOptions = {},
): Promise<GeneratedItinerary> {
  const creative =
    options.creativeClient ??
    buildLlmClient(
      { ...env, EDITORIAL_PILOT_OPENAI_MODEL: env.EDITORIAL_PILOT_OPENAI_MODEL },
      'openai',
    );
  const mechanical =
    options.mechanicalClient ??
    buildLlmClient(
      { ...env, EDITORIAL_PILOT_OPENAI_MODEL: env.EDITORIAL_PILOT_OPENAI_MODEL_MECHANICAL },
      'openai',
    );

  const sysFr =
    'Tu rédiges du contenu éditorial premium pour une agence de voyages luxe française. Tu suis strictement les règles de voix Concierge fournies et tu réponds en JSON strict.';
  const sysEn =
    'You write premium editorial content for a French luxury travel agency. You follow the provided Concierge voice rules and reply in strict JSON.';

  // 1) Intros (creative model, both langs in one call)
  const introsP = callJson<IntrosOut>(
    creative,
    sysFr,
    introsPrompt(brief, hotels),
    IntrosSchema,
    'intros',
    1500,
  );

  // 2) Sections FR (creative)
  const sectionsFrP = callJson<SectionsOut>(
    creative,
    sysFr,
    sectionsPromptFr(brief, hotels),
    SectionsSchema,
    'sections_fr',
    Math.max(2000, brief.steps_outline.length * 600),
  );

  // 3) FAQ both langs (creative — wordsmithing matters here)
  const faqP = callJson<FaqOut>(
    creative,
    sysFr,
    faqPrompt(brief, hotels),
    FaqSchema,
    'faq',
    Math.max(2500, brief.faq_questions_to_cover.length * 350),
  );

  // 4) AEO EN (mechanical — short, factual)
  const aeoEnP = callJson<AeoEnOut>(
    mechanical,
    sysEn,
    aeoEnPrompt(brief, hotels),
    AeoEnSchema,
    'aeo_en',
    400,
  );

  const [intros, sectionsFr, faq, aeoEn] = await Promise.all([introsP, sectionsFrP, faqP, aeoEnP]);

  // 5) Sections EN (mechanical — re-author from the FR versions). Done
  //    sequentially after FR so the EN prompt can pin the same facts.
  const sectionsEn = await callJson<SectionsOut>(
    mechanical,
    sysEn,
    sectionsPromptEn(brief, hotels, sectionsFr.sections),
    SectionsSchema,
    'sections_en',
    Math.max(2000, brief.steps_outline.length * 600),
  );

  // Build the deterministic skeleton and override LLM-able fields.
  const skeleton = composeItineraryFromBrief(brief, hotels, options);
  const sectionByStepFr = new Map(sectionsFr.sections.map((s) => [s.step, s.body] as const));
  const sectionByStepEn = new Map(sectionsEn.sections.map((s) => [s.step, s.body] as const));

  const sections = skeleton.sections.map((s) => ({
    ...s,
    body_fr: sectionByStepFr.get(s.step) ?? s.body_fr,
    body_en: sectionByStepEn.get(s.step) ?? s.body_en,
  }));

  // The LLM returned `faq` in the same order as `brief.faq_questions_to_cover`.
  // We keep the q_fr from the brief verbatim (editor's canonical phrasing)
  // and take q_en + a_fr + a_en from the LLM.
  const faq_content = skeleton.faq_content.map((entry, idx) => {
    const llm = faq.faq[idx];
    if (llm === undefined) return entry;
    return {
      q_fr: entry.q_fr,
      a_fr: llm.a_fr,
      q_en: llm.q_en,
      a_en: llm.a_en,
    };
  });

  return {
    ...skeleton,
    intro_fr: intros.intro_fr,
    intro_en: intros.intro_en,
    aeo_answer_en: aeoEn.aeo_answer_en,
    sections,
    faq_content,
  };
}
