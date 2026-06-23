import { loadSharedEnv, type SharedEnv } from '@mch/config/env';
import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '@mch/integrations/http';

import type { DataForSeoError } from './errors';
import { DfsEnvelopeSchema, DFS_STATUS_OK } from './types';

/**
 * DataForSEO v3 client. Auth is HTTP Basic (`login:password`), the request
 * body is always an array of task objects, and every endpoint returns the
 * same `{ status_code, tasks: [{ status_code, result }] }` envelope. This
 * module exposes a single generic `dfsLive` that POSTs one task and returns
 * `tasks[0].result` (the array the per-resource wrappers normalise).
 */

export interface DataForSeoClientConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
}

/** Cross-runtime base64 (Edge `btoa` when present, Node `Buffer` fallback). */
function toBase64(value: string): string {
  const g = globalThis as { btoa?: (s: string) => string };
  if (typeof g.btoa === 'function') return g.btoa(value);
  return Buffer.from(value, 'utf8').toString('base64');
}

function basicAuthHeader(cfg: DataForSeoClientConfig): string {
  return `Basic ${toBase64(`${cfg.username}:${cfg.password}`)}`;
}

/**
 * POST a single DataForSEO "live" task and return `tasks[0].result`.
 *
 * The `task` is the per-endpoint payload (e.g. `{ keyword, location_name,
 * language_code }`). Wrapped in an array as the API requires. A 30s timeout
 * fits the live SERP/Labs latency budget.
 */
export async function dfsLive(
  cfg: DataForSeoClientConfig,
  path: string,
  task: Readonly<Record<string, unknown>>,
): Promise<Result<readonly unknown[], DataForSeoError>> {
  const res = await retryingJsonRequest({
    url: `${cfg.baseUrl}${path}`,
    method: 'POST',
    headers: { Authorization: basicAuthHeader(cfg), Accept: 'application/json' },
    body: { kind: 'json', value: [task] },
    timeoutMs: 30_000,
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined) {
    return err({ kind: 'parse_failure', details: 'empty dataforseo response' });
  }

  const parsed = DfsEnvelopeSchema.safeParse(res.value.json);
  if (!parsed.success) {
    return err({
      kind: 'parse_failure',
      details: `envelope: ${parsed.error.message.slice(0, 200)}`,
    });
  }
  const envelope = parsed.data;
  if (envelope.status_code !== DFS_STATUS_OK) {
    return err({
      kind: 'api_error',
      statusCode: envelope.status_code,
      statusMessage: envelope.status_message,
    });
  }

  const task0 = envelope.tasks?.[0];
  if (task0 === undefined) {
    return err({ kind: 'parse_failure', details: 'dataforseo envelope has no task' });
  }
  if (task0.status_code !== DFS_STATUS_OK) {
    return err({
      kind: 'api_error',
      statusCode: task0.status_code,
      statusMessage: task0.status_message,
    });
  }
  return ok(task0.result ?? []);
}

/**
 * Build the client config from validated shared env. Returns a typed
 * `disabled` error (never throws) when the integration is off or the
 * credentials are absent — callers fall back to LLM-only grounding.
 */
export function dataForSeoConfigFromSharedEnv(
  source?: SharedEnv,
): Result<DataForSeoClientConfig, DataForSeoError> {
  const env = source ?? loadSharedEnv();
  if (!env.DATAFORSEO_ENABLED) return err({ kind: 'disabled' });
  if (
    env.DATAFORSEO_USERNAME === undefined ||
    env.DATAFORSEO_USERNAME.length === 0 ||
    env.DATAFORSEO_PASSWORD === undefined ||
    env.DATAFORSEO_PASSWORD.length === 0
  ) {
    return err({ kind: 'disabled' });
  }
  return ok({
    baseUrl: env.DATAFORSEO_API_BASE ?? 'https://api.dataforseo.com',
    username: env.DATAFORSEO_USERNAME,
    password: env.DATAFORSEO_PASSWORD,
  });
}
