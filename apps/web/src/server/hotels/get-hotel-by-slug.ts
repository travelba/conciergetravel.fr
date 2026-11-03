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
