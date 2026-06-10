/**
 * Transforms raw Perplexity FAQ research JSON into normalised DB payloads.
 */

import { CANONICAL_FAQ_QUESTIONS, normaliseFaqQuestion } from './canonical-faq-questions.js';
import {
  CONCIERGE_CATEGORY_EN,
  FAQ_CATEGORY_EN,
  FAQ_CATEGORY_TO_BUCKET,
  FAQ_PROMOTE_MAX_ITEMS,
  FAQ_PROMOTE_MIN_ITEMS,
  type NormalisedConciergeQuestion,
  type NormalisedFaqKitItem,
  type NormalisedHotelFaqKit,
  type PerplexityHotelFaqResearch,
} from './faq-perplexity-taxonomy.js';

export interface TransformHotelFaqOptions {
  readonly hotelName?: string;
  readonly promoteCount?: number;
}

function mapFaqItem(item: PerplexityHotelFaqResearch['faq'][number]): NormalisedFaqKitItem {
  const bucket = FAQ_CATEGORY_TO_BUCKET[item.category];
  return {
    category: bucket,
    group_fr: item.category,
    group_en: FAQ_CATEGORY_EN[item.category],
    question_fr: item.question.trim(),
    answer_fr: item.answer.trim(),
  };
}

function mapConciergeItem(
  item: PerplexityHotelFaqResearch['concierge_questions'][number],
): NormalisedConciergeQuestion {
  return {
    category_fr: item.category,
    category_en: CONCIERGE_CATEGORY_EN[item.category],
    question_fr: item.question.trim(),
    reply_fr: item.concierge_reply.trim(),
  };
}

/** Canonical keys matched by normalised question text (hotel name substituted). */
const CANONICAL_MATCH_HINTS: Readonly<Record<string, readonly string[]>> = {
  parking: ['parking', 'stationnement', 'valet', 'voiturier'],
  breakfast: ['petit dejeuner', 'breakfast', 'petit-dejeuner'],
  wifi: ['wi fi', 'wifi', 'internet'],
  pets: ['animaux', 'chien', 'chat', 'pets', 'compagnie'],
  airport: ['aeroport', 'airport', 'gare la plus proche', 'gare tgv'],
  pool: ['piscine', 'pool'],
  early_checkin: ['check in anticip', 'early check', 'arrivee anticip', 'early check-in'],
  transfers: ['transfert', 'navette', 'transfer', 'shuttle'],
  cancellation: ['annulation', 'cancellation', 'modifier', 'conditions d annulation'],
  taxes: ['taxe de sejour', 'taxes', 'resort fee', 'city tax', 'frais de resort'],
};

function normaliseHint(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseForMatch(s: string): string {
  return normaliseFaqQuestion(s).replace(/-/g, ' ');
}

function questionMatchesCanonicalKey(
  normalisedQuestion: string,
  key: string,
  hotelName: string,
): boolean {
  const q = normaliseForMatch(normalisedQuestion);
  const canonical = CANONICAL_FAQ_QUESTIONS.find((item) => item.key === key);
  if (canonical === undefined) return false;
  const expected = normaliseForMatch(canonical.question_fr.replaceAll('{{name}}', hotelName));
  if (q === expected) return true;
  const hints = CANONICAL_MATCH_HINTS[key] ?? [];
  return hints.some((hint) => q.includes(normaliseHint(hint)));
}

/**
 * Picks 10–15 items for `faq_content` (JSON-LD + publish gates).
 * Prioritises CDC canonical coverage, then fills by source order.
 */
export function selectPromoteSubset(
  kit: readonly NormalisedFaqKitItem[],
  options: TransformHotelFaqOptions = {},
): NormalisedFaqKitItem[] {
  const hotelName = options.hotelName ?? '';
  const target = Math.min(
    FAQ_PROMOTE_MAX_ITEMS,
    Math.max(FAQ_PROMOTE_MIN_ITEMS, options.promoteCount ?? FAQ_PROMOTE_MAX_ITEMS),
  );
  const picked: NormalisedFaqKitItem[] = [];
  const pickedQuestions = new Set<string>();

  const tryPick = (item: NormalisedFaqKitItem): void => {
    const key = normaliseFaqQuestion(item.question_fr);
    if (pickedQuestions.has(key)) return;
    pickedQuestions.add(key);
    picked.push(item);
  };

  for (const canonical of CANONICAL_FAQ_QUESTIONS) {
    if (picked.length >= target) break;
    const match = kit.find((item) =>
      questionMatchesCanonicalKey(normaliseFaqQuestion(item.question_fr), canonical.key, hotelName),
    );
    if (match !== undefined) {
      tryPick({
        ...match,
        question_fr: canonical.question_fr.replaceAll('{{name}}', hotelName),
      });
    }
  }

  for (const item of kit) {
    if (picked.length >= target) break;
    tryPick(item);
  }

  return picked.slice(0, target);
}

export function transformPerplexityHotelFaq(
  raw: PerplexityHotelFaqResearch,
  options: TransformHotelFaqOptions = {},
): NormalisedHotelFaqKit {
  const kit = raw.faq.map(mapFaqItem);
  const promote = selectPromoteSubset(kit, options);
  const conciergeQuestions = raw.concierge_questions.map(mapConciergeItem);
  return { kit, promote, conciergeQuestions };
}
