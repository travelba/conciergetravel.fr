import 'server-only';

import {
  AIRELLES_CONCIERGE_HOOK,
  AIRELLES_CONCIERGE_PICK_NOTE,
  AIRELLES_CONCIERGE_PICK_SLUG,
  AIRELLES_ROOM_CATALOG,
  buildAirellesGoldenFields,
} from '@mch/domain/editorial';

import { enrichAirellesRoomRow } from '@/server/hotels/enrich-airelles-rooms';
import type { HotelDetail, HotelRoomRow, SupportedLocale } from '@/server/hotels/get-hotel-by-slug';

/**
 * LOCAL-ONLY editorial override for the Airelles Gordes (La Bastide) hotel
 * fiche — the "golden template" sandbox.
 *
 * ⚠ This module NEVER writes to Supabase. It is a post-fetch, field-level
 * patch applied to the *real* row returned by `getHotelBySlug`, gated
 * exclusively by the `MCH_LOCAL_FIXTURE` env flag. Production builds (flag
 * unset) are unaffected — the branch is dead code at runtime.
 *
 * The golden CONTENT (restaurants, POIs, spa, FAQ, concierge blocks, …) now
 * lives in `@mch/domain/editorial` (`airelles-golden.ts`) as the single
 * source of truth, shared with the catalogue promotion script
 * (`@mch/editorial-pilot` → `promote-airelles-golden.ts`). This file only
 * keeps the web-specific glue: slug/flag helpers, the un-seeded rooms preview
 * and the post-fetch patch wiring.
 */

export const AIRELLES_OVERRIDE_SLUGS = ['les-airelles-gordes', 'les-airelles-gordes-en'] as const;

// Re-exported for the hotel page (rooms grid concierge pick + hero accroche).
export { AIRELLES_CONCIERGE_PICK_SLUG, AIRELLES_CONCIERGE_PICK_NOTE, AIRELLES_CONCIERGE_HOOK };

export function isAirellesLocalOverrideEnabled(): boolean {
  const raw = process.env['MCH_LOCAL_FIXTURE'];
  return typeof raw === 'string' && raw.trim().length > 0;
}

function isAirellesSlug(slug: string): boolean {
  return (AIRELLES_OVERRIDE_SLUGS as readonly string[]).includes(slug);
}

/**
 * True when the request targets the Airelles Gordes golden template AND the
 * local-fixture sandbox is enabled. Used by the hotel page to opt this single
 * fiche into the full-bleed overlay hero before the design is rolled out
 * catalogue-wide. Off (classic hero) for every other slug and in production.
 */
export function isAirellesGoldenTemplate(slug: string): boolean {
  return isAirellesLocalOverrideEnabled() && isAirellesSlug(slug);
}

// ---------------------------------------------------------------------------
// Rooms — the 12 official categories (40 rooms & suites total).
// Subpage links may 404 in the local sandbox (rooms not seeded); the section
// is rendered to visualise the catalogue, not to navigate.
// ---------------------------------------------------------------------------

/** Indicative nightly anchors (EUR minor units) for the local sandbox rail. */
const LOCAL_PRICE_BY_CODE: Readonly<Record<string, number>> = {
  'superieure-village': 54000,
  'deluxe-village': 79000,
  'superieure-vallee': 85000,
  'deluxe-vallee': 95000,
  'junior-suite': 120000,
  'junior-suite-prestige': 145000,
  'suite-une-chambre': 170000,
  'suite-une-chambre-terrasse': 195000,
  'vasarely-suite': 240000,
  'suite-baron-de-simiane': 260000,
  'suite-duc-de-soubise': 290000,
  'maison-de-constance': 650000,
};

function buildRooms(locale: SupportedLocale): HotelRoomRow[] {
  const isFr = locale === 'fr';
  return AIRELLES_ROOM_CATALOG.map((entry, index) =>
    enrichAirellesRoomRow(
      {
        id: `airelles-${entry.room_code}`,
        slug: entry.slug,
        room_code: entry.room_code,
        name: isFr ? entry.name_fr : entry.name_en,
        description: isFr ? entry.description_fr : entry.description_en,
        max_occupancy: entry.max_occupancy,
        bed_type: isFr ? entry.bed_type_fr : entry.bed_type_en,
        size_sqm: entry.size_sqm,
        amenities: [],
        isSignature: entry.is_signature === true,
        indicativePrice:
          LOCAL_PRICE_BY_CODE[entry.room_code] !== undefined
            ? {
                fromMinor: LOCAL_PRICE_BY_CODE[entry.room_code] as number,
                toMinor: null,
                currency: 'EUR',
              }
            : null,
        displayOrder: entry.display_order ?? index,
        cardImagePublicId: entry.hero_image,
        cardImageAlt: isFr ? entry.hero_alt_fr : entry.hero_alt_en,
        galleryImages: [
          {
            publicId: entry.hero_image,
            alt: isFr ? entry.hero_alt_fr : entry.hero_alt_en,
          },
        ],
      },
      locale,
    ),
  );
}

// ---------------------------------------------------------------------------
// Public entry — applies the field-level patch to the real detail.
// ---------------------------------------------------------------------------

export function applyAirellesLocalOverride(
  detail: HotelDetail,
  locale: SupportedLocale,
): HotelDetail {
  if (!isAirellesSlug(detail.row.slug) && !isAirellesSlug(detail.row.slug_en ?? '')) {
    return detail;
  }

  const golden = buildAirellesGoldenFields({
    description_fr: detail.row.description_fr,
    description_en: detail.row.description_en,
    awards: detail.row.awards,
    amenities: detail.row.amenities,
    spa_info: detail.row.spa_info,
    policies: detail.row.policies,
    long_description_sections: detail.row.long_description_sections,
    signature_experiences: detail.row.signature_experiences,
  });

  const patchedRow = { ...detail.row, ...golden };

  return {
    row: patchedRow,
    rooms: buildRooms(locale),
  };
}
