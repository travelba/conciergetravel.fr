import { describe, expect, it } from 'vitest';

import {
  parseBacklogCsv,
  parseCsvLine,
  rankRows,
  selectCohort,
  type BacklogRow,
} from './select-pilot-cohort.js';

const HEADER =
  '"slug","name","is_published","luxury_tier","country_code","status_cdc","score_global","score_cdc","score_cdc_phase1","score_seo","score_geo","score_faq","score_maille","score_photo","score_jsonld","score_agent","score_t3","indexable","guide_slug","room_total","room_indexable","cdc_gap_count","worst_block"';

function row(
  slug: string,
  tier: string,
  scoreCdc: number,
  scoreT3: number,
  published = true,
): string {
  return [
    `"${slug}"`,
    `"${slug} name"`,
    `"${published}"`,
    `"${tier}"`,
    '"FR"',
    '"gap"',
    '"48"',
    `"${scoreCdc}"`,
    '"50"',
    '"60"',
    '"60"',
    '"50"',
    '"40"',
    '"43"',
    '"50"',
    '"33"',
    `"${scoreT3}"`,
    '"true"',
    '""',
    '"0"',
    '"0"',
    '"40"',
    '"05:0%"',
  ].join(',');
}

describe('parseCsvLine', () => {
  it('splits simple comma-separated fields', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('honours quoted fields with embedded commas', () => {
    expect(parseCsvLine('"a,b","c"')).toEqual(['a,b', 'c']);
  });

  it('handles escaped double-quotes', () => {
    expect(parseCsvLine('"he said ""hi"""')).toEqual(['he said "hi"']);
  });
});

describe('parseBacklogCsv', () => {
  it('parses rows with the audit header schema', () => {
    const csv = [HEADER, row('le-bristol-paris', 'relais_chateaux', 51, 77)].join('\n');
    const rows = parseBacklogCsv(csv);
    expect(rows).toHaveLength(1);
    const r = rows[0] as BacklogRow;
    expect(r.slug).toBe('le-bristol-paris');
    expect(r.luxuryTier).toBe('relais_chateaux');
    expect(r.scoreCdc).toBe(51);
    expect(r.scoreT3).toBe(77);
    expect(r.isPublished).toBe(true);
  });

  it('returns empty array for header-only content', () => {
    expect(parseBacklogCsv(HEADER)).toEqual([]);
  });
});

describe('rankRows', () => {
  it('orders by score_cdc desc, then score_t3 desc', () => {
    const csv = [
      HEADER,
      row('low', '', 30, 90),
      row('high', '', 60, 40),
      row('mid-a', '', 45, 80),
      row('mid-b', '', 45, 50),
    ].join('\n');
    const ranked = rankRows(parseBacklogCsv(csv));
    expect(ranked.map((r) => r.slug)).toEqual(['high', 'mid-a', 'mid-b', 'low']);
  });
});

describe('selectCohort', () => {
  const csv = [
    HEADER,
    row('partial-1', 'self_5_star', 50, 78),
    row('partial-2', '', 48, 72),
    row('rc-top', 'relais_chateaux', 55, 60),
    row('w50-top', 'world_50_best', 52, 55),
    row('self-gap', 'self_5_star', 40, 40),
    row('untiered-gap', '', 38, 35),
    row('draft-row', 'relais_chateaux', 70, 80, false),
  ].join('\n');
  const rows = parseBacklogCsv(csv);

  it('includes the partial set (score_t3 >= minT3) in the pilot', () => {
    const sel = selectCohort(rows, {
      size: 10,
      minT3: 70,
      priorityTiers: ['relais_chateaux', 'world_50_best'],
      publishedOnly: true,
    });
    const slugs = sel.pilot.map((r) => r.slug);
    expect(slugs).toContain('partial-1');
    expect(slugs).toContain('partial-2');
    expect(slugs).toContain('rc-top');
    expect(slugs).toContain('w50-top');
  });

  it('drops drafts when publishedOnly', () => {
    const sel = selectCohort(rows, {
      size: 10,
      minT3: 70,
      priorityTiers: [],
      publishedOnly: true,
    });
    expect(sel.pilot.map((r) => r.slug)).not.toContain('draft-row');
    expect(sel.totalConsidered).toBe(6);
  });

  it('respects the size cap and keeps the highest-score rows first', () => {
    const sel = selectCohort(rows, {
      size: 2,
      minT3: 70,
      priorityTiers: ['relais_chateaux'],
      publishedOnly: true,
    });
    expect(sel.pilot).toHaveLength(2);
    // partial-1 (t3=78) and partial-2 (t3=72) are the partial set, ranked
    // by score_cdc; both qualify before the cap is hit.
    expect(sel.pilot.map((r) => r.slug)).toEqual(['partial-1', 'partial-2']);
  });

  it('groups the remaining rows into scale waves by tier, excluding the pilot', () => {
    const sel = selectCohort(rows, {
      size: 4,
      minT3: 70,
      priorityTiers: ['relais_chateaux', 'world_50_best'],
      publishedOnly: true,
    });
    const pilotSlugs = new Set(sel.pilot.map((r) => r.slug));
    for (const [, bucket] of sel.waves) {
      for (const r of bucket) {
        expect(pilotSlugs.has(r.slug)).toBe(false);
      }
    }
    // self-gap should land in the self_5_star wave; untiered-gap in untiered.
    const self = sel.waves.get('self_5_star') ?? [];
    expect(self.some((r) => r.slug === 'self-gap')).toBe(true);
    const untiered = sel.waves.get('untiered') ?? [];
    expect(untiered.some((r) => r.slug === 'untiered-gap')).toBe(true);
  });
});
