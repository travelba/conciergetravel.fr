import { z } from 'zod';

/**
 * Le Concierge Club — A/B experiments registry (Sprint 5).
 *
 * Why this lives next to the flag registry
 * ----------------------------------------
 * The boolean flags in `flags.ts` are operator-controlled kill-switches
 * (Phase 1 = off). The variants here are bandit-style experiments with
 * stable variant assignment per anonymous visitor (cookie-bucketed).
 *
 * The three initial experiments mirror the membership-program funnel:
 *   1. `club_cta_copy` — wording test on the primary CTA at
 *      `/le-concierge-club`. Variants live in the i18n bundle and are
 *      addressed via the variant id (the i18n key already exists; the
 *      experiment picks which one to render).
 *   2. `club_signup_oauth_order` — does showing OAuth before the
 *      password form lift conversion? `oauth_first` vs `password_first`.
 *      The variant rearranges sections inside `/compte/rejoindre`.
 *   3. `club_benefits_position` — does the benefits block convert
 *      better above the booking widget (`above_widget`) or below the
 *      FAQ (`below_faq`)? Touches the hotel fiche composition.
 *
 * Skill: membership-program §A/B testing + observability-monitoring
 * §custom events (variant assignment is reported as a Sentry tag).
 *
 * ADR: ADR-0019 §Sprint 5 deliverables.
 */

export const ClubExperimentSchema = z.object({
  club_cta_copy: z.enum(['control_decouvrir', 'urgent_rejoindre', 'soft_essai']),
  club_signup_oauth_order: z.enum(['oauth_first', 'password_first']),
  club_benefits_position: z.enum(['above_widget', 'below_faq']),
});

export type ClubExperiments = z.infer<typeof ClubExperimentSchema>;
export type ClubExperimentName = keyof ClubExperiments;

const DEFAULT_VARIANTS: ClubExperiments = {
  club_cta_copy: 'control_decouvrir',
  club_signup_oauth_order: 'oauth_first',
  club_benefits_position: 'above_widget',
};

const EXPERIMENT_VARIANTS: {
  readonly [K in ClubExperimentName]: ReadonlyArray<ClubExperiments[K]>;
} = {
  club_cta_copy: ['control_decouvrir', 'urgent_rejoindre', 'soft_essai'],
  club_signup_oauth_order: ['oauth_first', 'password_first'],
  club_benefits_position: ['above_widget', 'below_faq'],
};

export function getDefaultVariants(): ClubExperiments {
  return { ...DEFAULT_VARIANTS };
}

export function listVariants<K extends ClubExperimentName>(
  name: K,
): ReadonlyArray<ClubExperiments[K]> {
  return EXPERIMENT_VARIANTS[name];
}

/**
 * Deterministic bucket assignment from a stable visitor cookie.
 * We use a tiny FNV-1a hash so the function is pure, fast, and
 * doesn't pull in `node:crypto` (lets the package stay edge-runtime
 * compatible).
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignVariant<K extends ClubExperimentName>(
  name: K,
  visitorId: string,
): ClubExperiments[K] {
  const variants = EXPERIMENT_VARIANTS[name];
  if (variants.length === 0) return DEFAULT_VARIANTS[name];
  const bucket = fnv1a(`${name}:${visitorId}`);
  const idx = bucket % variants.length;
  // The non-null assertion is safe because we checked length > 0.
  return variants[idx]!;
}

export function assignAllVariants(visitorId: string): ClubExperiments {
  return {
    club_cta_copy: assignVariant('club_cta_copy', visitorId),
    club_signup_oauth_order: assignVariant('club_signup_oauth_order', visitorId),
    club_benefits_position: assignVariant('club_benefits_position', visitorId),
  };
}

/**
 * Read variant overrides from `MCH_EXPERIMENT_VARIANT_<NAME>=<variant>`
 * env vars — used by Playwright tests and dev runs to lock a specific
 * arm without juggling cookies. Unknown variants fall back to default.
 */
export function applyVariantEnvOverrides(
  variants: ClubExperiments,
  env: NodeJS.ProcessEnv,
): ClubExperiments {
  const next: ClubExperiments = { ...variants };
  for (const name of Object.keys(variants) as readonly ClubExperimentName[]) {
    const envKey = `MCH_EXPERIMENT_VARIANT_${name.toUpperCase()}` as const;
    const raw = env[envKey];
    if (typeof raw !== 'string' || raw.length === 0) continue;
    const allowed = EXPERIMENT_VARIANTS[name] as ReadonlyArray<string>;
    if (allowed.includes(raw)) {
      // Safe cast: the includes() check above narrows raw to the union.
      (next[name] as string) = raw;
    }
  }
  return next;
}
