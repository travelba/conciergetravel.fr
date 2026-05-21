import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildCmTitle, defaultCommonsConfig, fetchCategoryPhotos } from './client';

const TEST_API = 'https://example-commons.test/w/api.php';
const cfg = {
  ...defaultCommonsConfig('https://myconciergehotel.com'),
  apiBase: TEST_API,
};

const handlers = [
  http.get(TEST_API, ({ request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const list = url.searchParams.get('list');
    const prop = url.searchParams.get('prop');

    if (action === 'query' && list === 'categorymembers') {
      const cmtitle = url.searchParams.get('cmtitle') ?? '';
      // Empty category → return empty array (triggers category_not_found).
      if (cmtitle.includes('Empty')) {
        return HttpResponse.json({
          query: { categorymembers: [] },
        });
      }
      // Multi-page category — first call returns 2 + cmcontinue, second returns 1.
      if (cmtitle.includes('Multipage')) {
        const cmcontinue = url.searchParams.get('cmcontinue');
        if (cmcontinue === undefined || cmcontinue === null) {
          return HttpResponse.json({
            continue: { cmcontinue: 'page-2' },
            query: {
              categorymembers: [
                { pageid: 1, title: 'File:Photo1.jpg', ns: 6 },
                { pageid: 2, title: 'File:Photo2.jpg', ns: 6 },
              ],
            },
          });
        }
        return HttpResponse.json({
          query: {
            categorymembers: [{ pageid: 3, title: 'File:Photo3.jpg', ns: 6 }],
          },
        });
      }
      // Default (single page, mixed mime — includes one audio file we must drop).
      return HttpResponse.json({
        query: {
          categorymembers: [
            { pageid: 100, title: 'File:Bristol-Facade.jpg', ns: 6 },
            { pageid: 101, title: 'File:Bristol-Suite.png', ns: 6 },
            { pageid: 102, title: 'File:Bristol-Theme.ogg', ns: 6 },
            { pageid: 103, title: 'File:Bristol-Plan.svg', ns: 6 },
          ],
        },
      });
    }

    if (action === 'query' && prop === 'imageinfo') {
      const titles = (url.searchParams.get('titles') ?? '').split('|');
      const pages = titles.map((title) => {
        if (title.endsWith('.ogg')) {
          return {
            pageid: 102,
            title,
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/audio.ogg',
                mime: 'audio/ogg',
                size: 1234,
                extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
              },
            ],
          };
        }
        if (title.endsWith('.svg')) {
          return {
            pageid: 103,
            title,
            imageinfo: [
              {
                url: 'https://upload.wikimedia.org/plan.svg',
                thumburl: 'https://upload.wikimedia.org/thumb-plan.png',
                thumbwidth: 1600,
                thumbheight: 900,
                mime: 'image/svg+xml',
                extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
              },
            ],
          };
        }
        const isPng = title.endsWith('.png');
        return {
          pageid: title === 'File:Bristol-Facade.jpg' ? 100 : 101,
          title,
          imageinfo: [
            {
              url: `https://upload.wikimedia.org/${title.slice(5)}`,
              thumburl: `https://upload.wikimedia.org/thumb/${title.slice(5)}`,
              thumbwidth: 1600,
              thumbheight: 1067,
              width: 4000,
              height: 2667,
              mime: isPng ? 'image/png' : 'image/jpeg',
              size: 567890,
              extmetadata: {
                LicenseShortName: { value: 'CC BY-SA 4.0' },
                LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                Artist: { value: 'Some Photographer' },
                ImageDescription: { value: 'Le Bristol Paris - facade view' },
              },
            },
          ],
        };
      });
      return HttpResponse.json({ query: { pages } });
    }

    return HttpResponse.json({}, { status: 400 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('buildCmTitle', () => {
  it('strips existing Category: prefix and underscores spaces', () => {
    expect(buildCmTitle('Le Bristol Paris')).toBe('Category:Le_Bristol_Paris');
    expect(buildCmTitle('Category:Le Bristol Paris')).toBe('Category:Le_Bristol_Paris');
    expect(buildCmTitle('category:Hotels in Paris')).toBe('Category:Hotels_in_Paris');
  });
});

describe('fetchCategoryPhotos', () => {
  it('returns normalised photos for a populated category, filtering non-image MIMEs', async () => {
    const res = await fetchCategoryPhotos(cfg, 'Le Bristol Paris', 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 4 raw entries → 2 valid (jpg + png). audio/ogg + svg are dropped.
    expect(res.value).toHaveLength(2);
    expect(res.value[0]?.mime).toBe('image/jpeg');
    expect(res.value[0]?.license).toBe('CC BY-SA 4.0');
    expect(res.value[0]?.attribution).toBe('Some Photographer');
    expect(res.value[0]?.downloadUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\//u);
  });

  it('follows the cmcontinue cursor across multiple pages', async () => {
    const res = await fetchCategoryPhotos(cfg, 'Multipage', 10);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 3 jpg files across 2 category pages — all should be normalised.
    expect(res.value).toHaveLength(3);
  });

  it('caps the result at maxN', async () => {
    const res = await fetchCategoryPhotos(cfg, 'Multipage', 2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
  });

  it('returns category_not_found when Commons returns an empty list', async () => {
    const res = await fetchCategoryPhotos(cfg, 'Empty', 10);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('category_not_found');
  });

  it('rejects an empty category name without hitting the network', async () => {
    const res = await fetchCategoryPhotos(cfg, '  ', 10);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('category_not_found');
  });

  it('returns [] when maxN <= 0', async () => {
    const res = await fetchCategoryPhotos(cfg, 'Le Bristol Paris', 0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toEqual([]);
  });
});
