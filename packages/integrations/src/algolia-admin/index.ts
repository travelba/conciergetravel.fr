/**
 * Algolia admin indexer — Payload `afterChange`, scripts, cron (skill: search-engineering).
 */
export const ALGOLIA_INTEGRATION_VERSION = '0.0.1' as const;

export { DEFAULT_CITIES_INDEX_SETTINGS } from './city-index-settings';
export type { AlgoliaIndexingError } from './errors';
export { DEFAULT_HOTELS_INDEX_SETTINGS } from './hotel-index-settings';
export {
  AlgoliaIndexingService,
  createAlgoliaIndexingService,
  type AlgoliaIndexingConfig,
} from './indexing-service';
export { citiesIndexName, hotelsIndexName, type SearchLocale } from './index-names';
export { buildCityAlgoliaRecord, popularityScore } from './map-city-record';
export { buildHotelAlgoliaRecord, priorityScore } from './map-hotel-record';
export { syncCityPublicationToAlgolia } from './sync-city';
export {
  createAlgoliaIndexingServiceFromSharedEnv,
  syncHotelPublicationToAlgolia,
} from './sync-hotel';
export {
  DEFAULT_HOTEL_SYNONYMS_EN,
  DEFAULT_HOTEL_SYNONYMS_FR,
  defaultHotelSynonyms,
  type SynonymEntry,
} from './synonyms';
export {
  AlgoliaCityRecordSchema,
  AlgoliaHotelRecordSchema,
  CitySourceRowSchema,
  HotelSourceRowSchema,
  type AlgoliaCityRecord,
  type AlgoliaHotelRecord,
  type CitySourceRow,
  type HotelSourceRow,
} from './types';
