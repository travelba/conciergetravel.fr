import 'server-only';

import { buildCloudinarySrc } from '@mch/ui';

import type { LocalisedGalleryImage } from '@/server/hotels/get-hotel-by-slug';

import { isAirellesKitSlug, KIT_GENERIC_ASSETS } from './kit-generic-assets';

export interface KitMediaTile {
  readonly src: string;
  readonly alt: string;
}

const KIT_DINING_STATIC: Record<string, string> = {
  'clover gordes': '/kit/airelles/resto-clover.jpg',
  'la table de la bastide': '/kit/airelles/resto-table-bastide.jpg',
  'le brunch du dimanche': '/kit/airelles/resto-brunch.jpg',
  'la bastide de pierres': '/kit/airelles/resto-bastide-pierres.jpg',
  ladurée: '/kit/airelles/resto-laduree.jpg',
  laduree: '/kit/airelles/resto-laduree.jpg',
  'beefbar gordes': '/kit/airelles/resto-beefbar.jpg',
};

const KIT_DINING_ORDER = [
  '/kit/airelles/resto-clover.jpg',
  '/kit/airelles/resto-table-bastide.jpg',
  '/kit/airelles/resto-brunch.jpg',
  '/kit/airelles/resto-bastide-pierres.jpg',
  '/kit/airelles/resto-laduree.jpg',
  '/kit/airelles/resto-beefbar.jpg',
] as const;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toCloudinaryTile(
  cloudName: string,
  img: LocalisedGalleryImage,
  transforms: string,
): KitMediaTile {
  return {
    src: buildCloudinarySrc({ cloudName, publicId: img.publicId, transforms }),
    alt: img.alt,
  };
}

function staticTile(src: string, alt: string): KitMediaTile {
  return { src, alt };
}

export interface KitMediaResolver {
  spaHero(defaultAlt: string): KitMediaTile;
  diningForVenue(venueName: string, index: number, defaultAlt: string): KitMediaTile;
  kidClub(defaultAlt: string): KitMediaTile;
  experienceAt(index: number, defaultAlt: string): KitMediaTile;
}

export function createKitMediaResolver(
  cloudName: string,
  gallery: readonly LocalisedGalleryImage[],
  hotelName: string,
  slugFr: string,
): KitMediaResolver {
  const airelles = isAirellesKitSlug(slugFr);
  const byCategory = (category: string): readonly LocalisedGalleryImage[] =>
    gallery.filter((g) => g.category?.toLowerCase() === category);

  const diningGallery = byCategory('dining');
  const poolGallery = byCategory('pool');
  const expGallery = gallery.filter((g) => {
    const cat = g.category?.toLowerCase() ?? '';
    return cat === 'view' || cat === 'exterior' || cat === 'pool';
  });

  const pickGalleryByAlt = (
    images: readonly LocalisedGalleryImage[],
    pattern: RegExp,
  ): LocalisedGalleryImage | undefined => images.find((g) => pattern.test(g.alt));

  return {
    spaHero(defaultAlt) {
      const spaGallery = byCategory('spa');
      const wellnessPattern =
        /wellness suite|calma|hammam|salle de soin|treatment room|spa suite|rituel/i;
      const wellnessInSpa = pickGalleryByAlt(spaGallery, wellnessPattern);
      if (wellnessInSpa !== undefined) {
        return toCloudinaryTile(
          cloudName,
          wellnessInSpa,
          'f_auto,q_auto,c_fill,g_auto,w_900,h_675',
        );
      }
      const wellnessInPool = pickGalleryByAlt(poolGallery, wellnessPattern);
      if (wellnessInPool !== undefined) {
        return toCloudinaryTile(
          cloudName,
          wellnessInPool,
          'f_auto,q_auto,c_fill,g_auto,w_900,h_675',
        );
      }
      const spaImg = spaGallery[0];
      if (spaImg !== undefined) {
        return toCloudinaryTile(cloudName, spaImg, 'f_auto,q_auto,c_fill,g_auto,w_900,h_675');
      }
      if (airelles) {
        // `press-21` was overwritten by a room upload — Airelles kit static is canonical.
        return staticTile('/kit/airelles/spa-piscine.jpg', defaultAlt || `${hotelName} — spa`);
      }
      return staticTile(KIT_GENERIC_ASSETS.spa, defaultAlt || `${hotelName} — spa`);
    },

    diningForVenue(venueName, index, defaultAlt) {
      const key = normalizeName(venueName);
      const staticPath = KIT_DINING_STATIC[key];
      if (staticPath !== undefined) {
        return staticTile(staticPath, defaultAlt || venueName);
      }
      const diningImg = diningGallery[index];
      if (diningImg !== undefined) {
        return toCloudinaryTile(cloudName, diningImg, 'f_auto,q_auto,c_fill,g_auto,w_700,h_525');
      }
      if (airelles) {
        const fallback = KIT_DINING_ORDER[index % KIT_DINING_ORDER.length] ?? KIT_DINING_ORDER[0];
        return staticTile(fallback, defaultAlt || venueName);
      }
      return staticTile(KIT_GENERIC_ASSETS.dining, defaultAlt || venueName);
    },

    kidClub(defaultAlt) {
      const kidsPool = pickGalleryByAlt(poolGallery, /kids club|enfants|children.?only|familial/i);
      if (kidsPool !== undefined) {
        return toCloudinaryTile(cloudName, kidsPool, 'f_auto,q_auto,c_fill,g_auto,w_900,h_675');
      }
      if (airelles) {
        return staticTile(
          '/kit/airelles/kids-piscine.jpg',
          defaultAlt || `${hotelName} — kids club`,
        );
      }
      return staticTile(KIT_GENERIC_ASSETS.experience[0], defaultAlt || `${hotelName} — kids club`);
    },

    experienceAt(index, defaultAlt) {
      const img = expGallery[index % Math.max(expGallery.length, 1)];
      if (img !== undefined) {
        return toCloudinaryTile(cloudName, img, 'f_auto,q_auto,c_fill,g_auto,w_700,h_525');
      }
      const fallbacks = airelles
        ? ([
            '/kit/airelles/velo-village.jpg',
            '/kit/airelles/constance-jardin.jpg',
            '/kit/airelles/piscine-terrasse.jpg',
          ] as const)
        : KIT_GENERIC_ASSETS.experience;
      const fb = fallbacks[index % fallbacks.length] ?? fallbacks[0];
      return staticTile(fb, defaultAlt);
    },
  };
}
