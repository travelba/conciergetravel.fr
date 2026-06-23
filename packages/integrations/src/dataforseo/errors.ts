import type { HttpError } from '@mch/integrations/http';

/**
 * Typed error union for the DataForSEO integration (skill: api-integration).
 *
 * `api_error` carries the DataForSEO envelope status (e.g. 40200 quota,
 * 40100 auth) which is distinct from the transport-level `http` failures.
 * `disabled` is returned when the integration is off or unconfigured —
 * callers degrade gracefully (LLM-only grounding) instead of throwing.
 */
export type DataForSeoError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'api_error'; readonly statusCode: number; readonly statusMessage: string }
  | { readonly kind: 'disabled' };
