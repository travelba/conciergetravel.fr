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
export * from './airelles-golden';
export * from './prince-de-galles-gallery';
export * from './prince-de-galles-golden';
export * from './prince-de-galles-concierge-questions';
export * from './prince-de-galles-amenities';
export * from './prince-de-galles-kit-blocks';
export * from './prince-de-galles-rooms';
