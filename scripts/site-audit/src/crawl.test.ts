import { describe, expect, it } from 'vitest';

import { resolveImages, resolveInternalLinks } from './crawl.js';

const BASE = 'https://myconciergehotel.com';
const PAGE = 'https://myconciergehotel.com/hotel/le-meurice';

describe('resolveInternalLinks', () => {
  it('resolves relative hrefs to absolute against the page URL', () => {
    const html = '<a href="/marque/aman">Aman</a><a href="/en/destination/paris">Paris</a>';
    expect(resolveInternalLinks(html, PAGE, BASE)).toEqual([
      'https://myconciergehotel.com/marque/aman',
      'https://myconciergehotel.com/en/destination/paris',
    ]);
  });

  it('keeps absolute same-host links, drops external hosts', () => {
    const html =
      '<a href="https://myconciergehotel.com/classements">x</a>' +
      '<a href="https://www.google.com/maps">ext</a>' +
      '<a href="https://res.cloudinary.com/x.jpg">cdn</a>';
    expect(resolveInternalLinks(html, PAGE, BASE)).toEqual([
      'https://myconciergehotel.com/classements',
    ]);
  });

  it('strips #fragments and ignores mailto/tel/javascript/data + bare anchors', () => {
    const html =
      '<a href="/a#section">a</a>' +
      '<a href="#top">top</a>' +
      '<a href="mailto:x@y.com">mail</a>' +
      '<a href="tel:+33100000000">tel</a>' +
      '<a href="javascript:void(0)">js</a>';
    expect(resolveInternalLinks(html, PAGE, BASE)).toEqual(['https://myconciergehotel.com/a']);
  });

  it('decodes &amp; in hrefs (the _next/image 400 false-positive guard)', () => {
    const html = '<a href="/_next/image?url=%2Fa.jpg&amp;w=1920&amp;q=75">img</a>';
    expect(resolveInternalLinks(html, PAGE, BASE)).toEqual([
      'https://myconciergehotel.com/_next/image?url=%2Fa.jpg&w=1920&q=75',
    ]);
  });

  it('de-duplicates repeated links', () => {
    const html = '<a href="/x">1</a><a href="/x">2</a><a href="/x#a">3</a>';
    expect(resolveInternalLinks(html, PAGE, BASE)).toEqual(['https://myconciergehotel.com/x']);
  });
});

describe('resolveImages', () => {
  it('resolves src + first srcset candidate to absolute, decoding &amp;', () => {
    const html =
      '<img src="/_next/image?url=%2Fhero.jpg&amp;w=640&amp;q=75">' +
      '<img srcset="/s-320.jpg 320w, /s-640.jpg 640w">';
    expect(resolveImages(html, PAGE)).toEqual([
      'https://myconciergehotel.com/_next/image?url=%2Fhero.jpg&w=640&q=75',
      'https://myconciergehotel.com/s-320.jpg',
    ]);
  });

  it('skips data: URIs and malformed srcs', () => {
    const html = '<img src="data:image/png;base64,AAAA"><img src="/ok.jpg">';
    expect(resolveImages(html, PAGE)).toEqual(['https://myconciergehotel.com/ok.jpg']);
  });
});
