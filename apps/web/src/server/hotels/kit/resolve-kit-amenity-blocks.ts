import 'server-only';

import { PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS } from '@mch/domain/editorial';

import { AIRELLES_KIT_AMENITY_BLOCKS, type AirellesKitAmenityBlock } from './kit-airelles-display';

export type KitAmenityBlock = AirellesKitAmenityBlock;

/** Brand-specific curated blocks for `#hotel-en-bref` amenity grid. */
export function resolveKitAmenityBlocks(slugFr: string): readonly KitAmenityBlock[] {
  switch (slugFr) {
    case 'les-airelles-gordes':
      return AIRELLES_KIT_AMENITY_BLOCKS;
    case 'prince-de-galles-paris':
      return PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS;
    default:
      return [];
  }
}
