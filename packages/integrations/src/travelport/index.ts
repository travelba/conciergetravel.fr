export type { TravelportError } from './errors';
export { getTravelportAccessToken, type TravelportOAuthConfig } from './oauth-token';
export {
  searchByCoordinates,
  searchByProperty,
  uniqueProperties,
  authorizedJsonRequest,
  mapTravelportErrorBody,
  type TravelportCredentials,
  type AuthorizedRequestInit,
} from './travelport-client';
export { travelportOfferToDomain } from './map-offer';
export {
  getPropertyOffering,
  type PropertyOffering,
  type PropertyOfferingInput,
} from './availability';
export {
  createReservation,
  cancelReservation,
  type ReservationConfirmation,
  type CreateReservationOptions,
} from './reservation';
export {
  matchHotel,
  normalizeName,
  haversineMeters,
  type CatalogHotel,
  type CatalogMatch,
  type MatchConfidence,
} from './match-catalog';
export type {
  PropertyItem,
  PropertyKey,
  SearchByCoordinatesInput,
  SearchByPropertyInput,
  SearchCompleteResponse,
  TravelportAvailableRate,
  TravelportRateTerms,
  TravelportRoomType,
  TravelportRoomCharacteristics,
  TravelportImage,
  TravelportAmenity,
  TravelportRating,
  CreateReservationInput,
  ReservationGuestInput,
  ReservationCardInput,
  ReservationResponse,
} from './types';
