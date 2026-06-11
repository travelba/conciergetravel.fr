/**
 * Phase 3 — full 30-image gallery for `shangri-la-paris`.
 *
 * Metadata + source URLs in `@mch/domain` (`SHANGRI_LA_PARIS_GALLERY_*`).
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot slp:photos:plan
 *   pnpm --filter @mch/editorial-pilot slp:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot slp:photos:gallery
 */

import {
  SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES,
  SHANGRI_LA_PARIS_GALLERY_IMAGES,
  SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
  SHANGRI_LA_PARIS_HERO_IMAGE,
  SHANGRI_LA_PARIS_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'shangri-la-paris';
const LOG = 'slp-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: SHANGRI_LA_PARIS_HERO_IMAGE,
    heroSourceUrl: SHANGRI_LA_PARIS_HERO_SOURCE_URL,
    heroAltFr: 'Façade haussmannienne du Shangri-La Paris, ancien Palais d’Iéna — vue d’ensemble',
    heroAltEn: 'Haussmann facade of Shangri-La Paris, former Palais d’Iéna — property overview',
    galleryImages: SHANGRI_LA_PARIS_GALLERY_IMAGES,
    gallerySourceUrls: SHANGRI_LA_PARIS_GALLERY_SOURCE_URLS,
    cdcCategories: SHANGRI_LA_PARIS_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['shangri-la-paris-gallery-2026'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
