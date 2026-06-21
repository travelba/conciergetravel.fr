import { describe, expect, it } from 'vitest';

import { gateFailures, PLACE_GATE_COLUMNS, type PlaceGateRow } from './publish-places';

/**
 * Builds a row that clears every gate, then lets each test relax one
 * field at a time. The thresholds the gate enforces (mirrored from
 * `gateFailures`):
 *   - factual_summary_fr : raw length in [100, 200]
 *   - factual_summary_en : trimmed length >= 80
 *   - description_fr     : raw length >= 250
 *   - description_en     : trimmed length >= 200
 *   - faq                : array length >= 5
 *   - concierge_advice   : non-null AND fr.body & en.body trimmed >= 40
 */
function passingRow(overrides: Partial<PlaceGateRow> = {}): PlaceGateRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'musee-du-louvre',
    name: 'Musée du Louvre',
    is_published: false,
    factual_summary_fr: 'f'.repeat(120),
    factual_summary_en: 'e'.repeat(90),
    description_fr: 'd'.repeat(300),
    description_en: 'g'.repeat(250),
    concierge_advice: {
      fr: { body: 'c'.repeat(40) },
      en: { body: 'c'.repeat(40) },
    },
    faq: Array.from({ length: 5 }, (_, i) => ({ q: `q${String(i)}`, a: `a${String(i)}` })),
    ...overrides,
  };
}

describe('PLACE_GATE_COLUMNS', () => {
  it('projects exactly the columns the gate reads', () => {
    const cols = PLACE_GATE_COLUMNS.split(',');
    expect(cols).toContain('factual_summary_fr');
    expect(cols).toContain('factual_summary_en');
    expect(cols).toContain('description_fr');
    expect(cols).toContain('description_en');
    expect(cols).toContain('concierge_advice');
    expect(cols).toContain('faq');
    expect(cols).toContain('is_published');
  });
});

describe('gateFailures — happy path', () => {
  it('returns no failures for a fully-enriched row', () => {
    expect(gateFailures(passingRow())).toEqual([]);
  });

  it('passes at the exact lower boundaries (inclusive)', () => {
    const row = passingRow({
      factual_summary_fr: 'f'.repeat(100),
      factual_summary_en: 'e'.repeat(80),
      description_fr: 'd'.repeat(250),
      description_en: 'g'.repeat(200),
      faq: Array.from({ length: 5 }, () => ({})),
      concierge_advice: { fr: { body: 'c'.repeat(40) }, en: { body: 'c'.repeat(40) } },
    });
    expect(gateFailures(row)).toEqual([]);
  });

  it('passes at the exact factual_summary_fr upper boundary (200)', () => {
    expect(gateFailures(passingRow({ factual_summary_fr: 'f'.repeat(200) }))).toEqual([]);
  });
});

describe('gateFailures — factual_summary_fr bounds', () => {
  it('fails when too short (< 100)', () => {
    const failures = gateFailures(passingRow({ factual_summary_fr: 'f'.repeat(99) }));
    expect(failures).toContain('summary_fr 99c');
  });

  it('fails when too long (> 200)', () => {
    const failures = gateFailures(passingRow({ factual_summary_fr: 'f'.repeat(201) }));
    expect(failures).toContain('summary_fr 201c');
  });

  it('reports length 0 when null', () => {
    const failures = gateFailures(passingRow({ factual_summary_fr: null }));
    expect(failures).toContain('summary_fr 0c');
  });
});

describe('gateFailures — per-rule failures', () => {
  it('fails on a short English summary (trimmed < 80)', () => {
    const failures = gateFailures(passingRow({ factual_summary_en: `${' '.repeat(10)}short` }));
    expect(failures.some((f) => f.startsWith('summary_en'))).toBe(true);
  });

  it('fails on a thin French description (< 250)', () => {
    expect(gateFailures(passingRow({ description_fr: 'd'.repeat(249) }))).toContain(
      'description_fr thin',
    );
  });

  it('fails on a thin English description (trimmed < 200)', () => {
    expect(gateFailures(passingRow({ description_en: 'g'.repeat(199) }))).toContain(
      'description_en thin',
    );
  });

  it('fails when FAQ has fewer than 5 entries', () => {
    const failures = gateFailures(
      passingRow({ faq: [{ q: 'a' }, { q: 'b' }, { q: 'c' }, { q: 'd' }] }),
    );
    expect(failures).toContain('faq 4');
  });

  it('treats a non-array / null FAQ as length 0', () => {
    expect(gateFailures(passingRow({ faq: null }))).toContain('faq 0');
  });

  it('fails when concierge_advice is null', () => {
    expect(gateFailures(passingRow({ concierge_advice: null }))).toContain(
      'concierge_advice missing',
    );
  });

  it('fails when the FR concierge body is too short (< 40)', () => {
    const failures = gateFailures(
      passingRow({
        concierge_advice: { fr: { body: 'too short' }, en: { body: 'c'.repeat(40) } },
      }),
    );
    expect(failures).toContain('concierge_advice missing');
  });

  it('fails when the EN concierge body is missing', () => {
    const failures = gateFailures(
      passingRow({
        concierge_advice: { fr: { body: 'c'.repeat(40) }, en: null },
      }),
    );
    expect(failures).toContain('concierge_advice missing');
  });
});

describe('gateFailures — fully empty row', () => {
  it('accumulates every failure', () => {
    const empty: PlaceGateRow = {
      id: 'x',
      slug: 'x',
      name: 'x',
      is_published: false,
      factual_summary_fr: null,
      factual_summary_en: null,
      description_fr: null,
      description_en: null,
      concierge_advice: null,
      faq: null,
    };
    const failures = gateFailures(empty);
    expect(failures).toContain('summary_fr 0c');
    expect(failures.some((f) => f.startsWith('summary_en'))).toBe(true);
    expect(failures).toContain('description_fr thin');
    expect(failures).toContain('description_en thin');
    expect(failures).toContain('faq 0');
    expect(failures).toContain('concierge_advice missing');
  });
});
