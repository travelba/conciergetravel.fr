import type { HttpError } from '../http/http-error';

export type TravelportError =
  | { readonly kind: 'http'; readonly error: HttpError }
  | { readonly kind: 'parse_failure'; readonly details: string }
  | { readonly kind: 'oauth_rejected'; readonly details?: string }
  | { readonly kind: 'authorization_error'; readonly details?: string }
  | { readonly kind: 'offer_expired' }
  | { readonly kind: 'offer_not_available'; readonly offerId: string }
  | { readonly kind: 'pricing_changed'; readonly offerId: string }
  | { readonly kind: 'guarantee_changed'; readonly offerId: string }
  | { readonly kind: 'sync_required'; readonly supplierLocator?: string }
  | { readonly kind: 'mapping_failure'; readonly details: string }
  | { readonly kind: 'not_implemented'; readonly operation: string };
