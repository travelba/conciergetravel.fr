/**
 * Phase 1 — honest 19-image gallery for `conrad-los-angeles`.
 *
 * Sources: Hilton official DAM + Stories, Google Places re-host (real Conrad
 * pixels), and quality third-party (PO derogation 2026-06-16). Hero → dedicated
 * `hero` public_id; gallery rows carry `url` for the kit audit gates. No spa
 * slot is published (no genuine treatment-room pixel exists) — honest-gallery
 * gate (`KIT_GALLERY_MIN_SLOT_COUNT`).
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot conrad:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot conrad:photos:gallery
 */

import {
  CONRAD_LOS_ANGELES_GALLERY_CDC_CATEGORIES,
  CONRAD_LOS_ANGELES_GALLERY_IMAGES,
  CONRAD_LOS_ANGELES_GALLERY_SOURCE_URLS,
  CONRAD_LOS_ANGELES_HERO_IMAGE,
  CONRAD_LOS_ANGELES_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'conrad-los-angeles';
const LOG = 'conrad-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: CONRAD_LOS_ANGELES_HERO_IMAGE,
    heroSourceUrl: CONRAD_LOS_ANGELES_HERO_SOURCE_URL,
    heroAltFr:
      'Façade de la tour Conrad Los Angeles à The Grand LA, gratte-ciel de verre au coucher du soleil',
    heroAltEn: 'Facade of the Conrad Los Angeles tower at The Grand LA, glass high-rise at sunset',
    galleryImages: CONRAD_LOS_ANGELES_GALLERY_IMAGES,
    gallerySourceUrls: CONRAD_LOS_ANGELES_GALLERY_SOURCE_URLS,
    cdcCategories: CONRAD_LOS_ANGELES_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['conrad-los-angeles-gallery-2026', 'credit-Conrad-Los-Angeles'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
