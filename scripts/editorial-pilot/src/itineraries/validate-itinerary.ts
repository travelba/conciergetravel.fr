import { countWords } from './word-count.js';
import { GeneratedItinerarySchema, type GeneratedItinerary } from './types.js';

const AEO_MIN_WORDS = 40;
const AEO_MAX_WORDS = 80;
const SECTION_MIN_WORDS = 150;
const FAQ_ANSWER_MIN_WORDS = 50;
const FAQ_ANSWER_MAX_WORDS = 100;
const META_DESC_MIN = 140;
const META_DESC_MAX = 160;

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateItinerary(itinerary: unknown): {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly data: GeneratedItinerary | null;
} {
  const parsed = GeneratedItinerarySchema.safeParse(itinerary);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
      data: null,
    };
  }

  const issues: ValidationIssue[] = [];
  const data = parsed.data;

  for (const field of ['aeo_answer_fr', 'aeo_answer_en'] as const) {
    const wc = countWords(data[field]);
    if (wc < AEO_MIN_WORDS || wc > AEO_MAX_WORDS) {
      issues.push({
        path: field,
        message: `${wc} words — expected ${AEO_MIN_WORDS}-${AEO_MAX_WORDS}`,
      });
    }
  }

  for (const section of data.sections) {
    for (const field of ['body_fr', 'body_en'] as const) {
      const wc = countWords(section[field]);
      if (wc < SECTION_MIN_WORDS) {
        issues.push({
          path: `sections[${section.step}].${field}`,
          message: `${wc} words — expected ≥${SECTION_MIN_WORDS}`,
        });
      }
    }
    if (section.poi.length < 1) {
      issues.push({
        path: `sections[${section.step}].poi`,
        message: 'At least one POI required',
      });
    }
  }

  for (let i = 0; i < data.faq_content.length; i += 1) {
    const entry = data.faq_content[i];
    if (entry === undefined) continue;
    for (const field of ['a_fr', 'a_en'] as const) {
      const wc = countWords(entry[field]);
      if (wc < FAQ_ANSWER_MIN_WORDS || wc > FAQ_ANSWER_MAX_WORDS) {
        issues.push({
          path: `faq_content[${i}].${field}`,
          message: `${wc} words — expected ${FAQ_ANSWER_MIN_WORDS}-${FAQ_ANSWER_MAX_WORDS}`,
        });
      }
    }
  }

  for (const field of ['meta_desc_fr', 'meta_desc_en'] as const) {
    const len = data[field].length;
    if (len < META_DESC_MIN || len > META_DESC_MAX) {
      issues.push({
        path: field,
        message: `${len} chars — expected ${META_DESC_MIN}-${META_DESC_MAX}`,
      });
    }
  }

  return { ok: issues.length === 0, issues, data };
}
