import { describe, expect, it } from 'vitest';

import {
  gatePremiumSectionFormat,
  PremiumSectionOutputSchema,
  type PremiumSectionKind,
  type PremiumSectionOutput,
} from './premium-section-generator.js';

const FR_OPENER = 'Mon conseil : ';
const EN_OPENER = 'My tip: ';

const FR_POOL = ['mot', 'court', 'simple', 'précis', 'ancré', 'concret', 'fait', 'réel'];
const EN_POOL = ['word', 'short', 'simple', 'precise', 'anchored', 'concrete', 'fact', 'real'];

function build(n: number, opener = '', pool: readonly string[] = FR_POOL): string {
  const sentences: string[] = [];
  let total = 0;
  let i = 0;
  while (total < n) {
    const len = Math.min(10, n - total);
    const sentence = Array.from({ length: len }, (_, k) => pool[(i + k) % pool.length]).join(' ');
    sentences.push(sentence + '.');
    total += len;
    i += len;
  }
  const body = sentences.join(' ');
  return opener + body;
}

function frBody(n: number, opener = ''): string {
  return build(n, opener, FR_POOL);
}

function enBody(n: number, opener = ''): string {
  return build(n, opener, EN_POOL);
}

const KIND: PremiumSectionKind = 'conseil_enrichi';

describe('@editorial-pilot — premium section generator', () => {
  it('parses a well-formed output via Zod', () => {
    const fr = frBody(240, FR_OPENER);
    const en = enBody(240, EN_OPENER);
    const parsed = PremiumSectionOutputSchema.parse({ fr: { body: fr }, en: { body: en } });
    expect(parsed.fr.body.startsWith(FR_OPENER)).toBe(true);
    expect(parsed.en.body.startsWith(EN_OPENER)).toBe(true);
  });

  it('passes the format gate when both bodies are in band and open correctly', () => {
    const out: PremiumSectionOutput = {
      fr: { body: frBody(240, FR_OPENER) },
      en: { body: enBody(240, EN_OPENER) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toBeNull();
  });

  it('rejects a body that is below the word-count floor', () => {
    const out: PremiumSectionOutput = {
      fr: { body: FR_OPENER + 'mot. '.repeat(10) },
      en: { body: enBody(240, EN_OPENER) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toMatch(/fr.body too short/u);
  });

  it('rejects a body that is above the word-count ceiling', () => {
    const out: PremiumSectionOutput = {
      fr: { body: frBody(360, FR_OPENER) },
      en: { body: enBody(240, EN_OPENER) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toMatch(/fr.body too long/u);
  });

  it('rejects a missing opener for conseil_enrichi', () => {
    const out: PremiumSectionOutput = {
      fr: { body: frBody(240) },
      en: { body: enBody(240) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toMatch(/fr.body must open with the expected pattern/u);
  });

  it('does NOT require an opener for quartier_concierge / gastronomie / timing', () => {
    const out: PremiumSectionOutput = {
      fr: { body: frBody(240) },
      en: { body: enBody(240) },
    };
    expect(gatePremiumSectionFormat('quartier_concierge', out)).toBeNull();
    expect(gatePremiumSectionFormat('gastronomie_concierge', out)).toBeNull();
    expect(
      gatePremiumSectionFormat('timing_acces_concierge', {
        fr: { body: frBody(170) },
        en: { body: enBody(180) },
      }),
    ).toBeNull();
  });

  it('rejects a sentence longer than 25 words', () => {
    const longSentence = Array.from({ length: 30 }, () => 'mot').join(' ') + '.';
    const out: PremiumSectionOutput = {
      fr: { body: FR_OPENER + longSentence + ' ' + frBody(200) },
      en: { body: enBody(240, EN_OPENER) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toMatch(/sentence too long/u);
  });

  it('rejects banned superlatives', () => {
    const banned = FR_OPENER + frBody(220) + ' incroyable.';
    const out: PremiumSectionOutput = {
      fr: { body: banned },
      en: { body: enBody(240, EN_OPENER) },
    };
    const reason = gatePremiumSectionFormat(KIND, out);
    expect(reason).toMatch(/banned lexicon/u);
  });

  it('rejects when EN appears to be a literal translation of FR', () => {
    // Both bodies share the same first 60 chars — the gate compares
    // the first 60 chars after stripping accents and lower-casing.
    const head = 'le quartier ouvre par une placette bordée de platanes centenaires.';
    const out: PremiumSectionOutput = {
      fr: { body: head + ' ' + frBody(220) },
      en: { body: head + ' ' + enBody(220) },
    };
    const reason = gatePremiumSectionFormat('quartier_concierge', out);
    expect(reason).toMatch(/literal translation/u);
  });

  it('respects the 150-200 word band for timing_acces_concierge', () => {
    const tooLong: PremiumSectionOutput = {
      fr: { body: frBody(240) },
      en: { body: enBody(170) },
    };
    const reason = gatePremiumSectionFormat('timing_acces_concierge', tooLong);
    expect(reason).toMatch(/fr.body too long/u);

    const inBand: PremiumSectionOutput = {
      fr: { body: frBody(170) },
      en: { body: enBody(180) },
    };
    expect(gatePremiumSectionFormat('timing_acces_concierge', inBand)).toBeNull();
  });
});
