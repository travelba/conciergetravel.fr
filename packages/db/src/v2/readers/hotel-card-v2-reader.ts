import type { SupabaseClient } from '@supabase/supabase-js';

import { parseHotelCardV2, type HotelCardV2 } from '../hotel-card-v2';
import { v2ReadErr, type V2ReadResult } from '../read-result';

const HOTEL_CARD_V2_COLUMNS =
  'id, slug, slug_en, name, name_en, city, country_code, stars, hero_image, rating_score, rating_count, luxury_tier, price_hint, amenities_facet';

export type FetchHotelCardV2BySlugOptions = {
  readonly slug: string;
};

export async function fetchHotelCardV2BySlug(
  client: SupabaseClient,
  options: FetchHotelCardV2BySlugOptions,
): Promise<V2ReadResult<HotelCardV2>> {
  const { data, error } = await client
    .schema('v2')
    .from('hotel_card_v2')
    .select(HOTEL_CARD_V2_COLUMNS)
    .eq('slug', options.slug)
    .maybeSingle();

  if (error) {
    return v2ReadErr({ kind: 'query_error', message: error.message });
  }

  if (data === null) {
    return v2ReadErr({ kind: 'not_found' });
  }

  return parseHotelCardV2(data);
}

export type FetchHotelCardsV2ByCityOptions = {
  readonly countryCode: string;
  readonly city: string;
  readonly limit?: number;
};

export async function fetchHotelCardsV2ByCity(
  client: SupabaseClient,
  options: FetchHotelCardsV2ByCityOptions,
): Promise<V2ReadResult<readonly HotelCardV2[]>> {
  const limit = options.limit ?? 50;

  const { data, error } = await client
    .schema('v2')
    .from('hotel_card_v2')
    .select(HOTEL_CARD_V2_COLUMNS)
    .eq('country_code', options.countryCode)
    .eq('city', options.city)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    return v2ReadErr({ kind: 'query_error', message: error.message });
  }

  const rows: HotelCardV2[] = [];
  for (const row of data ?? []) {
    const parsed = parseHotelCardV2(row);
    if (!parsed.ok) {
      return parsed;
    }
    rows.push(parsed.value);
  }

  return { ok: true, value: rows };
}
