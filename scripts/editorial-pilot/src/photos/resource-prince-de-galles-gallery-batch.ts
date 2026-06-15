/**
 * Phase 3 — full 30-image gallery for `prince-de-galles-paris`.
 *
 * Official Marriott DAM sources (PARLC). Hero → dedicated `hero` public_id;
 * gallery rows carry `url` for kit audit gates.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot pdg:photos:plan
 *   pnpm --filter @mch/editorial-pilot pdg:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot pdg:photos:gallery
 */

import {
  PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES,
  PRINCE_DE_GALLES_GALLERY_IMAGES,
  PRINCE_DE_GALLES_GALLERY_SOURCE_URLS,
  PRINCE_DE_GALLES_HERO_IMAGE,
  PRINCE_DE_GALLES_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'prince-de-galles-paris';
const LOG = 'pdg-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: PRINCE_DE_GALLES_HERO_IMAGE,
    heroSourceUrl: PRINCE_DE_GALLES_HERO_SOURCE_URL,
    heroAltFr: 'Façade Art déco du Prince de Galles, avenue George V, Paris',
    heroAltEn: 'Art Deco facade of Prince de Galles on Avenue George V, Paris',
    galleryImages: PRINCE_DE_GALLES_GALLERY_IMAGES,
    gallerySourceUrls: PRINCE_DE_GALLES_GALLERY_SOURCE_URLS,
    cdcCategories: PRINCE_DE_GALLES_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['prince-de-galles-gallery-2026', 'credit-Marriott-Prince-de-Galles'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
