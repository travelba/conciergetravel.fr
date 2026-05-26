import { z } from 'zod';

/**
 * @mch/experiments — typed feature flags backed by Vercel Edge Config in
 * production and by static defaults (or env overrides) in dev/CI.
 *
 * Why Edge Config and not a runtime DB call: flags are read on every
 * request from the edge — Edge Config is replicated to every region and
 * its reads are sub-millisecond and free up to 1 KB. RLS, Redis, etc.
 * are too slow for the hot path.
 *
 * Phase 1 — both flags below are OFF. Phase 6 — operator flips
 * `member_price_differential_enabled` after Amadeus rate parity audit
 * AND `little_personalization_enabled` after Little API sync runs
 * for ≥ 7 nights.
 *
 * Skill: nextjs-app-router + loyalty-program.
 */
export const FlagSchema = z.object({
  /**
   * When true, the UI may render a member-only price column distinct
   * from the public rate. Off in Phase 1 because Amadeus rate parity
   * means the two values would be identical and the comparison would
   * confuse users + waste pixels.
   */
  member_price_differential_enabled: z.boolean(),
  /**
   * When true, `<ClubBenefitsBlock>` reads `hotel_member_benefits`
   * rows with `source='little_api'` and renders the personalised view
   * for connected club members. When false (Phase 1), the block falls
   * back to the catalogue + "personnalisation en cours" copy.
   */
  little_personalization_enabled: z.boolean(),
});

export type Flags = z.infer<typeof FlagSchema>;

export type FlagName = keyof Flags;

const DEFAULT_FLAGS: Flags = {
  member_price_differential_enabled: false,
  little_personalization_enabled: false,
};

/**
 * Static default values, used when no Edge Config connection is
 * configured (dev, CI, preview without env). Phase 1 = both false.
 */
export function getDefaultFlags(): Flags {
  return { ...DEFAULT_FLAGS };
}

/**
 * Parse a raw Edge Config payload into validated flags. Unknown or
 * malformed values fall back to the default so a typo in the Edge
 * Config dashboard never crashes the site.
 */
export function parseFlagsPayload(raw: unknown): Flags {
  const result = FlagSchema.safeParse({
    ...DEFAULT_FLAGS,
    ...(raw !== null && typeof raw === 'object' ? raw : {}),
  });
  if (!result.success) {
    return getDefaultFlags();
  }
  return result.data;
}

/**
 * Override flag values from `MCH_EXPERIMENT_<FLAG>=true|false` env
 * variables — used in CI and dev to force a flag without touching
 * the Edge Config dashboard. Unknown env values are ignored.
 */
export function applyEnvOverrides(flags: Flags, env: NodeJS.ProcessEnv): Flags {
  const next: Flags = { ...flags };
  for (const key of Object.keys(flags) as readonly FlagName[]) {
    const envKey = `MCH_EXPERIMENT_${key.toUpperCase()}` as const;
    const raw = env[envKey];
    if (raw === 'true' || raw === '1') {
      next[key] = true;
    } else if (raw === 'false' || raw === '0') {
      next[key] = false;
    }
  }
  return next;
}
