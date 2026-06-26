import { describe, expect, it } from 'vitest';

import {
  countOpeningTags,
  decodeEntities,
  extractAlternates,
  extractAnchorHrefs,
  extractCanonical,
  extractImageUrls,
  extractJsonLdBlocks,
  extractMetaDescription,
  extractTitle,
  visibleText,
} from './html.js';

describe('decodeEntities', () => {
  it('decodes the common entities', () => {
    expect(decodeEntities('Caf&eacute; &amp; Bar')).toBe('Caf&eacute; & Bar'); // only common ones
    expect(decodeEntities('a &lt; b &gt; c &quot;d&quot; &#39;e&#39;')).toBe('a < b > c "d" \'e\'');
    expect(decodeEntities('x&nbsp;y')).toBe('x y');
  });
});

describe('countOpeningTags', () => {
  it('counts h1 occurrences, attributes or not', () => {
    expect(countOpeningTags('<h1>A</h1>', 'h1')).toBe(1);
    expect(countOpeningTags('<h1 class="x">A</h1><h1>B</h1>', 'h1')).toBe(2);
    expect(countOpeningTags('<header><p>no h1</p></header>', 'h1')).toBe(0);
    // must not match <h1abc> style false tags
    expect(countOpeningTags('<h10>x</h10>', 'h1')).toBe(0);
  });
});

describe('extractTitle / meta / canonical', () => {
  const html = `<head>
    <title>  Le Meurice — Palace Paris  </title>
    <meta name="description" content="Un palace parisien place de la Concorde.">
    <link rel="canonical" href="https://myconciergehotel.com/hotel/le-meurice"/>
  </head>`;
  it('extracts and trims title', () => {
    expect(extractTitle(html)).toBe('Le Meurice — Palace Paris');
  });
  it('returns null on empty title', () => {
    expect(extractTitle('<title>   </title>')).toBeNull();
    expect(extractTitle('<head></head>')).toBeNull();
  });
  it('extracts meta description', () => {
    expect(extractMetaDescription(html)).toBe('Un palace parisien place de la Concorde.');
    expect(extractMetaDescription('<head></head>')).toBeNull();
  });
  it('extracts canonical', () => {
    expect(extractCanonical(html)).toBe('https://myconciergehotel.com/hotel/le-meurice');
    expect(extractCanonical('<head></head>')).toBeNull();
  });
});

describe('extractAlternates', () => {
  it('collects hreflang/href pairs', () => {
    const html = `
      <link rel="alternate" hreflang="fr" href="https://h/x"/>
      <link rel="alternate" hreflang="en" href="https://h/en/x"/>
      <link rel="alternate" hreflang="x-default" href="https://h/x"/>`;
    const alt = extractAlternates(html);
    expect(alt).toHaveLength(3);
    expect(alt.map((a) => a.hreflang)).toContain('en');
  });
  it('returns empty when none', () => {
    expect(extractAlternates('<head></head>')).toHaveLength(0);
  });
});

describe('extractAnchorHrefs / extractImageUrls', () => {
  it('collects anchor hrefs', () => {
    const html = `<a href="/a">A</a><a class="b" href="https://x/y">Y</a>`;
    expect(extractAnchorHrefs(html)).toEqual(['/a', 'https://x/y']);
  });
  it('collects img src + first srcset candidate, skipping data URIs', () => {
    const html = `<img src="/i.jpg"><img srcset="/s-100.jpg 100w, /s-200.jpg 200w"><img src="data:abc">`;
    const imgs = extractImageUrls(html);
    expect(imgs).toContain('/i.jpg');
    expect(imgs).toContain('/s-100.jpg');
    expect(imgs).not.toContain('data:abc');
  });
});

describe('extractJsonLdBlocks', () => {
  it('extracts each ld+json block body', () => {
    const html = `<script type="application/ld+json">{"@type":"Hotel"}</script>
      <script type="application/ld+json">[{"@type":"FAQPage"}]</script>
      <script>var x=1;</script>`;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('Hotel');
  });
});

describe('visibleText', () => {
  it('strips scripts/styles/tags and collapses whitespace', () => {
    const html = `<html><head><style>.a{}</style>
      <script type="application/ld+json">{"sameAs":"https://www.wikidata.org/wiki/Q123456"}</script>
      </head><body><h1>Le  Meurice</h1><p>Place de la Concorde.</p></body></html>`;
    const text = visibleText(html);
    expect(text).toBe('Le Meurice Place de la Concorde.');
    // the wikidata URL inside JSON-LD must NOT bleed into visible text
    expect(text).not.toContain('wikidata');
    expect(text).not.toContain('Q123456');
  });
});
