export interface TravelportSearchClientResponse {
  readonly ok: boolean;
  readonly available?: boolean;
  readonly cached?: boolean;
  readonly reason?: string;
  readonly error?: string;
  readonly cheapestMinor?: number | null;
  readonly fromByRoomId?: Readonly<Record<string, number>>;
  readonly stay?: {
    readonly checkIn: string;
    readonly checkOut: string;
    readonly adults: number;
  };
}

export interface FetchTravelportSearchInput {
  readonly slug: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly matchRooms?: boolean;
}

export async function fetchTravelportSearch(
  input: FetchTravelportSearchInput,
): Promise<TravelportSearchClientResponse> {
  const params = new URLSearchParams({
    slug: input.slug,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: String(input.adults),
  });
  if (input.matchRooms === true) params.set('matchRooms', '1');

  const res = await fetch(`/api/travelport/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const json: unknown = await res.json();
  if (typeof json !== 'object' || json === null) {
    return { ok: false, error: 'invalid_response' };
  }
  return json as TravelportSearchClientResponse;
}
