/**
 * Phase 3 — full 30-image gallery for `le-bristol-paris`.
 *
 * Metadata + source URLs in `@mch/domain` (`LE_BRISTOL_PARIS_GALLERY_*`).
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot bristol:photos:plan
 *   pnpm --filter @mch/editorial-pilot bristol:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot bristol:photos:gallery
 */

import {
  LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES,
  LE_BRISTOL_PARIS_GALLERY_IMAGES,
  LE_BRISTOL_PARIS_GALLERY_SOURCE_URLS,
  LE_BRISTOL_PARIS_HERO_IMAGE,
  LE_BRISTOL_PARIS_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'le-bristol-paris';
const LOG = 'bristol-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: LE_BRISTOL_PARIS_HERO_IMAGE,
    heroSourceUrl: LE_BRISTOL_PARIS_HERO_SOURCE_URL,
    heroAltFr: 'Façade du Le Bristol Paris côté jardin à la française, vue d’ensemble',
    heroAltEn: 'Le Bristol Paris facade facing the French garden — property overview',
    galleryImages: LE_BRISTOL_PARIS_GALLERY_IMAGES,
    gallerySourceUrls: LE_BRISTOL_PARIS_GALLERY_SOURCE_URLS,
    cdcCategories: LE_BRISTOL_PARIS_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['le-bristol-paris-gallery-2026'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
