/**
 * Wikimedia Commons typed error union (skill: api-integration).
 *
 * Mirrors the contract used by every other vendor in this package
 * (Makcorps, Amadeus, Brevo…): a discriminated `kind` field, optional
 * details that NEVER leak PII or full payloads — Commons is a public
 * API so payloads contain no PII, but we still avoid logging the full
 * extmetadata blob to keep Sentry breadcrumbs small.
 */

import type { HttpError } from '../http/http-error.js';

export type CommonsError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'empty_response' }
  | { readonly kind: 'category_not_found'; readonly category: string };
