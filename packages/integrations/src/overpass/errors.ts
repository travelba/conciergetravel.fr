/**
 * Overpass typed error union (skill: api-integration).
 *
 * Overpass is a public read-only API but it has a quirky failure mode:
 * the public instance at `overpass-api.de` returns HTTP 200 with a
 * tiny HTML payload "runtime error: Query timed out" when overloaded,
 * instead of a proper 5xx. We surface that as `query_timeout` so
 * callers can fall back gracefully (rural hotels can tolerate "no
 * commerces found" but should not crash the pipeline).
 */

import type { HttpError } from '../http/http-error.js';

export type OverpassError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'empty_response' }
  | { readonly kind: 'query_timeout' }
  | { readonly kind: 'too_many_requests' };
