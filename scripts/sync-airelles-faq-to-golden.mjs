import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const dataPath = path.join(repoRoot, 'DA/_generated/airelles-faq-data.json');
const outPath = path.join(repoRoot, 'packages/domain/src/editorial/airelles-faq-perplexity.generated.ts');

const { faq, concierge_questions: conciergeQuestions } = JSON.parse(
  fs.readFileSync(dataPath, 'utf8'),
);

const CATEGORY_BUCKET = {
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

const CATEGORY_EN = {
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

const CONCIERGE_CATEGORY_EN = {
  'Transferts & Transport': 'Transfers & Transport',
  'Réservations de restaurants': 'Restaurant Reservations',
  'Réservations spa': 'Spa Bookings',
  'Excursions & Visites culturelles': 'Excursions & Cultural Visits',
  'Occasions spéciales': 'Special Occasions',
  'Shopping & Services de luxe': 'Shopping & Luxury Services',
  'Activités familiales': 'Family Activities',
  'Expériences personnalisées': 'Personalized Experiences',
};

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const faqItems = faq.map((item) => {
  let question = item.question;
  let answer = item.answer;
  if (question.includes("L'Orangerie propose-t-elle un brunch")) {
    question = 'Le Brunch du Dimanche est-il proposé à La Bastide ?';
    answer =
      "Oui, chaque dimanche, le Brunch du Dimanche à La Table de La Bastide propose un buffet sucré et salé dans les jardins suspendus, de 12h à 14h15. Ouvert aux visiteurs extérieurs — réservez 48 h à l'avance.";
  }
  const bucket = CATEGORY_BUCKET[item.category] ?? 'during';
  const groupEn = CATEGORY_EN[item.category] ?? item.category;
  return {
    category: bucket,
    group_fr: item.category,
    group_en: groupEn,
    question_fr: question,
    answer_fr: answer,
  };
});

const conciergeItems = conciergeQuestions.map((item) => ({
  category_fr: item.category,
  category_en: CONCIERGE_CATEGORY_EN[item.category] ?? item.category,
  question_fr: item.question,
  reply_fr: item.concierge_reply,
}));

const promoteItems = faqItems.slice(0, 15);

const faqLines = faqItems
  .map(
    (item) => `  {
    category: '${item.category}',
    group_fr: '${esc(item.group_fr)}',
    group_en: '${esc(item.group_en)}',
    question_fr: '${esc(item.question_fr)}',
    answer_fr: '${esc(item.answer_fr)}',
  }`,
  )
  .join(',\n');

const conciergeLines = conciergeItems
  .map(
    (item) => `  {
    category_fr: '${esc(item.category_fr)}',
    category_en: '${esc(item.category_en)}',
    question_fr: '${esc(item.question_fr)}',
    reply_fr: '${esc(item.reply_fr)}',
  }`,
  )
  .join(',\n');

const promoteLines = promoteItems
  .map(
    (item) => `  {
    category: '${item.category}',
    group_fr: '${esc(item.group_fr)}',
    group_en: '${esc(item.group_en)}',
    question_fr: '${esc(item.question_fr)}',
    answer_fr: '${esc(item.answer_fr)}',
  }`,
  )
  .join(',\n');

const output = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: DA/_generated/airelles-faq-data.json (Perplexity research)
 * Regenerate: node scripts/sync-airelles-faq-to-golden.mjs
 */

/** ${faqItems.length} factual FAQ items for kit render + JSON-LD. */
export const AIRELLES_FAQ_CONTENT_KIT = [
${faqLines},
] as const;

/** CDC §2.11 promote subset (${promoteItems.length} items). */
export const AIRELLES_FAQ_CONTENT_PROMOTE = [
${promoteLines},
] as const;

/** ${conciergeItems.length} concierge-voice Q&A for #concierge-questions. */
export const AIRELLES_CONCIERGE_QUESTIONS_KIT = [
${conciergeLines},
] as const;

export type AirellesConciergeQuestionKit = (typeof AIRELLES_CONCIERGE_QUESTIONS_KIT)[number];
`;

fs.writeFileSync(outPath, output, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`FAQ: ${faqItems.length}, Concierge: ${conciergeItems.length}, Promote: ${promoteItems.length}`);
