export const TRAVELPORT_STAY_EVENT = 'mch:travelport-stay' as const;

export interface TravelportStayDetail {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
}

export function dispatchTravelportStay(detail: TravelportStayDetail): void {
  window.dispatchEvent(new CustomEvent(TRAVELPORT_STAY_EVENT, { detail }));
}
