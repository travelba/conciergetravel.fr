import { describe, expect, it } from 'vitest';

import {
  applyVariantEnvOverrides,
  assignAllVariants,
  assignVariant,
  ClubExperimentSchema,
  getDefaultVariants,
  listVariants,
} from './club-experiments';

describe('club-experiments', () => {
  it('returns the documented default variants', () => {
    const defaults = getDefaultVariants();
    expect(defaults).toEqual({
      club_cta_copy: 'control_decouvrir',
      club_signup_oauth_order: 'oauth_first',
      club_benefits_position: 'above_widget',
    });
    expect(ClubExperimentSchema.safeParse(defaults).success).toBe(true);
  });

  it('lists the available variants per experiment', () => {
    expect(listVariants('club_cta_copy')).toEqual([
      'control_decouvrir',
      'urgent_rejoindre',
      'soft_essai',
    ]);
    expect(listVariants('club_signup_oauth_order')).toEqual(['oauth_first', 'password_first']);
    expect(listVariants('club_benefits_position')).toEqual(['above_widget', 'below_faq']);
  });

  it('assignVariant is deterministic for a given visitor id', () => {
    const a1 = assignVariant('club_cta_copy', 'visitor-abc');
    const a2 = assignVariant('club_cta_copy', 'visitor-abc');
    expect(a1).toEqual(a2);
  });

  it('assignVariant returns a value in the registered allowlist', () => {
    const v = assignVariant('club_benefits_position', 'visitor-xyz');
    expect(listVariants('club_benefits_position')).toContain(v);
  });

  it('assignVariant spreads visitors across all variants over a large sample', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(assignVariant('club_cta_copy', `v-${i}`));
    }
    // 3 buckets, with 500 trials we expect all 3 to show up.
    expect(seen.size).toBe(3);
  });

  it('assignAllVariants returns a valid ClubExperiments shape', () => {
    const all = assignAllVariants('visitor-xyz');
    expect(ClubExperimentSchema.safeParse(all).success).toBe(true);
  });

  it('applyVariantEnvOverrides forces a single variant when env is set', () => {
    const base = getDefaultVariants();
    const next = applyVariantEnvOverrides(base, {
      MCH_EXPERIMENT_VARIANT_CLUB_CTA_COPY: 'soft_essai',
    });
    expect(next.club_cta_copy).toBe('soft_essai');
    // Other experiments stay on their default.
    expect(next.club_signup_oauth_order).toBe(base.club_signup_oauth_order);
  });

  it('applyVariantEnvOverrides ignores unknown variant strings', () => {
    const base = getDefaultVariants();
    const next = applyVariantEnvOverrides(base, {
      MCH_EXPERIMENT_VARIANT_CLUB_CTA_COPY: 'not_a_real_variant',
    });
    expect(next).toEqual(base);
  });

  it('applyVariantEnvOverrides ignores empty / missing env vars', () => {
    const base = getDefaultVariants();
    const next = applyVariantEnvOverrides(base, {
      MCH_EXPERIMENT_VARIANT_CLUB_CTA_COPY: '',
    });
    expect(next).toEqual(base);
  });
});
