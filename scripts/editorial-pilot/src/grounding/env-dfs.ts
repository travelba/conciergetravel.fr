/**
 * DataForSEO config loader for the editorial-pilot grounding layer.
 *
 * Distinct from `@mch/config/env` (which validates the whole production
 * env and would fail in the focused pilot shell). Reads only the four
 * DATAFORSEO_* vars from `.env.local`; returns `null` when the integration
 * is disabled or unconfigured so every caller degrades to LLM-only
 * grounding instead of throwing (DFS is an enhancer, never a hard dep).
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { DataForSeoClientConfig } from '@mch/integrations/dataforseo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && /^(1|true|yes|on)$/iu.test(value.trim());
}

/** Returns a ready client config, or `null` when off/unconfigured. */
export function loadDfsConfig(): DataForSeoClientConfig | null {
  const username = process.env.DATAFORSEO_USERNAME?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!isTruthy(process.env.DATAFORSEO_ENABLED)) return null;
  if (username === undefined || username.length === 0) return null;
  if (password === undefined || password.length === 0) return null;
  const base = process.env.DATAFORSEO_API_BASE?.trim();
  return {
    baseUrl: base !== undefined && base.length > 0 ? base : 'https://api.dataforseo.com',
    username,
    password,
  };
}
