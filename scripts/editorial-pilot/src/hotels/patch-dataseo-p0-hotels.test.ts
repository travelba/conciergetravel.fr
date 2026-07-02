import { describe, expect, it } from 'vitest';

import { rewritePalaceClaims, type HotelRow } from './patch-dataseo-p0-hotels';

function row(overrides: Partial<HotelRow>): HotelRow {
  return {
    id: 'id',
    slug: 'test-hotel',
    name: 'Test Hotel',
    country_code: 'FR',
    is_palace: false,
    luxury_tier: 'self_5_star',
    affiliations: null,
    description_fr: null,
    description_en: null,
    factual_summary_fr: null,
    factual_summary_en: null,
    meta_title_fr: null,
    meta_title_en: null,
    meta_desc_fr: null,
    meta_desc_en: null,
    faq_content: null,
    faq_content_kit: null,
    concierge_questions: null,
    geo_qa: null,
    ...overrides,
  };
}

describe('rewritePalaceClaims — false Atout France Palace claims', () => {
  it('drops a whole Atout France sentence for a NON-French hotel', () => {
    const r = row({ name: '45 Park Lane', country_code: 'GB' });
    const out = rewritePalaceClaims(
      r,
      'A landmark address in Mayfair. The Palace classification by Atout France sets the standard. The rest is in the detail.',
    );
    expect(out.value).not.toMatch(/atout france/iu);
    expect(out.value).toContain('A landmark address in Mayfair.');
    expect(out.value).toContain('The rest is in the detail.');
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  it('strips the appositive claim but keeps the sentence for a FRENCH non-Palace hotel', () => {
    const r = row({ name: '5 Terres Hôtel & Spa', country_code: 'FR' });
    const out = rewritePalaceClaims(
      r,
      "L'hôtel, classé Palace par Atout France, offre un cadre unique au cœur du village.",
    );
    expect(out.value).not.toMatch(/palace par atout france/iu);
    expect(out.value).toContain("L'hôtel offre un cadre unique au cœur du village.");
  });

  it('drops a standalone false Palace-by-Atout-France sentence (FR)', () => {
    const r = row({ name: 'ABaC Hotel', country_code: 'FR' });
    const out = rewritePalaceClaims(
      r,
      'Une adresse rare. Le classement Palace par Atout France fixe le niveau. Le reste se lit dans les détails.',
    );
    expect(out.value).not.toMatch(/atout france/iu);
    expect(out.value).toContain('Une adresse rare.');
    expect(out.value).toContain('Le reste se lit dans les détails.');
  });

  it('PRESERVES a legitimate 5-star Atout France star reference (FR, no palace)', () => {
    const r = row({ name: 'Hôtel du Test', country_code: 'FR' });
    const input = "L'hôtel est classé 5 étoiles par Atout France depuis 2019.";
    const out = rewritePalaceClaims(r, input);
    expect(out.value).toBe(input);
    expect(out.reasons.length).toBe(0);
  });

  it('never touches "Palace" inside the hotel commercial name', () => {
    const r = row({ name: 'Taj Lake Palace', country_code: 'IN' });
    const input = 'Le Taj Lake Palace flotte sur le lac Pichola depuis 1746.';
    const out = rewritePalaceClaims(r, input);
    expect(out.value).toBe(input);
  });

  it('reverts an empty-result sentence-drop rather than nuking a short field (non-FR)', () => {
    const r = row({ name: 'Some Hotel', country_code: 'US' });
    const input = 'Classé par Atout France.';
    const out = rewritePalaceClaims(r, input);
    // Dropping the only sentence would empty the field — keep the original.
    expect(out.value).toBe(input);
  });
});
