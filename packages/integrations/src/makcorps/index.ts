/**
 * Makcorps Hotel Price API (skill: competitive-pricing-comparison).
 */
export const MAKCORPS_INTEGRATION_VERSION = '0.0.1' as const;

export type { MakcorpsError } from './errors';
export {
  fetchMakcorpsHotelQuotes,
  makcorpsConfigFromSharedEnv,
  type MakcorpsClientConfig,
} from './client';
export { MakcorpsHotelQuoteInputSchema, type MakcorpsHotelQuoteInput } from './types';
export { parseMakcorpsResponse, type ParsedMakcorpsEntry } from './parse';
export { resolveMakcorpsHotelId } from './mapping';
