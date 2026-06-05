/**
 * RateHawk / Emerging Travel Group (worldota) — vendor client + connector.
 */
export const RATEHAWK_INTEGRATION_VERSION = '0.1.0' as const;

export type { RateHawkError } from './errors';
export {
  searchHotelPage,
  fetchHotelContent,
  rateHawkConfigFromSharedEnv,
  type RateHawkClientConfig,
  type RateHawkStay,
} from './client';
export {
  rgExtKey,
  type RgExt,
  type RateHawkHpRate,
  type RateHawkRoomGroup,
  type RateHawkHotelPageResponse,
  type RateHawkHotelContentResponse,
} from './types';
export { createRateHawkConnector } from './connector';
export {
  prebook,
  book,
  cancel,
  type RateHawkPrebookResult,
  type RateHawkBookInput,
  type RateHawkBookResult,
  type RateHawkCancelResult,
  type RateHawkGuest,
} from './booking';
