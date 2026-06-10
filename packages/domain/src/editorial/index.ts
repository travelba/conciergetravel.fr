/**
 * Editorial bounded context — public surface.
 * Slug, hreflang, canonical, AEO validators implemented in Phase 5/9.
 */
export type EditorialPageType =
  | 'classement'
  | 'thematique'
  | 'region'
  | 'guide'
  | 'comparatif'
  | 'saisonnier';

export type PublishStatus = 'draft' | 'published';

export const AEO_MIN_WORDS = 40;
export const AEO_MAX_WORDS = 60;

export const wordCount = (text: string): number =>
  text
    .trim()
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;

export const isAeoBlockValid = (text: string): boolean => {
  const n = wordCount(text);
  return n >= AEO_MIN_WORDS && n <= AEO_MAX_WORDS;
};

export * from './golden-template';
export * from './kit-golden-types';
export * from './kit-golden-loader';
export * from './airelles-golden';
export * from './prince-de-galles-gallery';
export * from './prince-de-galles-golden';
export * from './prince-de-galles-concierge-questions';
export * from './shangri-la-paris-gallery';
export * from './shangri-la-paris-golden';
export * from './shangri-la-paris-concierge-questions';
export * from './prince-de-galles-amenities';
export * from './prince-de-galles-kit-blocks';
export * from './prince-de-galles-rooms';
export * from './les-pres-deugenie-gallery';
export * from './les-pres-deugenie-golden';
export * from './les-pres-deugenie-concierge-questions';
export * from './les-pres-deugenie-amenities';
export * from './le-bristol-paris-gallery';
export * from './le-bristol-paris-golden';
export * from './le-bristol-paris-concierge-questions';
export * from './le-bristol-paris-amenities';
export * from './les-airelles-courchevel-amenities';
export * from './les-airelles-courchevel-concierge-questions';
export * from './les-airelles-courchevel-gallery';
export * from './les-airelles-courchevel-golden';
export * from './cheval-blanc-paris-gallery';
export * from './cheval-blanc-paris-golden';
export * from './cheval-blanc-paris-concierge-questions';
export * from './cheval-blanc-paris-amenities';
export * from './les-pres-deugenie-faq.generated';
