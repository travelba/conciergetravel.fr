/**
 * CDC §2.11 — 10 canonical FAQ questions (shared by run-faq-canonical
 * and hotel-fiche-gates audit).
 */

export interface CanonicalFaqQuestion {
  readonly key: string;
  readonly question_fr: string;
  readonly question_en: string;
}

export const CANONICAL_FAQ_QUESTIONS: readonly CanonicalFaqQuestion[] = [
  {
    key: 'parking',
    question_fr: "L'hôtel dispose-t-il d'un parking ?",
    question_en: 'Does the hotel have parking facilities?',
  },
  {
    key: 'breakfast',
    question_fr: 'Quel type de petit-déjeuner est proposé ?',
    question_en: 'What kind of breakfast is served?',
  },
  {
    key: 'wifi',
    question_fr: "Le Wi-Fi est-il disponible dans l'hôtel ?",
    question_en: 'Is Wi-Fi available throughout the hotel?',
  },
  {
    key: 'pets',
    question_fr: 'Les animaux sont-ils acceptés à {{name}} ?',
    question_en: 'Are pets allowed at {{name}}?',
  },
  {
    key: 'airport',
    question_fr: "Quelle est la distance entre l'hôtel et l'aéroport ?",
    question_en: 'How far is the hotel from the airport?',
  },
  {
    key: 'pool',
    question_fr: "L'hôtel dispose-t-il d'une piscine ?",
    question_en: 'Does the hotel have a pool?',
  },
  {
    key: 'early_checkin',
    question_fr: 'Puis-je effectuer un check-in anticipé ?',
    question_en: 'Is early check-in available?',
  },
  {
    key: 'transfers',
    question_fr: "Des transferts vers l'aéroport sont-ils proposés ?",
    question_en: 'Are airport transfers offered?',
  },
  {
    key: 'cancellation',
    question_fr: "Quelle est la politique d'annulation de l'hôtel ?",
    question_en: "What is the hotel's cancellation policy?",
  },
  {
    key: 'taxes',
    question_fr: 'Y a-t-il des taxes de séjour à payer ?',
    question_en: 'Are there any tourist taxes to pay?',
  },
] as const;

export function normaliseFaqQuestion(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FaqItemLike {
  readonly question_fr?: string;
  readonly question?: string;
  readonly answer_fr?: string;
  readonly answer_en?: string;
  readonly featured?: boolean;
  readonly concierge_tip_fr?: string;
  readonly concierge_tip_en?: string;
}

export function isFaqCanonicalSet(
  items: readonly FaqItemLike[] | null | undefined,
  hotelName: string,
): boolean {
  const faq = items ?? [];
  // The CDC FAQ band is 10-15 items: a fiche may legitimately carry the 10
  // canonical questions PLUS hotel-specific extras (e.g. les-airelles-gordes
  // has 12). Require the canonical set to be PRESENT (subset), not that the
  // list length equals exactly 10 — the old exact-length check produced a
  // false "not canonical" on every extended FAQ and would have let the
  // pipeline overwrite good extras.
  if (faq.length < CANONICAL_FAQ_QUESTIONS.length) return false;
  const haystack = new Set(
    faq.map((it) => normaliseFaqQuestion(it.question_fr ?? it.question ?? '')),
  );
  for (const q of CANONICAL_FAQ_QUESTIONS) {
    const expected = normaliseFaqQuestion(q.question_fr.replaceAll('{{name}}', hotelName));
    if (!haystack.has(expected)) return false;
  }
  return true;
}

export function countFeaturedFaq(items: readonly FaqItemLike[] | null | undefined): number {
  const faq = items ?? [];
  return faq.filter((it) => it.featured === true).length;
}

export function countFeaturedFaqTips(items: readonly FaqItemLike[] | null | undefined): number {
  const faq = items ?? [];
  return faq.filter(
    (it) =>
      it.featured === true &&
      typeof it.concierge_tip_fr === 'string' &&
      it.concierge_tip_fr.trim().length > 0,
  ).length;
}
