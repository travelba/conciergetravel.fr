/**
 * Full 22-image gallery for `les-airelles-gordes` — PO-curated press batch.
 *
 * Hero stays on the official Imgix drone frame (≥ 2400 px). Gallery items
 * that overlap the previous 12-image set are re-sourced from Imgix when
 * possible; net-new subjects (Kids Club pool, Beefbar, Ladurée, Suite
 * Vasarely, …) upload from the local press drop in
 * `data/press/les-airelles-gordes/`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/upload-airelles-gordes-gallery.ts --dry-run
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/upload-airelles-gordes-gallery.ts
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  configureCloudinary,
  uploadFromLocalFile,
  uploadFromUrl,
} from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SLUG = 'les-airelles-gordes';
const IMGIX_PREFIX = 'https://assets.airelles.com/images/airelles2023/';
const IMGIX_SUFFIX = '?auto=format%2Ccompress&w=2600';
const LOCAL_DIR = resolve(__dirname, '../../data/press/les-airelles-gordes');

interface GalleryImageDef {
  readonly category: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly captionFr: string;
  readonly captionEn: string;
  readonly credit: string;
  readonly isHero?: boolean;
  readonly imgixFile?: string;
  readonly localFile?: string;
}

const GALLERY: readonly GalleryImageDef[] = [
  {
    imgixFile:
      'ZpD4LR5LeNNTxF8x_LaBastide-Hotel&Jardin-Drone-overview-topshot2\u00a9HiddenCliff-2024.jpg',
    category: 'exterior',
    altFr: 'Vue aérienne de la bastide Airelles Gordes et de ses jardins, Gordes',
    altEn: 'Aerial view of the Airelles Gordes bastide and its gardens, Gordes',
    captionFr:
      'La bastide du XVIIIe siècle et ses jardins en terrasses dominent le village perché de Gordes, dans le Luberon.',
    captionEn:
      'The 18th-century bastide and its terraced gardens overlook the hilltop village of Gordes, in the Luberon.',
    credit: 'HiddenCliff',
    isHero: true,
  },
  {
    imgixFile: 'ZqDwCx5LeNNTxdMQ_LaBastide-Hotel-Entr\u00e9e\u00a9HiddenCliff-2024.jpg',
    category: 'exterior',
    altFr: 'Entrée en pierre de la bastide Airelles Gordes, Gordes',
    altEn: 'Stone entrance of the Airelles Gordes bastide, Gordes',
    captionFr:
      'L’entrée en pierre dorée de La Bastide, restaurée par 150 artisans lors de la réouverture de 2015.',
    captionEn:
      'The golden-stone entrance of La Bastide, restored by 150 craftspeople for its 2015 reopening.',
    credit: 'HiddenCliff',
  },
  {
    imgixFile: 'Zlcy4aWtHYXtT5n7_BDG-Lieuxcommuns-R\u00e9ception.jpg',
    category: 'lobby',
    altFr: 'Salon de réception provençal de l’Airelles Gordes, Gordes',
    altEn: 'Provençal reception lounge at Airelles Gordes, Gordes',
    captionFr:
      'Le salon de réception mêle mobilier d’époque et lumière de Provence sous les voûtes de La Bastide.',
    captionEn:
      'The reception lounge blends period furniture with Provençal light beneath the vaults of La Bastide.',
    credit: 'Airelles',
  },
  {
    localFile: 'club-concierge.png',
    category: 'concierge',
    altFr: 'Club Concierge et salon rouge de l’Airelles Gordes, Gordes',
    altEn: 'Concierge Club and red lounge at Airelles Gordes, Gordes',
    captionFr:
      'Le Club Concierge accueille les membres dans un salon rouge aux boiseries peintes et livres anciens.',
    captionEn:
      'The Concierge Club welcomes members in a red lounge with painted woodwork and antique books.',
    credit: 'Airelles',
  },
  {
    imgixFile:
      'ZpD4LB5LeNNTxF8w_LaBastide-Exp\u00e9rience-Balade\u00e0v\u00e9los-VillagedeGordes-\u00a9HiddenCliff-2024.jpg',
    category: 'view',
    altFr: 'Balade à vélo vers le village perché de Gordes depuis l’Airelles Gordes',
    altEn: 'Cycling toward the hilltop village of Gordes from Airelles Gordes',
    captionFr:
      'Le village perché de Gordes, à dix minutes de La Bastide, classé parmi les plus beaux villages de France.',
    captionEn:
      'The hilltop village of Gordes, ten minutes from La Bastide, ranks among France’s most beautiful villages.',
    credit: 'HiddenCliff',
  },
  {
    localFile: 'constance-jardin.png',
    category: 'view',
    altFr: 'Jardins de la bastide Airelles Gordes face au Luberon, Gordes',
    altEn: 'Airelles Gordes bastide gardens facing the Luberon, Gordes',
    captionFr:
      'Les jardins en terrasses de La Bastide ouvrent sur la vallée du Luberon et les cyprès du village.',
    captionEn:
      'La Bastide’s terraced gardens open onto the Luberon valley and the village cypresses.',
    credit: 'Airelles',
  },
  {
    localFile: 'piscine-terrasse.png',
    category: 'pool',
    altFr: 'Piscine extérieure en terrasse de l’Airelles Gordes, Gordes',
    altEn: 'Outdoor terrace pool at Airelles Gordes, Gordes',
    captionFr:
      'La piscine en plein air, vue du ciel, est bordée de transats et de parasols face aux collines du Luberon.',
    captionEn:
      'The open-air pool, seen from above, is lined with loungers and umbrellas facing the Luberon hills.',
    credit: 'Airelles',
  },
  {
    localFile: 'constance-piscine.png',
    category: 'pool',
    altFr: 'Piscine bordée d’oliviers de l’Airelles Gordes, Gordes',
    altEn: 'Olive-lined pool at Airelles Gordes, Gordes',
    captionFr:
      'La piscine en terrasse, entourée d’oliviers et de cyprès centenaires, ouvre sur la vallée du Luberon.',
    captionEn:
      'The terrace pool, framed by olive trees and ancient cypresses, opens onto the Luberon valley.',
    credit: 'Airelles',
  },
  {
    localFile: 'kids-piscine.png',
    category: 'pool',
    altFr: 'Piscine familiale du Kids Club Airelles Gordes, Gordes',
    altEn: 'Family pool at the Airelles Gordes Kids Club, Gordes',
    captionFr:
      'La piscine du Kids Club accueille les familles dans un bassin dédié, à l’écart de la piscine principale.',
    captionEn:
      'The Kids Club pool welcomes families in a dedicated basin, away from the main pool.',
    credit: 'Airelles',
  },
  {
    imgixFile: 'Zfhefg4qyfNhFw6l_BDG-Sup\u00e9rieureVillage-Chambre.jpg',
    category: 'room',
    altFr: 'Chambre Supérieure Village de l’Airelles Gordes, Gordes',
    altEn: 'Superior Village bedroom at Airelles Gordes, Gordes',
    captionFr:
      'Les chambres Supérieures Village marient pierre, lin et bois patiné dans l’esprit des bastides provençales.',
    captionEn:
      'Superior Village rooms pair stone, linen and aged wood in the spirit of Provençal bastides.',
    credit: 'Airelles',
  },
  {
    localFile: 'ch-deluxe-valley.png',
    category: 'room',
    altFr: 'Chambre Deluxe Valley de l’Airelles Gordes, Gordes',
    altEn: 'Deluxe Valley bedroom at Airelles Gordes, Gordes',
    captionFr:
      'La Chambre Deluxe Valley ouvre sur la vallée du Luberon depuis une voûte en pierre et un parquet chevron.',
    captionEn:
      'The Deluxe Valley room opens onto the Luberon valley from a stone vault and herringbone parquet.',
    credit: 'Airelles',
  },
  {
    imgixFile: 'agLKL6YofJOwHGxv_BDG-SuiteBarondeSimiane-Chambre\u00a9VincentLeroux.jpg',
    category: 'suite',
    altFr: 'Chambre de la Suite Baron de Simiane, Airelles Gordes, Gordes',
    altEn: 'Bedroom of the Baron de Simiane Suite, Airelles Gordes, Gordes',
    captionFr:
      'La Suite Baron de Simiane, choix du Concierge, ouvre sur les toits de Gordes et la vallée.',
    captionEn:
      'The Baron de Simiane Suite, the Concierge’s pick, opens onto the rooftops of Gordes and the valley.',
    credit: 'Vincent Leroux',
  },
  {
    localFile: 'suite-vasarely.png',
    category: 'suite',
    altFr: 'Salon de la Suite Vasarely de l’Airelles Gordes, Gordes',
    altEn: 'Living room of the Vasarely Suite at Airelles Gordes, Gordes',
    captionFr:
      'La Suite Vasarely rend hommage à l’artiste avec des motifs géométriques et des boiseries rouges.',
    captionEn:
      'The Vasarely Suite pays tribute to the artist with geometric patterns and red woodwork.',
    credit: 'Airelles',
  },
  {
    localFile: 'suite-vasarely-terrasse.png',
    category: 'view',
    altFr: 'Terrasse privée de la Suite Vasarely, Airelles Gordes, Gordes',
    altEn: 'Private terrace of the Vasarely Suite, Airelles Gordes, Gordes',
    captionFr:
      'La terrasse privée de la Suite Vasarely sert le thé face au village perché de Gordes.',
    captionEn:
      'The Vasarely Suite’s private terrace serves afternoon tea facing the hilltop village of Gordes.',
    credit: 'Airelles',
  },
  {
    localFile: 'resto-bastide-pierres.png',
    category: 'dining',
    altFr: 'Terrasse de La Bastide de Pierres, trattoria italienne, Airelles Gordes',
    altEn: 'Terrace of La Bastide de Pierres Italian trattoria, Airelles Gordes',
    captionFr:
      'La Bastide de Pierres installe ses tables colorées sous la pergola, esprit trattoria napolitaine.',
    captionEn:
      'La Bastide de Pierres sets its colourful tables under the pergola, in a Neapolitan trattoria spirit.',
    credit: 'Airelles',
  },
  {
    imgixFile: 'ahWfi7K9tuLqEJu9_BDG\u2013LaTabledelaBastide-Terrasse\u00a9VincentLeroux.png',
    category: 'dining',
    altFr: 'Table dressée sur la terrasse de La Table de La Bastide, Airelles Gordes',
    altEn: 'Set table on the terrace of La Table de La Bastide, Airelles Gordes',
    captionFr:
      'La terrasse de La Table de La Bastide sert une cuisine de terroir face à la vallée du Luberon.',
    captionEn:
      'The terrace of La Table de La Bastide serves terroir-driven cuisine facing the Luberon valley.',
    credit: 'Vincent Leroux',
  },
  {
    imgixFile: 'Zemj8XUurf2G3L4c_BDG-CloverGordes-VueTerrasse.jpg',
    category: 'dining',
    altFr: 'Terrasse panoramique du Clover Gordes par Jean-François Piège, Airelles Gordes',
    altEn: 'Panoramic terrace of Clover Gordes by Jean-François Piège, Airelles Gordes',
    captionFr:
      'La terrasse du Clover Gordes, table signée Jean-François Piège, surplombe les toits du village.',
    captionEn:
      'The Clover Gordes terrace, a table by Jean-François Piège, overlooks the village rooftops.',
    credit: 'Airelles',
  },
  {
    localFile: 'resto-beefbar.png',
    category: 'dining',
    altFr: 'Terrasse colorée du Beefbar Gordes, Airelles Gordes',
    altEn: 'Colourful terrace of Beefbar Gordes, Airelles Gordes',
    captionFr:
      'Le Beefbar Gordes installe ses tables bistrot sous une pergola face à la vallée du Luberon.',
    captionEn: 'Beefbar Gordes sets its bistro tables under a pergola facing the Luberon valley.',
    credit: 'Airelles',
  },
  {
    localFile: 'resto-brunch.png',
    category: 'dining',
    altFr: 'Buffet brunch et pâtisseries de l’Airelles Gordes, Gordes',
    altEn: 'Brunch buffet and pastries at Airelles Gordes, Gordes',
    captionFr:
      'Le brunch dominical aligne tartes, éclairs et meringues dans le salon boisé de La Bastide.',
    captionEn:
      'The Sunday brunch lines tarts, éclairs and meringues in La Bastide’s wood-panelled salon.',
    credit: 'Airelles',
  },
  {
    localFile: 'resto-laduree.png',
    category: 'dining',
    altFr: 'Boutique Ladurée de l’Airelles Gordes, Gordes',
    altEn: 'Ladurée boutique at Airelles Gordes, Gordes',
    captionFr:
      'La boutique Ladurée, façade pistache, sert macarons et thé sur sa terrasse provençale.',
    captionEn:
      'The pistachio-fronted Ladurée boutique serves macarons and tea on its Provençal terrace.',
    credit: 'Airelles',
  },
  {
    imgixFile: 'ahWilLK9tuLqEJxS_BDG-Spa\u00a9VincentLeroux.png',
    category: 'spa',
    altFr: 'Piscine intérieure du Spa Airelles par Guerlain, Gordes',
    altEn: 'Indoor pool at the Airelles Spa by Guerlain, Gordes',
    captionFr:
      'Le Spa Airelles par Guerlain occupe des salles voûtées en pierre, inspirées de l’abbaye de Sénanque.',
    captionEn:
      'The Airelles Spa by Guerlain unfolds across vaulted stone rooms inspired by Sénanque Abbey.',
    credit: 'Vincent Leroux',
  },
  {
    localFile: 'spa-soin.png',
    category: 'spa',
    altFr: 'Accueil du Spa Airelles par Guerlain, Airelles Gordes, Gordes',
    altEn: 'Reception of the Airelles Spa by Guerlain, Airelles Gordes, Gordes',
    captionFr:
      'L’accueil du Spa Airelles par Guerlain, en boiseries chalets, expose les soins et parfums de la maison.',
    captionEn:
      'The Airelles Spa by Guerlain reception, in chalet woodwork, displays the house’s treatments and fragrances.',
    credit: 'Airelles',
  },
];

interface GalleryRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
}

function buildImgixUrl(file: string): string {
  return `${IMGIX_PREFIX}${encodeURIComponent(file)}${IMGIX_SUFFIX}`;
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[airelles-gallery] hotel not found: ${SLUG}`);
  return id;
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[airelles-gallery] Cloudinary creds missing');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[airelles-gallery] ${GALLERY.length} images — dry-run: ${dryRun ? 'YES' : 'NO'}`);

  const gallery: GalleryRow[] = [];
  let heroPublicId: string | null = null;

  for (let i = 0; i < GALLERY.length; i++) {
    const img = GALLERY[i]!;
    const index = i + 1;
    const hasImgix = img.imgixFile !== undefined;
    const hasLocal = img.localFile !== undefined;
    if (hasImgix === hasLocal) {
      throw new Error(`[airelles-gallery] image ${index} must have exactly one source`);
    }

    if (dryRun) {
      const source = hasImgix ? buildImgixUrl(img.imgixFile!) : resolve(LOCAL_DIR, img.localFile!);
      console.log(`  [${index}] (${img.category}) ${source}`);
      const publicId = `cct/hotels/${SLUG}/press-${index}`;
      if (img.isHero === true) heroPublicId = publicId;
      gallery.push({
        public_id: publicId,
        alt_fr: img.altFr,
        alt_en: img.altEn,
        caption_fr: img.captionFr,
        caption_en: img.captionEn,
        category: img.category,
      });
      continue;
    }

    const baseInput = {
      hotelSlug: SLUG,
      source: 'press' as const,
      index,
      altFr: img.altFr,
      altEn: img.altEn,
      category: img.category,
      extraTags: ['airelles-gordes-2026', `credit-${img.credit.replace(/\s+/gu, '-')}`],
    };

    const result = hasImgix
      ? await uploadFromUrl({ ...baseInput, sourceUrl: buildImgixUrl(img.imgixFile!) })
      : await uploadFromLocalFile({
          ...baseInput,
          localPath: resolve(LOCAL_DIR, img.localFile!),
        });

    if (!result.ok) {
      console.error(`  [${index}] UPLOAD FAILED (${img.category}):`, result.error);
      throw new Error(`[airelles-gallery] upload failed at index ${index}`);
    }

    const publicId = result.value.public_id;
    console.log(
      `  [${index}] OK ${publicId} — ${result.value.width}×${result.value.height} (${img.category})`,
    );
    if (img.isHero === true) heroPublicId = publicId;
    gallery.push({
      public_id: publicId,
      alt_fr: img.altFr,
      alt_en: img.altEn,
      caption_fr: img.captionFr,
      caption_en: img.captionEn,
      category: img.category,
    });
  }

  if (heroPublicId === null) throw new Error('[airelles-gallery] no hero flagged');

  const categories = new Set(gallery.map((g) => g.category));
  console.log(
    `\n[airelles-gallery] categories (${categories.size}):`,
    [...categories].sort().join(', '),
  );
  console.log('[airelles-gallery] hero_image =', heroPublicId);

  if (dryRun) {
    console.log('\n[airelles-gallery] dry-run — no DB patch.');
    return;
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: heroPublicId,
    gallery_images: gallery,
  });
  console.log(`\n[airelles-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
