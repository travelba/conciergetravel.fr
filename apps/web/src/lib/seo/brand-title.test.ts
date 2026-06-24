import { describe, expect, it } from 'vitest';

import { stripBrandSuffix } from './brand-title';

describe('stripBrandSuffix', () => {
  it('strips a trailing pipe brand suffix', () => {
    expect(stripBrandSuffix('Bulgari Hotel Paris — Palace Paris | MyConciergeHotel')).toBe(
      'Bulgari Hotel Paris — Palace Paris',
    );
  });

  it('strips a trailing em-dash brand suffix', () => {
    expect(stripBrandSuffix('Palaces de France 2026 — MyConciergeHotel')).toBe(
      'Palaces de France 2026',
    );
  });

  it('strips a trailing middle-dot brand suffix', () => {
    expect(stripBrandSuffix('Suite Lalique · MyConciergeHotel')).toBe('Suite Lalique');
  });

  it('collapses a doubled brand suffix to none (idempotent target)', () => {
    expect(stripBrandSuffix('Bulgari Hotel Paris | MyConciergeHotel — MyConciergeHotel')).toBe(
      'Bulgari Hotel Paris',
    );
  });

  it('leaves a title without a brand suffix untouched', () => {
    expect(stripBrandSuffix('Bulgari Hotel Paris — Palace Paris')).toBe(
      'Bulgari Hotel Paris — Palace Paris',
    );
  });

  it('does not strip a mid-string brand mention', () => {
    expect(stripBrandSuffix('How MyConciergeHotel curates its hotels')).toBe(
      'How MyConciergeHotel curates its hotels',
    );
  });

  it('is idempotent', () => {
    const once = stripBrandSuffix('Suite Lalique — Prince de Galles | MyConciergeHotel');
    expect(stripBrandSuffix(once)).toBe(once);
  });
});
