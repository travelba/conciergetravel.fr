import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DESTINATION_MIN_PUBLISHED_HOTELS,
  isDestinationIndexable,
  isHotelIndexable,
} from './indexability';

const longDesc = 'x'.repeat(800);
const okFactual = 'x'.repeat(150);
const okFaq = Array.from({ length: 12 }, (_, i) => ({ question: `q${i}`, answer: 'a' }));
const okConcierge = { fr: { body: 'mon conseil...' }, en: { body: 'my tip...' } };

describe('isHotelIndexable', () => {
  it('photo-rich path: hero + 5+ gallery photos passes', () => {
    expect(
      isHotelIndexable({
        hero_image: 'mch/hotel/foo/hero.jpg',
        gallery_images: ['a', 'b', 'c', 'd', 'e'],
      }),
    ).toBe(true);
  });

  it('photo-rich path: hero + at least one long_description_section passes', () => {
    expect(
      isHotelIndexable({
        hero_image: 'mch/hotel/foo/hero.jpg',
        gallery_images: [],
        long_description_sections: [{ heading: 'h', body: 'b' }],
      }),
    ).toBe(true);
  });

  it('editorial path: section without hero passes (Phase 1)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [{ heading: 'h', body: 'b' }],
      }),
    ).toBe(true);
  });

  it('editorial path: full publish-gate set without photos passes', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: okFaq,
      }),
    ).toBe(true);
  });

  it('rejects: missing concierge_advice even with description + factual + faq', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: null,
        faq_content: okFaq,
      }),
    ).toBe(false);
  });

  it('rejects: short description (< 600 chars)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: 'x'.repeat(500),
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: okFaq,
      }),
    ).toBe(false);
  });

  it('rejects: FAQ < 10 items even with full text', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: longDesc,
        factual_summary_fr: okFactual,
        concierge_advice: okConcierge,
        faq_content: Array.from({ length: 8 }, (_, i) => ({ question: `q${i}`, answer: 'a' })),
      }),
    ).toBe(false);
  });

  it('rejects: empty stub (no photos, no editorial content)', () => {
    expect(
      isHotelIndexable({
        hero_image: null,
        gallery_images: [],
        long_description_sections: [],
        description_fr: '',
        factual_summary_fr: '',
        concierge_advice: null,
        faq_content: [],
      }),
    ).toBe(false);
  });
});

describe('isDestinationIndexable (D3 crawl-focus threshold)', () => {
  it('threshold constant is 3 (PO decision 2026-07-02)', () => {
    expect(DESTINATION_MIN_PUBLISHED_HOTELS).toBe(3);
  });

  it('rejects a 0-hotel destination', () => {
    expect(isDestinationIndexable(0)).toBe(false);
  });

  it('rejects a 1-hotel destination (Dommeldange / Belgrade / Clervaux)', () => {
    expect(isDestinationIndexable(1)).toBe(false);
  });

  it('rejects a 2-hotel destination (below threshold)', () => {
    expect(isDestinationIndexable(2)).toBe(false);
  });

  it('accepts exactly at the threshold (3 hotels)', () => {
    expect(isDestinationIndexable(DESTINATION_MIN_PUBLISHED_HOTELS)).toBe(true);
  });

  it('accepts a head destination (many hotels)', () => {
    expect(isDestinationIndexable(42)).toBe(true);
  });
});

/**
 * WS-B item 5.5 — non-divergence guard between the TS predicate
 * (`isHotelIndexable`, the source of truth) and the Postgres RPC
 * `list_indexable_hotel_slugs` (migration 0078) that feeds
 * `/sitemaps/hotels.xml`. A drift would let the sitemap advertise a URL
 * the page marks `noindex` (or vice-versa) and tank crawl budget — the
 * exact failure the migration header warns about.
 *
 * We can't execute Postgres here, so we assert the four indexability
 * thresholds baked into `isHotelIndexable` also appear in the SQL body,
 * next to a `>=` comparison. If someone bumps a threshold in the TS
 * without mirroring it in the migration (or ships a new migration that
 * silently changes the RPC), this test fails.
 */
