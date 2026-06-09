import { describe, expect, it } from 'vitest';

import { getDayPickerLocale } from './day-picker-locale';

describe('getDayPickerLocale', () => {
  it('returns French month names for fr', () => {
    const locale = getDayPickerLocale('fr');
    expect(locale.localize?.month(5, { width: 'wide' })).toBe('juin');
    expect(locale.code).toBe('fr');
  });

  it('returns English month names for en', () => {
    const locale = getDayPickerLocale('en');
    expect(locale.localize?.month(5, { width: 'wide' })).toBe('June');
    expect(locale.code).toBe('en-US');
  });
});
