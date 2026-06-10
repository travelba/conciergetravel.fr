export type { GiataError } from './errors';
export {
  fetchGiataPropertyById,
  fetchGiataPropertyByProviderCode,
  fetchGiataPropertyList,
  parseGiataMulticodesProperty,
  parseGiataPropertyPayload,
  searchGiataProperty,
  type GiataClientConfig,
  type GiataMulticodesClientConfig,
  type GiataPropertyListPage,
} from './client';
export {
  parseGiataMulticodesPropertiesXml,
  parseGiataMulticodesPropertyListXml,
} from './multicodes-xml';
export { buildGiataRtmLabelIndex, mapGiataRoomTypes, parseGiataRtmMapResponse } from './rtm-client';
export type {
  GiataRtmAverageRoom,
  GiataRtmClientConfig,
  GiataRtmLabelIndex,
  GiataRtmMapInput,
  GiataRtmMapResult,
  GiataRtmRoomGroup,
} from './rtm-types';
export type {
  GiataHotelMatchInput,
  GiataPropertyLookupInput,
  GiataPropertyResult,
  GiataSupplier,
  GiataSupplierPropertyRow,
} from './types';
export { GIATA_PROVIDER_TO_SUPPLIER, GiataSupplierSchema } from './types';
