import type { HttpError } from '@mch/integrations/http';

export type ApifyError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'not_configured' };
