import type { HttpError } from '@mch/integrations/http';

/**
 * Typed error union for the GetYourGuide Partner API client.
 *
 *   - `disabled`     — GETYOURGUIDE_ENABLED is false (Palier A not live yet).
 *   - `unconfigured` — enabled but the access token / base URL is missing.
 *   - `http`         — transport error (mapped from the shared HTTP client).
 *   - `parse_failure`— the response shape did not match the Zod schema.
 */
export type GetYourGuideError =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'unconfigured'; readonly details: string }
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string };
