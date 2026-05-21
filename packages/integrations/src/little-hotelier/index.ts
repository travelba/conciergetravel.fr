/**
 * Little Hotelier — vendor client (skill: little-hotelier).
 */
export const LITTLE_INTEGRATION_VERSION = '0.0.1' as const;

export type { LittleHotelierError } from './errors';
export {
  fetchLittleHotelierProperties,
  littleHotelierConfigFromSharedEnv,
  type LittleHotelierClientConfig,
} from './client';
export { normalizeLittlePropertiesList } from './types';
