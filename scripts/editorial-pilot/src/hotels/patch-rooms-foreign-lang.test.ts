import { describe, expect, it } from 'vitest';

import { buildRoomPlan, hasForeignMarker, translateRoomText } from './patch-rooms-foreign-lang';

describe('hasForeignMarker', () => {
  it('flags Spanish room text', () => {
    expect(hasForeignMarker('Habitación Doble con vistas al mar')).toBe(true);
    expect(hasForeignMarker('1 cama extragrande')).toBe(true);
    expect(hasForeignMarker('Suite con vistas al océano')).toBe(true);
  });
  it('flags Italian room text', () => {
    expect(hasForeignMarker('Camera Matrimoniale con Vista Mare')).toBe(true);
    expect(hasForeignMarker('Junior Suite con Letto King-Size')).toBe(true);
  });
  it('does not flag clean French', () => {
    expect(hasForeignMarker('Chambre Double avec vue sur la mer')).toBe(false);
    expect(hasForeignMarker('Suite Prestige avec terrasse')).toBe(false);
  });
  it('does not flag clean English (no "individual" false positive)', () => {
    expect(hasForeignMarker('Superior Room with an individual design and loch views')).toBe(false);
    expect(hasForeignMarker('Individual Private Suites')).toBe(false);
    expect(hasForeignMarker('Room with a king-size bed and partial views')).toBe(false);
  });
  it('does not flag English "camera" without Italian context', () => {
    expect(hasForeignMarker('Suite with a security camera at the private entrance')).toBe(false);
    expect(hasForeignMarker('In-room camera-free privacy guarantee')).toBe(false);
    expect(hasForeignMarker('Villa with CCTV camera surveillance')).toBe(false);
  });
  it('still flags "camera" when Italian tokens co-occur', () => {
    expect(hasForeignMarker('Camera Matrimoniale Deluxe')).toBe(true);
    expect(hasForeignMarker('Camera con letto king-size')).toBe(true);
    expect(hasForeignMarker('Camera Doppia con balcone')).toBe(true);
  });
});

describe('translateRoomText — Spanish', () => {
  it('translates a full Spanish room name to FR', () => {
    const out = translateRoomText('Habitación Doble con vistas al mar', 'fr');
    expect(out).toBe('Chambre Double avec vue sur la mer');
    expect(hasForeignMarker(out)).toBe(false);
  });
  it('translates a full Spanish room name to EN', () => {
    const out = translateRoomText('Habitación Doble con vistas al mar', 'en');
    expect(out).toBe('Room Double with sea views');
    expect(hasForeignMarker(out)).toBe(false);
  });
  it('translates bed config to FR', () => {
    expect(translateRoomText('Suite con cama extragrande', 'fr')).toBe('Suite avec lit king-size');
  });
  it('fixes a French description with a leftover Spanish word', () => {
    const out = translateRoomText(
      'Chambre Ocean Deluxe avec lit extragrande, vue sur la mer.',
      'fr',
    );
    expect(out).toContain('lit king-size');
    expect(hasForeignMarker(out)).toBe(false);
  });
  it('keeps proper nouns intact', () => {
    const out = translateRoomText(
      'Suite Familiar de 2 dormitorios con vistas a la ciudad - Servicio de mayordomo Signature St. Regis',
      'fr',
    );
    expect(out).toContain('Signature St. Regis');
    expect(out).toContain('service de majordome');
    expect(hasForeignMarker(out)).toBe(false);
  });
});

describe('translateRoomText — Italian', () => {
  it('translates a full Italian room name to FR', () => {
    const out = translateRoomText('Camera Matrimoniale con Vista Mare', 'fr');
    expect(out).toBe('Chambre Double avec vue sur la mer');
    expect(hasForeignMarker(out)).toBe(false);
  });
  it('translates twin config', () => {
    const out = translateRoomText('Camera Deluxe Doppia con Letti Singoli', 'fr');
    expect(hasForeignMarker(out)).toBe(false);
    expect(out).toContain('Chambre');
  });
  it('never rewrites English "camera" outside Italian context', () => {
    const en = 'Suite with a king-size bed and a security camera at the entrance';
    expect(translateRoomText(en, 'en')).toBe(en);
    expect(translateRoomText('Villa with CCTV camera surveillance', 'fr')).toBe(
      'Villa with CCTV camera surveillance',
    );
  });
});

describe('buildRoomPlan — clean-or-skip gate', () => {
  const base = {
    id: 'r1',
    hotel_id: 'h1',
    slug: 'demo',
    name_fr: null,
    name_en: null,
    description_fr: null,
    description_en: null,
  };
  it('proposes a change when translation is fully clean', () => {
    const plan = buildRoomPlan({ ...base, name_fr: 'Habitación Doble con vistas al mar' });
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.after).toBe('Chambre Double avec vue sur la mer');
    expect(plan.skipped).toHaveLength(0);
  });
  it('skips when a residual foreign token remains after translation', () => {
    // "bañera" (bathtub) is not in the glossary → the ñ survives translation and
    // the clean-or-skip gate must keep the whole field untouched, not half-fix it.
    const plan = buildRoomPlan({
      ...base,
      name_fr: 'Habitación con bañera de hidromasaje',
    });
    expect(plan.changes).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it('resolves a dangling "con vistas a <proper noun>" cleanly', () => {
    const plan = buildRoomPlan({
      ...base,
      name_fr:
        'Suite Serenissima de 1 dormitorio, con vistas a S.Maria D.Giglio y 1 cama extragrande',
    });
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]?.after).toContain('avec vue sur S.Maria D.Giglio');
    expect(hasForeignMarker(plan.changes[0]?.after ?? '')).toBe(false);
  });
  it('ignores already-clean fields', () => {
    const plan = buildRoomPlan({ ...base, name_fr: 'Chambre Deluxe avec terrasse' });
    expect(plan.changes).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
  });
});
