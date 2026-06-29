import type { SpeakableSpecification } from 'schema-dts';

export type SpeakableSpecificationNode = Exclude<SpeakableSpecification, string>;

/**
 * SpeakableSpecification JSON-LD (skill: structured-data-schema-org,
 * geo-llm-optimization).
 *
 * Marks the sections of a page that are "speakable" — the dense, factual
 * blocks (H1, factual summary, top-3 verdict, FAQ answers) that voice
 * assistants and AI Overviews read aloud / quote. Attached to a page-level
 * `CreativeWork` (e.g. `Article`) via its `speakable` property.
 *
 * Pass CSS selectors that resolve to elements actually present in the
 * rendered DOM (Google validates that the selector matches visible text).
 * Returns `null` when no usable selector is provided so callers can omit
 * the property rather than emit an empty, invalid node.
 */
export const speakableSpecificationJsonLd = (
  cssSelectors: ReadonlyArray<string>,
): SpeakableSpecificationNode | null => {
  const selectors = cssSelectors.map((s) => s.trim()).filter((s) => s.length > 0);
  if (selectors.length === 0) return null;
  return {
    '@type': 'SpeakableSpecification',
    cssSelector: selectors,
  };
};
