/**
 * Google Places typed error union (skill: api-integration).
 *
 * The Places API distinguishes:
 *   - `NOT_FOUND`        → no place matched the query
 *   - `INVALID_ARGUMENT` → malformed FieldMask / query
 *   - `RESOURCE_EXHAUSTED` → quota exceeded (per-day or per-minute)
 *   - `PERMISSION_DENIED` → key missing the right Places API enablement
 */
import type { HttpError } from '../http/http-error.js';

export type GooglePlacesError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'no_match'; readonly query: string }
  | { readonly kind: 'quota_exceeded' }
  | { readonly kind: 'auth_failed' };