describe('indexability TS ↔ RPC 0078 non-divergence', () => {
  const tsSource = readFileSync(
    fileURLToPath(new URL('./indexability.ts', import.meta.url)),
    'utf8',
  );
  const rpcSql = readFileSync(
    fileURLToPath(
      new URL(
        '../../../../../packages/db/migrations/0078_list_indexable_hotel_slugs_rpc.sql',
        import.meta.url,
      ),
    ),
    'utf8',
  );

  it('the migration 0078 SQL file is present', () => {
    expect(rpcSql).toContain('create or replace function public.list_indexable_hotel_slugs');
  });

  /**
   * Extract the numeric value of a `const NAME = <int>;` declaration from
   * the TS source so the test tracks the real thresholds instead of
   * hard-coding a copy (which would itself drift).
   */
  function tsConst(name: string): number {
    const m = new RegExp(`const ${name} = (\\d+);`).exec(tsSource);
    const captured = m?.[1];
    expect(captured, `expected \`const ${name}\` in indexability.ts`).toBeDefined();
    return Number(captured);
  }

  it('description min-chars threshold matches (TS 600 → SQL length(description_fr) >= 600)', () => {
    const n = tsConst('DESCRIPTION_MIN_CHARS');
    expect(n).toBe(600);
    expect(rpcSql).toMatch(new RegExp(`length\\(h\\.description_fr\\),\\s*0\\)\\s*>=\\s*${n}`));
  });

  it('factual-summary min-chars threshold matches (TS 100 → SQL factual_summary_fr >= 100)', () => {
    const n = tsConst('FACTUAL_SUMMARY_MIN_CHARS');
    expect(n).toBe(100);
    expect(rpcSql).toMatch(new RegExp(`length\\(h\\.factual_summary_fr\\),\\s*0\\)\\s*>=\\s*${n}`));
  });

  it('FAQ min-items threshold matches (TS 10 → SQL faq_content length >= 10)', () => {
    const n = tsConst('FAQ_MIN_ITEMS');
    expect(n).toBe(10);
    expect(rpcSql).toMatch(
      new RegExp(`jsonb_array_length\\(h\\.faq_content\\)[\\s\\S]*?>=\\s*${n}`),
    );
  });

  it('photo-rich gallery threshold matches (TS 5 → SQL gallery_images length >= 5)', () => {
    const n = tsConst('PHOTO_RICH_GALLERY_THRESHOLD');
    expect(n).toBe(5);
    expect(rpcSql).toMatch(
      new RegExp(`jsonb_array_length\\(h\\.gallery_images\\)[\\s\\S]*?>=\\s*${n}`),
    );
  });

  it('both paths require concierge_advice as a JSON object in the full editorial gate', () => {
    // The TS gate uses `typeof concierge_advice === 'object'`; the SQL
    // uses `jsonb_typeof(h.concierge_advice) = 'object'`. Presence check
    // keeps the two aligned on the concierge requirement.
    expect(tsSource).toContain("typeof row.concierge_advice === 'object'");
    expect(rpcSql).toContain("jsonb_typeof(h.concierge_advice) = 'object'");
  });
});

/**
 * D3 sitemap ↔ meta coherence guard (the #1 merge criterion — the D3
 * review was blocked on guides.xml missing this). Every surface that
 * emits or gates a `/destination/*` or `/hotels/*` (annuaire) URL must
 * consume the SAME `isDestinationIndexable` predicate; a surface that
 * drops the import silently re-advertises noindex URLs (or noindexes a
 * page the sitemap still lists). Source-level check, same spirit as the
 * RPC non-divergence guard above.
 */
describe('D3 predicate consumed by every destination/annuaire surface', () => {
  const surfaces = [
    // [surface, must call the predicate]
    '../../app/sitemaps/hubs.xml/route.ts',
    '../../app/sitemaps/guides.xml/route.ts',
    '../../app/[locale]/destination/[citySlug]/page.tsx',
    '../../app/[locale]/hotels/[pays]/page.tsx',
    '../../app/[locale]/hotels/[pays]/[ville]/page.tsx',
  ] as const;

  for (const rel of surfaces) {
    it(`${rel.replace(/^\.\.\/\.\.\//, '')} imports and calls isDestinationIndexable`, () => {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      expect(src).toContain("from '@/server/hotels/indexability'");
      expect(src).toMatch(/isDestinationIndexable\(/);
    });
  }

  it('hubs.xml gates the annuaire country AND city loops (not just destinations)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../app/sitemaps/hubs.xml/route.ts', import.meta.url)),
      'utf8',
    );
    expect(src).toMatch(/isDestinationIndexable\(country\.hotelCount\)/);
    expect(src).toMatch(/isDestinationIndexable\(path\.hotelCount\)/);
  });
});
