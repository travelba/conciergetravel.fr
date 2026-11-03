import 'server-only';

import { unstable_cache } from 'next/cache';
import { cache } from 'react';

import { selectGoogleReviewsForAccesWithApiCapFallback } from '@mch/domain/reviews';
import { isToxicOfficialUrl } from '@mch/domain/url';
import { parseAffiliationsLenient, type HotelAffiliation } from '@mch/db';
import { z } from 'zod';

import { pickByLocale, pickLocalizedText, type SupportedLocale } from '@/i18n/supported-locale';
import { mergeRoomGalleryImages } from '@/lib/hotel/sort-room-display-images';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  AMENITY_CATEGORIES,
  amenityOrder,
  categorizeAmenity,
  categoryOrder,
  isPremiumAmenity,
  type AmenityCategory,
} from '@/server/hotels/amenity-taxonomy';
import { getFakeHotelDetailBySlug } from '@/server/hotels/dev-fake-hotel-detail';
import {
  applyAirellesLocalOverride,
  isAirellesLocalOverrideEnabled,
} from '@/server/hotels/dev-override-airelles';
import { enrichAirellesRooms, isAirellesHotelSlug } from '@/server/hotels/enrich-airelles-rooms';

export type { SupportedLocale };

const BookingModeSchema = z.enum(['amadeus', 'little', 'travelport', 'email', 'display_only']);
const PrioritySchema = z.enum(['P0', 'P1', 'P2']);

const stringOrEmpty = z
  .string()
  .nullish()
  .transform((v) => (typeof v === 'string' ? v : null));

const numberOrNull = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
