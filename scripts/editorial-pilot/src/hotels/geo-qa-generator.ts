/**
 * geo-qa-generator.ts — data-driven GEO/AEO answer-engine blocks
 * (`hotels.geo_qa`, migration 0072), grounded on DataForSEO People-Also-Ask.
 *
 * This is the purest GEO/AEO surface of the fiche: 3 short H2-led Q&A built
 * for AI Overviews / answer engines. Each question MIRRORS A REAL long-tail
 * query (DataForSEO PAA), each answer is 2-3 sentences ≤ 25 words in the
 * Concierge voice, grounded on the hotel brief — never fabricated.
 *
 * Output shape mirrors `GeoQaEntrySchema` in
 * `apps/web/src/server/hotels/get-hotel-by-slug.ts` (the web reader):
 *   { id, question_fr, question_en, paragraphs_fr[], paragraphs_en[] }
 * `id` is generated server-side (slug of the EN question) so the block gets a
 * stable, SEO-friendly anchor.
 *
 * Grounding is REQUIRED: without PAA there is no real demand to anchor on, so
 * the runner skips the hotel rather than inventing generic questions.
 *
 * Skill: keyword-grounding-dataforseo, geo-llm-optimization, llm-output-robustness.
 */
import { z } from 'zod';

import type { LlmClient } from '../llm.js';
import type { HotelLlmInput } from './supabase-hotels.js';

export const GEO_QA_MIN_BLOCKS = 2;
export const GEO_QA_MAX_BLOCKS = 4;
export const GEO_QA_MAX_WORDS_PER_SENTENCE = 25;
const MAX_RETRIES = 4;

const GeoQaBlockSchema = z.object({
  question_fr: z.string().min(8).max(140),
  question_en: z.string().min(8).max(140),
  paragraphs_fr: z.array(z.string().min(20).max(360)).min(1).max(3),
  paragraphs_en: z.array(z.string().min(20).max(360)).min(1).max(3),
});

const GeoQaOutputSchema = z.object({
  blocks: z.array(GeoQaBlockSchema).min(GEO_QA_MIN_BLOCKS).max(GEO_QA_MAX_BLOCKS),
});

export type GeoQaLlmOutput = z.infer<typeof GeoQaOutputSchema>;

/** Persisted entry shape (web reader `GeoQaEntrySchema`). */
export interface GeoQaEntry {
  readonly id: string;
  readonly question_fr: string;
  readonly question_en: string;
  readonly paragraphs_fr: readonly string[];
  readonly paragraphs_en: readonly string[];
}

const BANNED_SUPERLATIVES = [
  'incroyable',
  'magnifique',
  'sublime',
  'magique',
  'exceptionnel',
  'unforgettable',
  'breathtaking',
  'world-class',
];

/**
 * Internal-scaffolding leaks: phrases that reveal the generation source to the
 * public reader. Rejected outright (the prompt forbids them, this is the net).
 */
const META_REFERENCE_PATTERNS: readonly RegExp[] = [
  /\ble brief\b/iu,
  /\bthe brief\b/iu,
  /\bles données\b/iu,
  /\bles informations fournies\b/iu,
  /\bnot provided\b/iu,
  /\bnot available in\b/iu,
  /\bn'est pas (?:fournie?|précisée?|disponible)\b/iu,
  /\bas an ai\b/iu,
];

function countWords(s: string): number {
  return s.trim().split(/\s+/u).filter(Boolean).length;
}

