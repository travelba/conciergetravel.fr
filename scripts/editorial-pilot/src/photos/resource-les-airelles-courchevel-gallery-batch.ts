/**
 * Phase 3 — full 30-image gallery for `les-airelles-courchevel`.
 *
 * CDC §2.2-aligned batch (10 categories × 3 images). Metadata + sources in
 * `@mch/domain` (`LES_AIRELLES_COURCHEVEL_GALLERY_*`).
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:plan
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:gallery
 */

import {
  LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES,
  LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES,
  LES_AIRELLES_COURCHEVEL_GALLERY_SOURCE_URLS,
  LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
  LES_AIRELLES_COURCHEVEL_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'les-airelles-courchevel';
const LOG = 'arl-cv-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: LES_AIRELLES_COURCHEVEL_HERO_IMAGE,
    heroSourceUrl: LES_AIRELLES_COURCHEVEL_HERO_SOURCE_URL,
    heroAltFr: 'Vue aérienne de Les Airelles Courchevel, palais des neiges au Jardin Alpin',
    heroAltEn: 'Aerial view of Les Airelles Courchevel snow palace at Le Jardin Alpin',
    galleryImages: LES_AIRELLES_COURCHEVEL_GALLERY_IMAGES,
    gallerySourceUrls: LES_AIRELLES_COURCHEVEL_GALLERY_SOURCE_URLS,
    cdcCategories: LES_AIRELLES_COURCHEVEL_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['les-airelles-courchevel-gallery-2026'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
