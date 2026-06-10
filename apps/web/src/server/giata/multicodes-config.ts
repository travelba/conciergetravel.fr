import 'server-only';

import type { GiataMulticodesClientConfig } from '@mch/integrations/giata';

import { env } from '@/lib/env';

const DEFAULT_MC_BASE = 'https://multicodes.giatamedia.com';

/** Resolved GIATA MultiCodes client config, or null when disabled / incomplete. */
export function getGiataMulticodesClientConfig(): GiataMulticodesClientConfig | null {
  if (env.GIATA_ENABLED !== true) return null;

  const baseUrl = env.GIATA_MC_BASE_URL ?? env.GIATA_API_BASE ?? DEFAULT_MC_BASE;
  const username = env.GIATA_MC_USERNAME;
  const password = env.GIATA_MC_PASSWORD ?? env.GIATA_API_KEY;

  if (username === undefined || password === undefined) return null;
  if (username.length === 0 || password.length === 0) return null;

  return {
    baseUrl,
    username,
    password,
    apiVersion: env.GIATA_MC_API_VERSION,
  };
}
