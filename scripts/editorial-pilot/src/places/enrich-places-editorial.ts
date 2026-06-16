/**
 * enrich-places-editorial.ts — LLM editorial pass for place scaffolds.
 *
 * For each unpublished place missing its factual summary, generate the
 * editorial envelope (factual summary FR/EN + short description FR/EN +
 * a Concierge tip + a starter FAQ) in the brand "voix du Concierge"
 * (EDITORIAL_VOICE.md / ADR-0011). Output is validated against a Zod
 * schema and PATCHed onto the row. The place stays `is_published=false`
 * — a human / the publish gate flips it once the envelope clears the
 * Payload validators.
 *
 * Imported lazily by source-places.ts (`--enrich`) so the base scaffold
 * run never requires OPENAI_API_KEY. Uses the shared `llmExtract` helper.
 */
import { z } from 'zod';

import { llmExtract } from '../enrichment/llm-extract.js';

import { patchById, selectTable, type SupabaseRestConfig } from './supabase-places.js';

interface PlaceRow {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly kind: string;
  readonly bucket: string;
  readonly factual_summary_fr: string | null;
}

const FaqEntrySchema = z.object({
  q_fr: z.string().min(8),
  a_fr: z.string().min(20),
  q_en: z.string().min(8),
  a_en: z.string().min(20),
});

const PlaceEditorialSchema = z.object({
  factual_summary_fr: z.string().min(110).max(165),
  factual_summary_en: z.string().min(110).max(180),
  description_fr: z.string().min(300),
  description_en: z.string().min(300),
  concierge_advice: z.object({
    fr: z.object({ title: z.string().min(3), body: z.string().min(40) }),
    en: z.object({ title: z.string().min(3), body: z.string().min(40) }),
  }),
  faq: z.array(FaqEntrySchema).min(6),
});

const SCHEMA_DESCRIPTION = `Return a single JSON object:
{
  "factual_summary_fr": "110-165 caractères, factuel, voix Concierge (jamais commercial)",
  "factual_summary_en": "110-180 chars, same facts in English",
  "description_fr": "300-600 mots, phrases <= 25 mots, expert complice, jamais de superlatifs vides",
  "description_en": "300-600 words English",
  "concierge_advice": { "fr": { "title": "...", "body": "60-90 mots, ouvre sur un secret opérationnel concret (horaire, accès, salle)" }, "en": { ... } },
  "faq": [{ "q_fr": "...", "a_fr": "...", "q_en": "...", "a_en": "..." }, ... (>= 6)]
}`;

const SYSTEM_VOICE = `Tu es le Concierge de MyConciergeHotel.com — un expert complice, jamais commercial, toujours précis.
Règles dures : phrases <= 25 mots ; prix toujours TTC en euros ; pas de superlatifs vides (incroyable, magnifique, exceptionnel, magique, sublime) ;
références culturelles précises (Atout France + année, étoiles Michelin, etc.) ; jamais de traduction littérale machine (l'anglais est réécrit, pas traduit).
N'invente jamais un fait non vérifiable : reste factuel sur l'horaire/l'accès/le contexte historique connu.`;

/**
 * Enrich every unpublished place of a city missing its factual summary.
 * Returns the number of rows enriched.
 */
export async function enrichPlacesEditorial(
  cfg: SupabaseRestConfig,
  cityKey: string,
): Promise<number> {
  const places = await selectTable<PlaceRow>(cfg, 'places', {
    columns: 'id, name, city, kind, bucket, factual_summary_fr',
    filters: [`city_key=eq.${cityKey}`, 'is_published=eq.false', 'factual_summary_fr=is.null'],
    order: 'id.asc',
  });

  console.log(`[enrich] ${String(places.length)} places to enrich in ${cityKey}.`);
  let enriched = 0;

  for (const place of places) {
    const context = `${place.name} — ${place.kind} (${place.bucket}) à ${place.city}. Fiche "lieu à visiter".`;
    const result = await llmExtract({
      content: `Lieu : ${place.name}\nVille : ${place.city}\nType : ${place.kind} / ${place.bucket}\n\n${SYSTEM_VOICE}`,
      context,
      schemaDescription: SCHEMA_DESCRIPTION,
      schema: PlaceEditorialSchema,
      maxOutputTokens: 4000,
    });
    if (result === null) {
      console.warn(`  [enrich] ${place.name}: LLM returned nothing usable — skipped.`);
      continue;
    }
    const e = result.data;
    await patchById(cfg, 'places', place.id, {
      factual_summary_fr: e.factual_summary_fr,
      factual_summary_en: e.factual_summary_en,
      description_fr: e.description_fr,
      description_en: e.description_en,
      concierge_advice: e.concierge_advice,
      faq: e.faq,
    });
    enriched += 1;
    console.log(`  [enrich] ${place.name} ✓`);
  }

  console.log(`[enrich] done — ${String(enriched)}/${String(places.length)} enriched.`);
  return enriched;
}
