import 'server-only';

import { buildAirellesGoldenFields } from '@mch/domain/editorial';

import type { HotelDetailRow } from '@/server/hotels/get-hotel-by-slug';

import { isHotelKitSlug } from './is-hotel-kit-slug';

type GoldenFieldsBuilder = (current: {
  readonly description_fr: unknown;
  readonly description_en: unknown;
  readonly awards: unknown;
  readonly amenities: unknown;
  readonly spa_info: unknown;
  readonly policies: unknown;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
}) => Record<string, unknown>;

const GOLDEN_BUILDERS: Readonly<Record<string, GoldenFieldsBuilder>> = {
  'les-airelles-gordes': buildAirellesGoldenFields,
};

/** EN kit slugs share the FR golden payload builder. */
const GOLDEN_BUILDER_ALIASES: Readonly<Record<string, keyof typeof GOLDEN_BUILDERS>> = {
  'les-airelles-gordes-en': 'les-airelles-gordes',
};

function resolveGoldenBuilder(slug: string): GoldenFieldsBuilder | null {
  const key = GOLDEN_BUILDER_ALIASES[slug] ?? slug;
  return GOLDEN_BUILDERS[key] ?? null;
}

function mergeGoldenRow(row: HotelDetailRow, golden: Record<string, unknown>): HotelDetailRow {
  return {
    ...row,
    highlights: golden['highlights'] as HotelDetailRow['highlights'],
    faq_content: golden['faq_content'] as HotelDetailRow['faq_content'],
    restaurant_info: golden['restaurant_info'] as HotelDetailRow['restaurant_info'],
    points_of_interest: golden['points_of_interest'] as HotelDetailRow['points_of_interest'],
    concierge_advice: golden['concierge_advice'] as HotelDetailRow['concierge_advice'],
    instagram: golden['instagram'] as HotelDetailRow['instagram'],
    policies: golden['policies'] as HotelDetailRow['policies'],
    awards: golden['awards'] as HotelDetailRow['awards'],
    amenities: golden['amenities'] as HotelDetailRow['amenities'],
    spa_info: golden['spa_info'] as HotelDetailRow['spa_info'],
    signature_experiences: golden[
      'signature_experiences'
    ] as HotelDetailRow['signature_experiences'],
    featured_reviews: golden['featured_reviews'] as HotelDetailRow['featured_reviews'],
    upcoming_events: golden['upcoming_events'] as HotelDetailRow['upcoming_events'],
    long_description_sections: golden[
      'long_description_sections'
    ] as HotelDetailRow['long_description_sections'],
    description_fr: golden['description_fr'] as string,
    description_en: golden['description_en'] as string,
    factual_summary_fr: golden['factual_summary_fr'] as string,
    factual_summary_en: golden['factual_summary_en'] as string,
    meta_desc_fr: golden['meta_desc_fr'] as string,
    meta_desc_en: golden['meta_desc_en'] as string,
    meta_title_fr: golden['meta_title_fr'] as string,
    meta_title_en: golden['meta_title_en'] as string,
    hero_image: golden['hero_image'] as string,
    gallery_images: golden['gallery_images'] as HotelDetailRow['gallery_images'],
    external_sources: golden['external_sources'] as HotelDetailRow['external_sources'],
    phone_e164: golden['phone_e164'] as string,
    address: golden['address'] as string,
    postal_code: golden['postal_code'] as string,
    email_reservations: golden['email_reservations'] as string,
    concierge_pick: golden['concierge_pick'] as HotelDetailRow['concierge_pick'],
    concierge_hook: golden['concierge_hook'] as HotelDetailRow['concierge_hook'],
  };
}

/**
 * Merge the golden editorial payload for kit pilot slugs so the DA renderer
 * always has complete restaurants, spa, POI, FAQ, photos, etc. — independent
 * of `MCH_LOCAL_FIXTURE` (prod preview must match the reference).
 */
export function patchKitGoldenRow(row: HotelDetailRow): HotelDetailRow {
  const slug = isHotelKitSlug(row.slug)
    ? row.slug
    : row.slug_en !== null && isHotelKitSlug(row.slug_en)
      ? row.slug_en
      : null;
  if (slug === null) return row;

  const build = resolveGoldenBuilder(slug);
  if (build === null) return row;

  const golden = build({
    description_fr: row.description_fr,
    description_en: row.description_en,
    awards: row.awards,
    amenities: row.amenities,
    spa_info: row.spa_info,
    policies: row.policies,
    long_description_sections: row.long_description_sections,
    signature_experiences: row.signature_experiences,
  });

  return mergeGoldenRow(row, golden);
}

/** @deprecated Use {@link patchKitGoldenRow} */
export const patchKitPilotRow = patchKitGoldenRow;
