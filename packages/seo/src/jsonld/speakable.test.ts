import { describe, expect, it } from 'vitest';

import { speakableSpecificationJsonLd } from './speakable';

describe('speakableSpecificationJsonLd', () => {
  it('builds a SpeakableSpecification from non-empty selectors (happy path)', () => {
    const node = speakableSpecificationJsonLd([
      '.rk-page-head h1',
      '[data-aeo="factual-summary"]',
      '#tldr',
    ]);
    expect(node).toEqual({
      '@type': 'SpeakableSpecification',
      cssSelector: ['.rk-page-head h1', '[data-aeo="factual-summary"]', '#tldr'],
    });
  });

  it('trims selectors and drops blank entries', () => {
    const node = speakableSpecificationJsonLd(['  #tldr  ', '', '   ', '#faq']);
    expect(node).not.toBeNull();
    expect(node?.cssSelector).toEqual(['#tldr', '#faq']);
  });

  it('returns null when no usable selector is provided (empty path)', () => {
    expect(speakableSpecificationJsonLd([])).toBeNull();
    expect(speakableSpecificationJsonLd(['', '   '])).toBeNull();
  });
});
