import type { HttpError } from '../http/http-error';

export type GiataError =
  | { readonly kind: 'disabled' }
  | { readonly kind: 'not_configured'; readonly details: string }
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'not_found'; readonly giataId?: string };
