import type { HttpError } from '@mch/integrations/http';

export type BrevoError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string };
