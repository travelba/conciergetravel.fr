/** GIATA Room Type Mapping (RTM) — staging `stagingapi.roommapping.com`. */

export interface GiataRtmClientConfig {
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
  /** When true, POST `/MapPlus` (richer bed/class metadata). Default `/Map`. */
  readonly useMapPlus?: boolean;
}

export interface GiataRtmMapInput {
  readonly giataId: string;
  readonly propertyName: string;
  /** Supplier room labels to dedupe across channels. */
  readonly roomTypes: readonly string[];
}

export interface GiataRtmBedDetail {
  readonly id: number;
  readonly single: number;
  readonly semiDouble: number;
  readonly double: number;
  readonly queen: number;
  readonly king: number;
}

/** Present on `/MapPlus` responses only. */
export interface GiataRtmAverageRoom {
  readonly type: string;
  readonly classes: readonly string[];
  readonly bedDetailDescription: string | null;
  readonly bedDetails: readonly GiataRtmBedDetail[];
  readonly accessible: boolean;
  readonly nonRefundable: boolean;
}

export interface GiataRtmRoomGroup {
  readonly groupId: number;
  readonly groupName: string;
  readonly roomTypes: readonly string[];
  readonly averageRoom?: GiataRtmAverageRoom;
}

export interface GiataRtmMapResult {
  readonly giataId: string;
  readonly propertyName: string;
  readonly groups: readonly GiataRtmRoomGroup[];
}

/** Lookup: supplier room label → canonical GIATA group. */
export interface GiataRtmLabelIndex {
  readonly groupId: number;
  readonly groupName: string;
  readonly averageRoom?: GiataRtmAverageRoom;
}
