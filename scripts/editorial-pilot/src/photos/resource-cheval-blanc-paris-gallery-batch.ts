/**
 * Phase 3 — full 30-image gallery for `cheval-blanc-paris`.
 *
 * Official Prismic DAM sources from chevalblanc.com (LVMH press imagery).
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot cbp:photos:plan
 *   pnpm --filter @mch/editorial-pilot cbp:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot cbp:photos:gallery
 */

import {
  CHEVAL_BLANC_PARIS_GALLERY_CDC_CATEGORIES,
  CHEVAL_BLANC_PARIS_GALLERY_IMAGES,
  CHEVAL_BLANC_PARIS_GALLERY_SOURCE_URLS,
  CHEVAL_BLANC_PARIS_HERO_IMAGE,
  CHEVAL_BLANC_PARIS_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'cheval-blanc-paris';
const LOG = 'cbp-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: CHEVAL_BLANC_PARIS_HERO_IMAGE,
    heroSourceUrl: CHEVAL_BLANC_PARIS_HERO_SOURCE_URL,
    heroAltFr: 'Vue du Cheval Blanc Paris et du Pont Neuf depuis la Seine',
    heroAltEn: 'View of Cheval Blanc Paris and Pont Neuf from the Seine',
    galleryImages: CHEVAL_BLANC_PARIS_GALLERY_IMAGES,
    gallerySourceUrls: CHEVAL_BLANC_PARIS_GALLERY_SOURCE_URLS,
    cdcCategories: CHEVAL_BLANC_PARIS_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['cheval-blanc-paris-gallery-2026'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
