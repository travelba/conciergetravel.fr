/**
 * Phase 3 — full 30-image gallery for `les-pres-deugenie`.
 *
 * CDC §2.2-aligned batch (10 categories × 3 images). Metadata + source URLs live in
 * `@mch/domain` (`LES_PRES_DEUGENIE_GALLERY_*`).
 *
 * Legality: official Maison Guérard media (lespresdeugenie.com/wp-content/uploads).
 * Source = `press`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot lpde:photos:gallery:dry
 *   pnpm --filter @mch/editorial-pilot lpde:photos:gallery
 */

import {
  LES_PRES_DEUGENIE_GALLERY_CDC_CATEGORIES,
  LES_PRES_DEUGENIE_GALLERY_IMAGES,
  LES_PRES_DEUGENIE_GALLERY_SOURCE_URLS,
  LES_PRES_DEUGENIE_HERO_IMAGE,
  LES_PRES_DEUGENIE_HERO_SOURCE_URL,
} from '@mch/domain/editorial';

import { runKitWaveGalleryBatch } from './run-kit-wave-gallery-batch.js';

const SLUG = 'les-pres-deugenie';
const LOG = 'lpde-gallery';

async function main(): Promise<void> {
  await runKitWaveGalleryBatch({
    slug: SLUG,
    logPrefix: LOG,
    heroImage: LES_PRES_DEUGENIE_HERO_IMAGE,
    heroSourceUrl: LES_PRES_DEUGENIE_HERO_SOURCE_URL,
    heroAltFr: 'Domaine Les Prés d’Eugénie au crépuscule, vallée des Landes — vue d’ensemble',
    heroAltEn: 'Les Prés d’Eugénie estate at dusk, Landes valley — property overview',
    galleryImages: LES_PRES_DEUGENIE_GALLERY_IMAGES,
    gallerySourceUrls: LES_PRES_DEUGENIE_GALLERY_SOURCE_URLS,
    cdcCategories: LES_PRES_DEUGENIE_GALLERY_CDC_CATEGORIES,
    extraUploadTags: ['les-pres-deugenie-gallery-2026', 'credit-Les-Pres-d-Eugenie'],
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
