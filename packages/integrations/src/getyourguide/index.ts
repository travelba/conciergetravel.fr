/**
 * GetYourGuide Partner API integration (skill: api-integration).
 *
 * Reseller model: we pull GYG's catalogue and monetise via affiliate
 * deeplinks (Palier A). Booking through the API (Palier B) is out of
 * scope until Phase 6.
 */
export const GETYOURGUIDE_INTEGRATION_VERSION = '0.0.1' as const;

export type { GetYourGuideError } from './errors';
export {
  searchGygToursByCoords,
  getYourGuideConfigFromSharedEnv,
  type GetYourGuideClientConfig,
} from './client';
export { buildGygDeeplink } from './deeplink';
export { parseGygSearchResponse } from './parse';
export {
  GygSearchInputSchema,
  GygSearchResponseSchema,
  GygRawTourSchema,
  type GygSearchInput,
  type ParsedGygTour,
} from './types';
