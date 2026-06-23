import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { dataForSeoConfigFromSharedEnv, type DataForSeoClientConfig } from './client';
import {
  fetchRelatedKeywords,
  fetchSearchIntent,
  fetchSearchVolume,
  fetchSerpQuestions,
} from './keyword-research';

const BASE = 'https://dfs.test';
const cfg: DataForSeoClientConfig = {
  baseUrl: BASE,
  username: 'u@example.com',
  password: 'secret',
};
const FR = { locationName: 'France', languageCode: 'fr' } as const;

function envelope(result: unknown[], statusCode = 20000): unknown {
  return {
    status_code: statusCode,
    status_message: statusCode === 20000 ? 'Ok.' : 'Error.',
    cost: 0.01,
    tasks: [
      {
        id: 'task-1',
        status_code: statusCode,
        status_message: statusCode === 20000 ? 'Ok.' : 'Error.',
        result: statusCode === 20000 ? result : null,
      },
    ],
  };
}

const handlers = [
  http.post(`${BASE}/v3/dataforseo_labs/google/related_keywords/live`, () =>
    HttpResponse.json(
      envelope([
        {
          seed_keyword: 'hotel gordes',
          items: [
            {
              keyword_data: {
                keyword: 'hotel gordes luxe',
                keyword_info: { search_volume: 320, cpc: 1.2, competition: 0.4 },
              },
            },
            {
              keyword_data: {
                keyword: 'airelles gordes',
                keyword_info: { search_volume: 880, cpc: null, competition: 0.1 },
              },
            },
            { keyword_data: { keyword_info: { search_volume: 10 } } }, // no keyword → dropped
          ],
        },
      ]),
    ),
  ),
  http.post(`${BASE}/v3/keywords_data/google_ads/search_volume/live`, () =>
    HttpResponse.json(
      envelope([
        { keyword: 'hotel gordes', search_volume: 320, cpc: 1.2, competition: 0.4 },
        { keyword: 'airelles gordes', search_volume: 880 },
      ]),
    ),
  ),
  http.post(`${BASE}/v3/dataforseo_labs/google/search_intent/live`, () =>
    HttpResponse.json(
      envelope([
        {
          items: [
            { keyword: 'hotel gordes', keyword_intent: { label: 'commercial', probability: 0.85 } },
            { keyword: 'gordes que faire', keyword_intent: { label: 'informational' } },
          ],
        },
      ]),
    ),
  ),
  http.post(`${BASE}/v3/serp/google/organic/live/advanced`, () =>
    HttpResponse.json(
      envelope([
        {
          keyword: 'hotel gordes',
          items: [
            { type: 'organic', title: 'Les Airelles Gordes', rank_group: 1 },
            {
              type: 'people_also_ask',
              items: [
                {
                  type: 'people_also_ask_element',
                  title: 'Quel est le plus bel hôtel de Gordes ?',
                },
                { type: 'people_also_ask_element', title: 'Où dormir à Gordes ?' },
              ],
            },
            { type: 'related_searches', items: ['hotel gordes spa', 'airelles gordes prix'] },
          ],
        },
      ]),
    ),
  ),
  http.post(`${BASE}/v3/error/api`, () => HttpResponse.json(envelope([], 40400))),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchRelatedKeywords', () => {
  it('normalises labs items and drops entries without a keyword', async () => {
    const res = await fetchRelatedKeywords(cfg, 'hotel gordes', FR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(res.value[0]).toEqual({
      keyword: 'hotel gordes luxe',
      searchVolume: 320,
      cpc: 1.2,
      competition: 0.4,
    });
    expect(res.value[1]?.cpc).toBeNull();
  });
});

describe('fetchSearchVolume', () => {
  it('reads metrics directly from result[]', async () => {
    const res = await fetchSearchVolume(cfg, ['hotel gordes', 'airelles gordes'], FR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toHaveLength(2);
    expect(res.value[1]).toEqual({
      keyword: 'airelles gordes',
      searchVolume: 880,
      cpc: null,
      competition: null,
    });
  });
});

describe('fetchSearchIntent', () => {
  it('maps the primary intent label + probability', async () => {
    const res = await fetchSearchIntent(cfg, ['hotel gordes', 'gordes que faire'], 'fr');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value[0]).toEqual({
      keyword: 'hotel gordes',
      intent: 'commercial',
      probability: 0.85,
    });
    expect(res.value[1]?.probability).toBeNull();
  });
});

describe('fetchSerpQuestions', () => {
  it('extracts People-Also-Ask titles and related searches', async () => {
    const res = await fetchSerpQuestions(cfg, 'hotel gordes', FR);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.peopleAlsoAsk).toEqual([
      'Quel est le plus bel hôtel de Gordes ?',
      'Où dormir à Gordes ?',
    ]);
    expect(res.value.relatedSearches).toEqual(['hotel gordes spa', 'airelles gordes prix']);
  });
});

describe('error handling', () => {
  it('returns api_error on a non-20000 envelope status', async () => {
    server.use(
      http.post(`${BASE}/v3/dataforseo_labs/google/related_keywords/live`, () =>
        HttpResponse.json(envelope([], 40400)),
      ),
    );
    const res = await fetchRelatedKeywords(cfg, 'x', FR);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('api_error');
    if (res.error.kind !== 'api_error') return;
    expect(res.error.statusCode).toBe(40400);
  });
});

describe('dataForSeoConfigFromSharedEnv', () => {
  it('returns disabled when the flag is off', () => {
    const res = dataForSeoConfigFromSharedEnv({
      DATAFORSEO_ENABLED: false,
    } as unknown as Parameters<typeof dataForSeoConfigFromSharedEnv>[0]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('disabled');
  });

  it('returns disabled when credentials are missing', () => {
    const res = dataForSeoConfigFromSharedEnv({
      DATAFORSEO_ENABLED: true,
      DATAFORSEO_USERNAME: undefined,
      DATAFORSEO_PASSWORD: undefined,
    } as unknown as Parameters<typeof dataForSeoConfigFromSharedEnv>[0]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('disabled');
  });

  it('builds a config when enabled + credentialed', () => {
    const res = dataForSeoConfigFromSharedEnv({
      DATAFORSEO_ENABLED: true,
      DATAFORSEO_USERNAME: 'u@example.com',
      DATAFORSEO_PASSWORD: 'secret',
      DATAFORSEO_API_BASE: undefined,
    } as unknown as Parameters<typeof dataForSeoConfigFromSharedEnv>[0]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.baseUrl).toBe('https://api.dataforseo.com');
    expect(res.value.username).toBe('u@example.com');
  });
});
