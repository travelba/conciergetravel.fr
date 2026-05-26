/**
 * @mch/experiments — server-side flag resolution.
 *
 * Server entry point. Reads from Vercel Edge Config when
 * `EDGE_CONFIG` is wired, otherwise returns static defaults and
 * applies env overrides (`MCH_EXPERIMENT_<FLAG>=true|false`).
 *
 * Usage:
 *
 *   import { getFlag } from '@mch/experiments';
 *   const dual = await getFlag('member_price_differential_enabled');
 *
 * Skill: nextjs-app-router + loyalty-program.
 */
import { get } from '@vercel/edge-config';

import {
  applyEnvOverrides,
  type FlagName,
  type Flags,
  getDefaultFlags,
  parseFlagsPayload,
} from './flags';

export { applyEnvOverrides, FlagSchema, getDefaultFlags, parseFlagsPayload } from './flags';
export type { FlagName, Flags } from './flags';
export {
  applyVariantEnvOverrides,
  assignAllVariants,
  assignVariant,
  ClubExperimentSchema,
  getDefaultVariants,
  listVariants,
} from './club-experiments';
export type { ClubExperimentName, ClubExperiments } from './club-experiments';

interface ResolveOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly edgeConfigKey?: string;
}

const DEFAULT_EDGE_CONFIG_KEY = 'le_concierge_club_flags';

/**
 * Resolve all flags in one round-trip. Cached per-request by the
 * Edge Config SDK; safe to call from multiple Server Components.
 */
export async function resolveFlags(options: ResolveOptions = {}): Promise<Flags> {
  const env = options.env ?? process.env;
  const key = options.edgeConfigKey ?? DEFAULT_EDGE_CONFIG_KEY;

  let base = getDefaultFlags();

  const edgeConfig = env['EDGE_CONFIG'];
  if (typeof edgeConfig === 'string' && edgeConfig.length > 0) {
    try {
      const raw = await get(key);
      base = parseFlagsPayload(raw);
    } catch {
      base = getDefaultFlags();
    }
  }

  return applyEnvOverrides(base, env);
}

/**
 * Read a single flag. Prefer `resolveFlags` when reading several at
 * once — the Edge Config SDK already de-duplicates per request but
 * a single `get` allocation is still cheaper.
 */
export async function getFlag(name: FlagName, options: ResolveOptions = {}): Promise<boolean> {
  const flags = await resolveFlags(options);
  return flags[name];
}
