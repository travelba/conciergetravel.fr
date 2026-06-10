import 'server-only';

import {
  AIRELLES_CONCIERGE_QUESTIONS_KIT,
  PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT,
} from '@mch/domain/editorial';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { pickLocalizedText } from '@/i18n/supported-locale';

export interface HotelKitConciergeQuestionGroup {
  readonly label: string;
  readonly items: readonly { question: string; reply: string }[];
}

type ConciergeQuestionKitItem = (typeof AIRELLES_CONCIERGE_QUESTIONS_KIT)[number];

function buildKitConciergeQuestionGroups(
  locale: SupportedLocale,
  items: readonly ConciergeQuestionKitItem[],
): readonly HotelKitConciergeQuestionGroup[] {
  const groups: HotelKitConciergeQuestionGroup[] = [];
  const indexByLabel = new Map<string, number>();
  for (const item of items) {
    const label = pickLocalizedText(locale, item.category_fr, item.category_en) ?? item.category_fr;
    const question = item.question_fr;
    const reply = item.reply_fr;
    const existing = indexByLabel.get(label);
    const entry = { question, reply };
    if (existing === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, items: [entry] });
    } else {
      const group = groups[existing];
      if (group !== undefined) {
        groups[existing] = { label: group.label, items: [...group.items, entry] };
      }
    }
  }
  return groups;
}

export function readAirellesConciergeQuestionGroups(
  slug: string,
  locale: SupportedLocale,
): readonly HotelKitConciergeQuestionGroup[] {
  if (slug !== 'les-airelles-gordes' && slug !== 'les-airelles-gordes-en') return [];
  return buildKitConciergeQuestionGroups(locale, AIRELLES_CONCIERGE_QUESTIONS_KIT);
}

/**
 * Runtime concierge Q&A for Prince de Galles kit — wired when
 * `PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT` ships in `@mch/domain/editorial`.
 */
export function readPrinceDeGallesConciergeQuestionGroups(
  slug: string,
  locale: SupportedLocale,
): readonly HotelKitConciergeQuestionGroup[] {
  if (slug !== 'prince-de-galles-paris') return [];
  return buildKitConciergeQuestionGroups(locale, PRINCE_DE_GALLES_CONCIERGE_QUESTIONS_KIT);
}

export function readKitConciergeQuestionGroupsFromGolden(
  slug: string,
  locale: SupportedLocale,
): readonly HotelKitConciergeQuestionGroup[] {
  const airelles = readAirellesConciergeQuestionGroups(slug, locale);
  if (airelles.length > 0) return airelles;
  return readPrinceDeGallesConciergeQuestionGroups(slug, locale);
}
