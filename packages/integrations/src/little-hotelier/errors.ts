import type { HttpError } from '@mch/integrations/http';

export type LittleHotelierError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string };
