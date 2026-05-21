/**
 * Amadeus GDS Self-Service — public surface (skill: amadeus-gds, api-integration).
 */
export const AMADEUS_INTEGRATION_VERSION = '0.0.1' as const;

export type { AmadeusClient, AmadeusCredentials, PricedOffer } from './amadeus-client';
export { createAmadeusClient, createAmadeusClientFromSharedEnv } from './amadeus-client';
export * from './cache-keys';
export type { AmadeusError } from './errors';
export {
  amadeusOfferToDomain,
  DEFAULT_OFFER_LOCK_SECONDS,
  type OfferMappingContext,
} from './map-offer';
export { amadeusPoliciesToCancellation } from './map-cancellation-policy';
export {
  AMADEUS_SENTIMENT_CATEGORY_KEYS,
  amadeusSentimentToAggregateRating,
  amadeusSentimentToCategoryBreakdown,
  type AmadeusAggregateRating,
  type AmadeusSentimentCategory,
  type AmadeusSentimentCategoryKey,
  type CategoryBreakdownOptions,
} from './map-sentiment';
export type { AmadeusOAuthConfig } from './oauth-token';
export { getAmadeusAccessToken } from './oauth-token';
export * from './types';
