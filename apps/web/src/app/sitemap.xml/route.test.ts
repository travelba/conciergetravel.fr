import { describe, expect, it, vi } from 'vitest';

const { resolveSitemapLastmodsMock } = vi.hoisted(() => ({
  resolveSitemapLastmodsMock: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://myconciergehotel.com' },
}));

vi.mock('@/server/sitemap/sitemap-lastmods', () => ({
  resolveSitemapLastmods: resolveSitemapLastmodsMock,
}));

import { GET } from './route';

const LASTMODS = {
  hotels: '2026-07-01T00:00:00.000Z',
  rooms: '2026-07-01T00:00:00.000Z',
  hubs: '2026-07-01T00:00:00.000Z',
  guides: '2026-07-01T00:00:00.000Z',
  rankings: '2026-07-01T00:00:00.000Z',
  itineraries: '2026-07-01T00:00:00.000Z',
  places: '2026-07-01T00:00:00.000Z',
};

describe('GET /sitemap.xml (D3 crawl-focus index)', () => {
  it('lists the head sub-sitemaps', async () => {
    resolveSitemapLastmodsMock.mockResolvedValue(LASTMODS);
    const res = await GET();
    const xml = await res.text();
    for (const name of ['hotels', 'hubs', 'guides', 'rankings', 'itineraries']) {
      expect(xml).toContain(`https://myconciergehotel.com/sitemaps/${name}.xml`);
    }
  });

  it('DELISTS rooms.xml and places.xml (D3, 2026-07-02) — no <loc> for them', async () => {
    resolveSitemapLastmodsMock.mockResolvedValue(LASTMODS);
    const res = await GET();
    const xml = await res.text();
    // The routes stay served, but must not appear as an index <loc>.
    expect(xml).not.toContain('<loc>https://myconciergehotel.com/sitemaps/rooms.xml</loc>');
    expect(xml).not.toContain('<loc>https://myconciergehotel.com/sitemaps/places.xml</loc>');
  });

  it('emits exactly 5 sub-sitemaps', async () => {
    resolveSitemapLastmodsMock.mockResolvedValue(LASTMODS);
    const res = await GET();
    const xml = await res.text();
    const count = (xml.match(/<loc>/g) ?? []).length;
    expect(count).toBe(5);
  });
});
