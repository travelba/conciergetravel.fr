import { describe, it, expect } from 'vitest';

import {
  buildPolicies,
  cleanNote,
  normalizeTime,
  type PolicyFacts,
} from './hotel-policies-builder.js';

describe('normalizeTime', () => {
  it('passes through HH:MM', () => {
    expect(normalizeTime('15:00')).toBe('15:00');
    expect(normalizeTime('09:30')).toBe('09:30');
  });

  it('parses 12-hour clock', () => {
    expect(normalizeTime('3pm')).toBe('15:00');
    expect(normalizeTime('3:30 pm')).toBe('15:30');
    expect(normalizeTime('11 a.m.')).toBe('11:00');
    expect(normalizeTime('12pm')).toBe('12:00');
    expect(normalizeTime('12am')).toBe('00:00');
  });

  it('parses French 24-hour', () => {
    expect(normalizeTime('15h')).toBe('15:00');
    expect(normalizeTime('15h30')).toBe('15:30');
    expect(normalizeTime('11 h 00')).toBe('11:00');
  });

  it('parses noon / midnight words', () => {
    expect(normalizeTime('noon')).toBe('12:00');
    expect(normalizeTime('midi')).toBe('12:00');
    expect(normalizeTime('midnight')).toBe('00:00');
  });

  it('returns null for unparseable / empty / null', () => {
    expect(normalizeTime(null)).toBeNull();
    expect(normalizeTime(undefined)).toBeNull();
    expect(normalizeTime('')).toBeNull();
    expect(normalizeTime('flexible')).toBeNull();
    expect(normalizeTime('25:00')).toBeNull();
  });
});

describe('cleanNote', () => {
  it('strips Free!/Gratuit! artifacts and trims', () => {
    expect(cleanNote('Free!Pets allowed.')).toBe('Pets allowed.');
    expect(cleanNote('Gratuit ! Animaux acceptés.')).toBe('Animaux acceptés.');
    expect(cleanNote('  normal note ')).toBe('normal note');
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote('Free!')).toBeNull();
  });
});

describe('buildPolicies', () => {
  const fullFacts: PolicyFacts = {
    check_in_from: '15:00',
    check_out_until: 'noon',
    pets_allowed: true,
    pet_fee_eur: 50,
    wifi_included: true,
    wifi_scope: 'whole_property',
    cancellation_summary_fr: 'Annulation gratuite jusqu’à 48h avant l’arrivée.',
    cancellation_free_until_hours: 48,
  };

  it('builds all 5 core blocks from full facts', () => {
    const res = buildPolicies(fullFacts, null);
    expect(res.policies).not.toBeNull();
    expect(res.coreComplete).toBe(true);
    expect(res.grounded).toBe(5);
    expect(res.policies?.['check_in']).toEqual({ from: '15:00' });
    expect(res.policies?.['check_out']).toEqual({ until: '12:00' });
    expect(res.policies?.['pets']).toEqual({ allowed: true, fee_eur: 50 });
    expect(res.policies?.['wifi']).toEqual({ included: true, scope: 'whole_property' });
    expect(res.policies?.['cancellation']).toEqual({
      summary_fr: 'Annulation gratuite jusqu’à 48h avant l’arrivée.',
      free_until_hours: 48,
    });
  });

  it('never carries _synthetic into the output', () => {
    const synthetic = {
      _synthetic: true,
      check_in: { from: '14:00' },
      check_out: { until: '11:00' },
      pets: { allowed: false },
    };
    const res = buildPolicies({ check_in_from: '15:00' }, synthetic);
    expect(res.policies).not.toBeNull();
    expect(res.policies?.['_synthetic']).toBeUndefined();
    // synthetic blocks are NOT preserved — only the grounded check_in is kept.
    expect(res.policies?.['check_in']).toEqual({ from: '15:00' });
    expect(res.policies?.['check_out']).toBeUndefined();
    expect(res.policies?.['pets']).toBeUndefined();
  });

  it('preserves existing real (non-synthetic) blocks not re-grounded', () => {
    const real = {
      check_in: { from: '14:00' },
      pets: { allowed: false, notes_fr: 'Pas d’animaux.' },
    };
    const res = buildPolicies({ check_out_until: '11:00' }, real);
    expect(res.policies?.['check_out']).toEqual({ until: '11:00' });
    // existing real blocks survive
    expect(res.policies?.['check_in']).toEqual({ from: '14:00' });
    expect(res.policies?.['pets']).toEqual({ allowed: false, notes_fr: 'Pas d’animaux.' });
  });

  it('returns null policies when nothing grounded and existing is synthetic', () => {
    const res = buildPolicies({}, { _synthetic: true, check_in: { from: '14:00' } });
    expect(res.policies).toBeNull();
    expect(res.grounded).toBe(0);
    expect(res.coreComplete).toBe(false);
  });

  it('handles pets explicitly forbidden', () => {
    const res = buildPolicies({ pets_allowed: false }, null);
    expect(res.policies?.['pets']).toEqual({ allowed: false });
    expect(res.grounded).toBe(1);
  });

  it('strips "Free!" scraping artifacts from pet notes', () => {
    const res = buildPolicies(
      {
        pets_allowed: true,
        pet_notes_fr: 'Free!Animaux acceptés sur demande.',
        pet_notes_en: 'Free!Pets allowed on request.',
      },
      null,
    );
    const pets = res.policies?.['pets'] as Record<string, unknown>;
    expect(pets['notes_fr']).toBe('Animaux acceptés sur demande.');
    expect(pets['notes_en']).toBe('Pets allowed on request.');
  });

  it('drops untranslated English from the FR note', () => {
    const res = buildPolicies(
      {
        pets_allowed: true,
        pet_notes_fr: 'Pets are allowed on request.',
        pet_notes_en: 'Pets are allowed on request.',
      },
      null,
    );
    const pets = res.policies?.['pets'] as Record<string, unknown>;
    expect(pets['notes_fr']).toBeUndefined();
    expect(pets['notes_en']).toBe('Pets are allowed on request.');
  });

  it('ignores unparseable check-in time', () => {
    const res = buildPolicies({ check_in_from: 'flexible', check_out_until: '11:00' }, null);
    expect(res.policies?.['check_in']).toBeUndefined();
    expect(res.policies?.['check_out']).toEqual({ until: '11:00' });
    expect(res.grounded).toBe(1);
  });
});
