export {
  AmenitiesFacetSchema,
  HotelCardV2Schema,
  parseHotelCardV2,
  type AmenitiesFacet,
  type HotelCardV2,
} from './hotel-card-v2';

export { HotelDetailV2Schema, parseHotelDetailV2, type HotelDetailV2 } from './hotel-detail-v2';

export { RankingCardV2Schema, parseRankingCardV2, type RankingCardV2 } from './ranking-card-v2';

export {
  formatZodIssues,
  v2ReadErr,
  v2ReadOk,
  type V2ReadError,
  type V2ReadResult,
} from './read-result';

export {
  fetchHotelCardV2BySlug,
  fetchHotelCardsV2ByCity,
  type FetchHotelCardV2BySlugOptions,
  type FetchHotelCardsV2ByCityOptions,
} from './readers/hotel-card-v2-reader';

export {
  fetchHotelDetailV2BySlug,
  type FetchHotelDetailV2BySlugOptions,
} from './readers/hotel-detail-v2-reader';
