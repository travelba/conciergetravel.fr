import 'server-only';

import {
  CHEVAL_BLANC_PARIS_KIT_AMENITY_BLOCKS,
  LE_BRISTOL_PARIS_KIT_AMENITY_BLOCKS,
  LES_AIRELLES_COURCHEVEL_KIT_AMENITY_BLOCKS,
  LES_PRES_DEUGENIE_KIT_AMENITY_BLOCKS,
  PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS,
  SHANGRI_LA_PARIS_KIT_AMENITY_BLOCKS,
} from '@mch/domain/editorial';

import { AIRELLES_KIT_AMENITY_BLOCKS, type AirellesKitAmenityBlock } from './kit-airelles-display';

export type KitAmenityBlock = AirellesKitAmenityBlock;

/** Brand-specific curated blocks for `#hotel-en-bref` amenity grid. */
export function resolveKitAmenityBlocks(slugFr: string): readonly KitAmenityBlock[] {
  switch (slugFr) {
    case 'les-airelles-gordes':
      return AIRELLES_KIT_AMENITY_BLOCKS;
    case 'prince-de-galles-paris':
      return PRINCE_DE_GALLES_KIT_AMENITY_BLOCKS;
    case 'cheval-blanc-paris':
      return CHEVAL_BLANC_PARIS_KIT_AMENITY_BLOCKS;
    case 'le-bristol-paris':
      return LE_BRISTOL_PARIS_KIT_AMENITY_BLOCKS;
    case 'les-airelles-courchevel':
      return LES_AIRELLES_COURCHEVEL_KIT_AMENITY_BLOCKS;
    case 'les-pres-deugenie':
      return LES_PRES_DEUGENIE_KIT_AMENITY_BLOCKS;
    case 'shangri-la-paris':
      return SHANGRI_LA_PARIS_KIT_AMENITY_BLOCKS;
    default:
      return [];
  }
}
