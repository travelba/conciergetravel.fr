import { describe, expect, it } from 'vitest';

import {
  groundKeywords,
  renderGroundingForPrompt,
  type KeywordGrounding,
} from './keyword-grounding.js';

const FR = { locationName: 'France', languageCode: 'fr' } as const;

describe('groundKeywords degrade path', () => {
  it('returns empty ungrounded result when cfg is null (DFS off)', async () => {
    const g = await groundKeywords(null, ['hôtel Gordes'], FR);
    expect(g.grounded).toBe(false);
    expect(g.peopleAlsoAsk).toEqual([]);
    expect(g.topKeywords).toEqual([]);
    expect(g.seeds).toEqual(['hôtel Gordes']);
  });

  it('returns ungrounded result when there are no seeds', async () => {
    const g = await groundKeywords(
      { baseUrl: 'https://x', username: 'u', password: 'p' },
      ['  ', ''],
      FR,
    );
    expect(g.grounded).toBe(false);
    expect(g.seeds).toEqual([]);
  });
});

describe('renderGroundingForPrompt', () => {
  it('renders nothing for ungrounded input', () => {
    const g: KeywordGrounding = {
      seeds: ['x'],
      locale: FR,
      peopleAlsoAsk: ['Q?'],
      relatedSearches: [],
      topKeywords: [],
      intents: [],
      fetchedAt: new Date().toISOString(),
      grounded: false,
    };
    expect(renderGroundingForPrompt(g)).toBe('');
  });

  it('renders PAA + keywords + related when grounded', () => {
    const g: KeywordGrounding = {
      seeds: ['hôtel gordes'],
      locale: FR,
      peopleAlsoAsk: ['Où dormir à Gordes ?', 'Où dormir à Gordes ?'],
      relatedSearches: ['gordes que faire'],
      topKeywords: [
        { keyword: 'hotel gordes luxe', searchVolume: 320 },
        { keyword: 'airelles gordes', searchVolume: null },
      ],
      intents: [],
      fetchedAt: new Date().toISOString(),
      grounded: true,
    };
    const block = renderGroundingForPrompt(g);
    expect(block).toContain('People Also Ask');
    expect(block).toContain('Où dormir à Gordes ?');
    expect(block).toContain('hotel gordes luxe (320/mo)');
    expect(block).toContain('airelles gordes');
    expect(block).toContain('gordes que faire');
  });
});
