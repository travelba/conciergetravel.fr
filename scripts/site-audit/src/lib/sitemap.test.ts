import { describe, expect, it } from 'vitest';

import { extractLocs, sitemapGroupName } from './sitemap.js';

describe('extractLocs', () => {
  it('extracts loc values from a sitemap index', () => {
    const xml = `<?xml version="1.0"?>
      <sitemapindex>
        <sitemap><loc>https://h/sitemaps/hotels.xml</loc><lastmod>2026-01-01</lastmod></sitemap>
        <sitemap><loc> https://h/sitemaps/rankings.xml </loc></sitemap>
      </sitemapindex>`;
    expect(extractLocs(xml)).toEqual([
      'https://h/sitemaps/hotels.xml',
      'https://h/sitemaps/rankings.xml',
    ]);
  });

  it('extracts page URLs from a flat urlset and decodes &amp;', () => {
    const xml = `<urlset>
      <url><loc>https://h/hotel/a</loc></url>
      <url><loc>https://h/search?x=1&amp;y=2</loc></url>
    </urlset>`;
    expect(extractLocs(xml)).toEqual(['https://h/hotel/a', 'https://h/search?x=1&y=2']);
  });

  it('returns empty for a document with no locs', () => {
    expect(extractLocs('<urlset></urlset>')).toEqual([]);
  });
});

describe('sitemapGroupName', () => {
  it('derives the group name from the sub-sitemap URL', () => {
    expect(sitemapGroupName('https://h/sitemaps/hotels.xml')).toBe('hotels');
    expect(sitemapGroupName('https://h/sitemaps/rankings.xml')).toBe('rankings');
  });
});
