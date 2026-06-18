import { describe, expect, it } from 'vitest';

import {
  aggregateWave,
  agentConsumablePresent,
  collectLeakFields,
  evaluateWaveGates,
  geoQaPresent,
  type WaveGateResult,
  type WaveHotelRow,
} from './wave-gates.js';

/** Minimal WaveHotelRow with all base fields nulled; override per test. */
function row(overrides: Partial<WaveHotelRow> = {}): WaveHotelRow {
  return {
    slug: 'test-hotel',
    name: 'Test Hotel',
    is_published: true,
    luxury_tier: null,
    country_code: null,
    priority: null,
    description_fr: null,
    description_en: null,
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: null,
    meta_desc_en: null,
    factual_summary_fr: null,
    factual_summary_en: null,
    concierge_advice: null,
    faq_content: null,
    long_description_sections: null,
    highlights: null,
    amenities: null,
    points_of_interest: null,
    transports: null,
    restaurant_info: null,
    spa_info: null,
    policies: null,
    awards: null,
    affiliations: null,
    signature_experiences: null,
    number_of_rooms: null,
    opened_at: null,
    official_url: null,
    wikidata_id: null,
    hero_image: null,
    gallery_images: null,
    updated_at: null,
    ...overrides,
  };
}

describe('geoQaPresent', () => {
  it('is false for null / empty / non-array', () => {
    expect(geoQaPresent(row({ geo_qa: null }))).toBe(false);
    expect(geoQaPresent(row({ geo_qa: [] }))).toBe(false);
    expect(geoQaPresent(row({ geo_qa: { id: 'x' } }))).toBe(false);
  });

  it('is true for a non-empty array', () => {
    expect(
      geoQaPresent(row({ geo_qa: [{ id: 'q1', question_fr: 'Q', paragraphs_fr: ['A'] }] })),
    ).toBe(true);
  });
});

describe('collectLeakFields', () => {
  it('returns empty for clean prose', () => {
    expect(
      collectLeakFields(
        row({
          description_fr: 'Un palace au cœur de Paris, face aux Tuileries.',
          factual_summary_fr: 'Hôtel cinq étoiles avec spa et restaurant gastronomique.',
        }),
      ),
    ).toEqual([]);
  });

  it('flags backtick code-fence leak in description', () => {
    expect(
      collectLeakFields(row({ description_fr: 'Texte avec `AUTO_DRAFT` résiduel.' })),
    ).toContain('description_fr');
  });

  it('flags brief meta-commentary and wikidata leaks', () => {
    expect(
      collectLeakFields(row({ factual_summary_en: 'pending review, wikidata Q650971' })),
    ).toContain('factual_summary_en');
  });

  it('flags leaks inside concierge_advice and sections', () => {
    const fields = collectLeakFields(
      row({
        concierge_advice: { fr: { body: 'reste à vérifier auprès des sources' } },
        long_description_sections: [{ body_fr: 'note interne: à revalider' }],
      }),
    );
    expect(fields).toContain('concierge_advice.fr.body');
    expect(fields).toContain('long_description_sections[0].body_fr');
  });
});

describe('agentConsumablePresent', () => {
  it('is false when the concierge tip or POIs are missing', () => {
    expect(agentConsumablePresent(row())).toBe(false);
    expect(
      agentConsumablePresent(row({ concierge_advice: { fr: { body: 'Demandez la 412.' } } })),
    ).toBe(false);
    expect(
      agentConsumablePresent(row({ points_of_interest: [{ name_fr: 'Musée du Louvre' }] })),
    ).toBe(false);
  });

  it('is true when both the tip and at least one POI are present', () => {
    expect(
      agentConsumablePresent(
        row({
          concierge_advice: { fr: { body: 'Demandez la chambre 412 au coucher du soleil.' } },
          points_of_interest: [{ name_fr: 'Musée du Louvre', distance_fr: '300 m' }],
        }),
      ),
    ).toBe(true);
  });
});

describe('evaluateWaveGates — new gate wiring', () => {
  it('agent_consumable is a warn that lists present surfaces', () => {
    const res = evaluateWaveGates(
      row({
        concierge_advice: { fr: { body: 'Réservez la table du chef en terrasse.' } },
        points_of_interest: [{ name_fr: 'Jardin des Tuileries' }],
        restaurant_info: { name: 'Le Dali' },
      }),
    );
    const check = res.checks.find((c) => c.id === 'gate1.agent_consumable');
    expect(check?.severity).toBe('warn');
    expect(check?.passed).toBe(true);
    expect(check?.detail).toContain('tip');
    expect(check?.detail).toContain('poi');
    expect(check?.detail).toContain('dining');
  });

  it('geo_qa missing is a blocker in strict mode, warn in lenient mode', () => {
    const strict = evaluateWaveGates(row({ geo_qa: null }), { strictGeoQa: true });
    const lenient = evaluateWaveGates(row({ geo_qa: null }), { strictGeoQa: false });
    const strictCheck = strict.checks.find((c) => c.id === 'gate1.geo_qa_present');
    const lenientCheck = lenient.checks.find((c) => c.id === 'gate1.geo_qa_present');
    expect(strictCheck?.severity).toBe('blocker');
    expect(strictCheck?.passed).toBe(false);
    expect(lenientCheck?.severity).toBe('warn');
  });

  it('a scaffolding leak fails the no_leak blocker and overall passed', () => {
    const res = evaluateWaveGates(row({ description_fr: 'leftover `brief` token' }));
    const leak = res.checks.find((c) => c.id === 'gate1.no_leak');
    expect(leak?.passed).toBe(false);
    expect(res.passed).toBe(false);
    expect(res.leakFields).toContain('description_fr');
  });
});

describe('aggregateWave', () => {
  it('rolls up pass rate and fail-by-check', () => {
    const results: WaveGateResult[] = [
      {
        slug: 'a',
        name: 'A',
        is_published: true,
        passed: true,
        score_t3: 96,
        checks: [{ id: 'gate1.no_leak', passed: true, severity: 'blocker', detail: 'ok' }],
        leakFields: [],
      },
      {
        slug: 'b',
        name: 'B',
        is_published: true,
        passed: false,
        score_t3: 40,
        checks: [
          { id: 'gate1.no_leak', passed: false, severity: 'blocker', detail: 'leak' },
          { id: 'gate1.geo_qa_present', passed: false, severity: 'blocker', detail: 'missing' },
        ],
        leakFields: ['description_fr'],
      },
    ];
    const agg = aggregateWave(results);
    expect(agg.total).toBe(2);
    expect(agg.passed).toBe(1);
    expect(agg.failed).toBe(1);
    expect(agg.passRate).toBe(0.5);
    expect(agg.failByCheck['gate1.no_leak']).toBe(1);
    expect(agg.failByCheck['gate1.geo_qa_present']).toBe(1);
  });
});