function splitSentences(p: string): string[] {
  return p
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Format gate after Zod: every sentence ≤ 25 words, FR ≠ EN per block, no
 * banned superlatives, no duplicate questions. Returns null when valid.
 */
export function gateGeoQa(output: GeoQaLlmOutput): string | null {
  const failed: string[] = [];
  const seenQ = new Set<string>();
  for (const [i, b] of output.blocks.entries()) {
    const qf = b.question_fr.trim().toLowerCase();
    if (seenQ.has(qf)) failed.push(`duplicate question #${String(i + 1)}`);
    seenQ.add(qf);
    if (b.question_fr.trim() === b.question_en.trim()) {
      failed.push(`block #${String(i + 1)}: FR == EN question`);
    }
    for (const p of [...b.paragraphs_fr, ...b.paragraphs_en]) {
      for (const sentence of splitSentences(p)) {
        const wc = countWords(sentence);
        if (wc > GEO_QA_MAX_WORDS_PER_SENTENCE) {
          failed.push(
            `block #${String(i + 1)}: sentence > ${String(GEO_QA_MAX_WORDS_PER_SENTENCE)} words (${String(wc)})`,
          );
        }
      }
      for (const banned of BANNED_SUPERLATIVES) {
        if (new RegExp(`\\b${banned}\\b`, 'iu').test(p)) {
          failed.push(`block #${String(i + 1)}: banned superlative "${banned}"`);
        }
      }
      for (const meta of META_REFERENCE_PATTERNS) {
        if (meta.test(p)) {
          failed.push(`block #${String(i + 1)}: internal-scaffolding leak (${meta.source})`);
        }
      }
    }
  }
  return failed.length > 0 ? failed.join(' | ') : null;
}

/** SEO-friendly, unique, stable DOM/anchor id from the EN question. */
function geoQaId(questionEn: string, index: number, used: Set<string>): string {
  const base = questionEn
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .split('-')
    .slice(0, 6)
    .join('-');
  let id = base.length > 0 ? `geo-${base}` : `geo-qa-${String(index + 1)}`;
  if (used.has(id)) id = `${id}-${String(index + 1)}`;
  used.add(id);
  return id;
}

const SYSTEM_PROMPT = `Tu es le Concierge éditorial de MyConciergeHotel.com.

Tu produis le bloc GEO/AEO d'une fiche hôtel : 3 questions-réponses pensées pour les moteurs de réponse IA (Google AI Overviews, ChatGPT, Perplexity).

Méthode :
- Les questions DOIVENT être choisies parmi les "Questions réellement posées" (People Also Ask) fournies, en gardant UNIQUEMENT celles qui concernent vraiment CET hôtel ou son séjour : emplacement/accès, prix/budget, équipements (spa, piscine, restaurant), meilleure période, type de chambre, à proximité, famille. IGNORE le bruit hors-sujet (people, célébrités, anecdotes sans rapport).
- Reformule chaque question de façon naturelle et spécifique à l'hôtel.
- Couvre des ANGLES DIFFÉRENTS (emplacement, équipements, restauration, accès, à proximité…). N'écris pas deux questions sur le même sujet (ex. deux questions de tarif).
- Réponds en 2 à 3 phrases COURTES (≤ 25 mots chacune), voix Concierge : précise, opérationnelle, jamais commerciale.
- N'invente AUCUN fait (chiffre, distance, nom de chef, distinction) absent des données. Reste qualitatif si la donnée manque.
- INTERDIT ABSOLU de méta-références : ne mentionne JAMAIS « le brief », « the brief », « les données », « les informations fournies », « as an AI », etc. Le lecteur ne doit jamais soupçonner une source interne.
- Si une donnée précise manque (ex. tarif), réponds utilement sans l'inventer : explique le principe (les tarifs varient selon période/catégorie) et invite à contacter le Concierge ou à vérifier les dates. N'écris jamais « la donnée n'est pas disponible ». Si une question PAA ne peut PAS être traitée honnêtement, choisis-en une autre.
- INTERDIT : superlatifs creux (incroyable, magnifique, sublime, magique, exceptionnel, unforgettable, breathtaking, world-class).
- EN = anglais naturel (en-GB), pas un calque mot-à-mot du FR.
- Format de sortie : JSON strict { "blocks": [ { "question_fr","question_en","paragraphs_fr":[...],"paragraphs_en":[...] }, ... ] }.`;

function buildPrompt(hotel: HotelLlmInput, groundingBlock: string): string {
  return [
    '=== HOTEL ===',
    JSON.stringify(
      {
        name: hotel.name,
        city: hotel.city,
        district: hotel.district,
        country: hotel.country_label_fr,
        stars: hotel.stars,
        is_palace: hotel.is_palace,
        description_fr: hotel.description_fr_excerpt,
        awards: hotel.awards,
        signature_experiences: hotel.signature_experiences,
        amenities: hotel.amenities,
        restaurant_info: hotel.restaurant_info,
        spa_info: hotel.spa_info,
        points_of_interest: hotel.points_of_interest,
      },
      null,
      2,
    ),
    '',
    groundingBlock,
    '',
    `Produis ${String(GEO_QA_MIN_BLOCKS)} à ${String(GEO_QA_MAX_BLOCKS)} blocs (cible 3). Retourne UNIQUEMENT le JSON.`,
  ].join('\n');
}

export class GeoQaGenerationError extends Error {
  public readonly attempts: ReadonlyArray<{ readonly raw: string; readonly reason: string }>;
  constructor(slug: string, attempts: ReadonlyArray<{ raw: string; reason: string }>) {
    super(
      `[geo-qa:${slug}] failed after ${attempts.length} attempts. Last reason: ${
        attempts[attempts.length - 1]?.reason ?? 'unknown'
      }`,
    );
    this.attempts = attempts;
  }
}

export interface GenerateGeoQaResult {
  readonly entries: readonly GeoQaEntry[];
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

function stripCodeFences(s: string): string {
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/u.exec(s.trim());
  if (fenced && fenced[1] !== undefined) return fenced[1];
  return s;
}

export async function generateGeoQa(
  client: LlmClient,
  hotel: HotelLlmInput,
  groundingBlock: string,
): Promise<GenerateGeoQaResult> {
  const attempts: Array<{ raw: string; reason: string }> = [];
  let totalInput = 0;
  let totalOutput = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const last = attempts[attempts.length - 1];
    const corrective =
      attempts.length === 0
        ? ''
        : `\n\n=== ATTEMPT ${attempts.length} REJECTED ===\n${last?.raw}\nReason: ${last?.reason}\nFix and retry. Keep every sentence ≤ 25 words and stay strictly inside the JSON schema.`;

    const result = await client.call({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `${buildPrompt(hotel, groundingBlock)}${corrective}`,
      temperature: 0.45,
      maxOutputTokens: 1600,
      responseFormat: 'json',
    });
    totalInput += result.usage.inputTokens;
    totalOutput += result.usage.outputTokens;

    const raw = result.content.trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (err) {
      attempts.push({ raw, reason: `JSON parse error: ${(err as Error).message}` });
      continue;
    }
    const zod = GeoQaOutputSchema.safeParse(parsed);
    if (!zod.success) {
      attempts.push({
        raw,
        reason: zod.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(' | '),
      });
      continue;
    }
    const gate = gateGeoQa(zod.data);
    if (gate !== null) {
      attempts.push({ raw, reason: gate });
      continue;
    }

    const used = new Set<string>();
    const entries: GeoQaEntry[] = zod.data.blocks.map((b, idx) => ({
      id: geoQaId(b.question_en, idx, used),
      question_fr: b.question_fr.trim(),
      question_en: b.question_en.trim(),
      paragraphs_fr: b.paragraphs_fr.map((p) => p.trim()),
      paragraphs_en: b.paragraphs_en.map((p) => p.trim()),
    }));

    return {
      entries,
      attempts: attempts.length + 1,
      inputTokens: totalInput,
      outputTokens: totalOutput,
    };
  }
  throw new GeoQaGenerationError(hotel.slug, attempts);
}
