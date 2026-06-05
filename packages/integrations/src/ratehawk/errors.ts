import type { HttpError } from '@mch/integrations/http';

export type RateHawkError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'api_error'; readonly status: string; readonly details: string }
  | { readonly kind: 'not_configured'; readonly details: string }
  | { readonly kind: 'no_availability' };
