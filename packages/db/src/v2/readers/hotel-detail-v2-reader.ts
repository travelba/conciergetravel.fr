import type { SupabaseClient } from '@supabase/supabase-js';

import { parseHotelDetailV2, type HotelDetailV2 } from '../hotel-detail-v2';
import { v2ReadErr, type V2ReadResult } from '../read-result';

const HOTEL_DETAIL_V2_COLUMNS = [
  'id',
  'slug',
  'slug_en',
  'name',
  'name_en',
  'city',
  'country_code',
  'stars',
  'hero_image',
  'rating_score',
  'rating_count',
  'luxury_tier',
  'price_hint',
  'amenities_facet',
  'description_fr',
  'description_en',
  'factual_summary_fr',
  'factual_summary_en',
  'faq_content',
  'policies',
  'gallery_images',
  'concierge_advice',
  'long_description_sections',
  'meta_desc_fr',
  'meta_desc_en',
  'affiliations',
  'region',
  'district',
  'address',
  'latitude',
  'longitude',
  'booking_mode',
  'updated_at',
].join(', ');

export type FetchHotelDetailV2BySlugOptions = {
  readonly slug: string;
};

export async function fetchHotelDetailV2BySlug(
  client: SupabaseClient,
  options: FetchHotelDetailV2BySlugOptions,
): Promise<V2ReadResult<HotelDetailV2>> {
  const { data, error } = await client
    .schema('v2')
    .from('hotel_detail_v2')
    .select(HOTEL_DETAIL_V2_COLUMNS)
    .eq('slug', options.slug)
    .maybeSingle();

  if (error) {
    return v2ReadErr({ kind: 'query_error', message: error.message });
  }

  if (data === null) {
    return v2ReadErr({ kind: 'not_found' });
  }

  return parseHotelDetailV2(data);
}
