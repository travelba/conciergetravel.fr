/**
 * Cloudinary upload error union (skill: api-integration).
 *
 * The Cloudinary SDK throws `Error` instances with vendor-specific
 * messages. We normalise them into the same shape used by every other
 * vendor in this package so the orchestrator can `Result.match` on a
 * single union.
 */
export type CloudinaryError =
  | { readonly kind: 'auth_failed' }
  | { readonly kind: 'rate_limited'; readonly retryAfterSec?: number }
  | { readonly kind: 'source_unreachable'; readonly url: string }
  | { readonly kind: 'unsupported_format'; readonly format: string }
  | { readonly kind: 'asset_too_large'; readonly bytes: number }
  | { readonly kind: 'unknown'; readonly message: string };
