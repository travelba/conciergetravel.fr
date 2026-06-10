import 'server-only';

import type { GiataRtmClientConfig } from '@mch/integrations/giata';

import { env } from '@/lib/env';

/** Resolved GIATA RTM client config, or null when disabled / incomplete. */
export function getGiataRtmClientConfig(): GiataRtmClientConfig | null {
  if (env.GIATA_RTM_ENABLED !== true) return null;

  const baseUrl = env.GIATA_RTM_BASE_URL;
  const username = env.GIATA_RTM_USERNAME;
  const password = env.GIATA_RTM_PASSWORD;

  if (baseUrl === undefined || username === undefined || password === undefined) {
    return null;
  }
  if (username.length === 0 || password.length === 0) {
    return null;
  }

  return {
    baseUrl,
    username,
    password,
    useMapPlus: env.GIATA_RTM_USE_MAP_PLUS === true,
  };
}
