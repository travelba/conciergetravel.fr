/**
 * One-shot high-resolution re-sourcing for `les-airelles-gordes`.
 *
 * Why this exists (2026-06-02):
 *   The hotel's hero + gallery were sourced from Google Places API, which
 *   caps photos at ~1600 px. The hero preset (`HERO_TRANSFORM = w_2400`)
 *   therefore UPSCALED the 1600 px source → visibly soft hero on hi-DPI
 *   displays (`photo-quality.mdc` Hard Rule: originals ≥ 2400 px).
 *
 *   The official site (airelles.com) serves its press visuals through an
 *   Imgix CDN where the output width is a query param (`?w=2600`). Sources
 *   are 2250–8000 px, so we can pull genuine ≥ 2400 px frames. This script
 *   uploads a curated, category-diverse set to Cloudinary (capped at 2400
 *   max-side, `c_limit`, no upscale) and repoints `hero_image` +
 *   `gallery_images`.
 *
 * Legality: every URL is the hotel's OWN official site (the `official_url`
 * is the path-specific Gordes page, not a multi-property corporate root),
 * photographer-credited (©HiddenCliff / ©VincentLeroux / ©MarkLuscombe).
 * Source = `press` (official media kit) per `photo-quality.mdc`.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-airelles-gordes.ts --dry-run   # print plan only
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-airelles-gordes.ts             # upload + DB patch
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'les-airelles-gordes';
const IMGIX_PREFIX = 'https://assets.airelles.com/images/airelles2023/';
/** Request a 2600 px frame from Imgix; Cloudinary then limits to 2400. */
const IMGIX_SUFFIX = '?auto=format%2Ccompress&w=2600';

interface CuratedImage {
  /** Decoded Imgix filename (script percent-encodes it). */
  readonly file: string;
  readonly category: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly captionFr: string;
  readonly captionEn: string;
  /** Photographer credit (Cloudinary tag only — not a gallery column). */
  readonly credit: string;
  readonly isHero?: boolean;
}

/**
 * Curated set (12) — harvested + dimension-verified (each ≥ 2600 px wide)
 * from the official Gordes pages on 2026-06-02. Order = gallery order; the
 * drone overview leads (and is the hero).
 */
const CURATED: readonly CuratedImage[] = [
  {
    file: 'ZpD4LR5LeNNTxF8x_LaBastide-Hotel&Jardin-Drone-overview-topshot2\u00a9HiddenCliff-2024.jpg',
    category: 'exterior',
    altFr: 'Vue aérienne de la bastide Airelles Gordes et de ses jardins, Gordes',
    altEn: 'Aerial view of the Airelles Gordes bastide and its gardens, Gordes',
    captionFr: 'La bastide du XVIIIe siècle et ses jardins en terrasses dominent le village perché de Gordes, dans le Luberon.',
    captionEn: 'The 18th-century bastide and its terraced gardens overlook the hilltop village of Gordes, in the Luberon.',
    credit: 'HiddenCliff',
    isHero: true,
  },
  {
    file: 'ZqDwCx5LeNNTxdMQ_LaBastide-Hotel-Entr\u00e9e\u00a9HiddenCliff-2024.jpg',
    category: 'exterior',
    altFr: 'Entrée en pierre de la bastide Airelles Gordes, Gordes',
    altEn: 'Stone entrance of the Airelles Gordes bastide, Gordes',
    captionFr: 'L’entrée en pierre dorée de La Bastide, restaurée par 150 artisans lors de la réouverture de 2015.',
    captionEn: 'The golden-stone entrance of La Bastide, restored by 150 craftspeople for its 2015 reopening.',
    credit: 'HiddenCliff',
  },
  {
    file: 'Zlcy4aWtHYXtT5n7_BDG-Lieuxcommuns-R\u00e9ception.jpg',
    category: 'lobby',
    altFr: 'Salon de réception provençal de l’Airelles Gordes, Gordes',
    altEn: 'Provençal reception lounge at Airelles Gordes, Gordes',
    captionFr: 'Le salon de réception mêle mobilier d’époque et lumière de Provence sous les voûtes de La Bastide.',
    captionEn: 'The reception lounge blends period furniture with Provençal light beneath the vaults of La Bastide.',
    credit: 'Airelles',
  },
  {
    file: 'ZpD4LB5LeNNTxF8w_LaBastide-Exp\u00e9rience-Balade\u00e0v\u00e9los-VillagedeGordes-\u00a9HiddenCliff-2024.jpg',
    category: 'view',
    altFr: 'Balade à vélo vers le village perché de Gordes depuis l’Airelles Gordes',
    altEn: 'Cycling toward the hilltop village of Gordes from Airelles Gordes',
    captionFr: 'Le village perché de Gordes, à dix minutes de La Bastide, classé parmi les plus beaux villages de France.',
    captionEn: 'The hilltop village of Gordes, ten minutes from La Bastide, ranks among France’s most beautiful villages.',
    credit: 'HiddenCliff',
  },
  {
    file: 'Zo_wXB5LeNNTxCiD_LaBastide-Lifestyle-Pool-\u00a9HiddenCliff-2024.jpg',
    category: 'pool',
    altFr: 'Piscine en terrasse bordée d’oliviers de l’Airelles Gordes, Gordes',
    altEn: 'Olive-lined terrace pool at Airelles Gordes, Gordes',
    captionFr: 'La piscine en terrasse, entourée d’oliviers et de cyprès centenaires, ouvre sur la vallée du Luberon.',
    captionEn: 'The terrace pool, framed by olive trees and ancient cypresses, opens onto the Luberon valley.',
    credit: 'HiddenCliff',
  },
  {
    file: 'Zfhefg4qyfNhFw6l_BDG-Sup\u00e9rieureVillage-Chambre.jpg',
    category: 'room',
    altFr: 'Chambre Supérieure Village de l’Airelles Gordes, Gordes',
    altEn: 'Superior Village bedroom at Airelles Gordes, Gordes',
    captionFr: 'Les chambres Supérieures Village marient pierre, lin et bois patiné dans l’esprit des bastides provençales.',
    captionEn: 'Superior Village rooms pair stone, linen and aged wood in the spirit of Provençal bastides.',
    credit: 'Airelles',
  },
  {
    file: 'agLKL6YofJOwHGxv_BDG-SuiteBarondeSimiane-Chambre\u00a9VincentLeroux.jpg',
    category: 'suite',
    altFr: 'Chambre de la Suite Baron de Simiane, Airelles Gordes, Gordes',
    altEn: 'Bedroom of the Baron de Simiane Suite, Airelles Gordes, Gordes',
    captionFr: 'La Suite Baron de Simiane, choix du Concierge, ouvre sur les toits de Gordes et la vallée.',
    captionEn: 'The Baron de Simiane Suite, the Concierge’s pick, opens onto the rooftops of Gordes and the valley.',
    credit: 'Vincent Leroux',
  },
  {
    file: 'ahalFLK9tuLqELGY_BDG\u2013SuiteDucdeSoubise430-Salon\u00a9VincentLeroux.png',
    category: 'suite',
    altFr: 'Salon de la Suite Duc de Soubise, Airelles Gordes, Gordes',
    altEn: 'Living room of the Duc de Soubise Suite, Airelles Gordes, Gordes',
    captionFr: 'Le salon de la Suite Duc de Soubise réunit boiseries, cheminée et tissus chinés dans 430 m².',
    captionEn: 'The Duc de Soubise Suite living room gathers panelling, a fireplace and curated fabrics across 430 m².',
    credit: 'Vincent Leroux',
  },
  {
    file: 'aKMvuqTt2nPbabD2_BDG-SalledebainChambreDeluxeVillage\u00a9MarkLuscombe.jpg',
    category: 'detail',
    altFr: 'Salle de bain en pierre d’une chambre Deluxe Village, Airelles Gordes',
    altEn: 'Stone bathroom of a Deluxe Village room, Airelles Gordes',
    captionFr: 'Les salles de bain en pierre des chambres Deluxe Village prolongent l’architecture d’origine de la bastide.',
    captionEn: 'The stone bathrooms of Deluxe Village rooms extend the bastide’s original architecture.',
    credit: 'Mark Luscombe-Whyte',
  },
  {
    file: 'ahWfi7K9tuLqEJu9_BDG\u2013LaTabledelaBastide-Terrasse\u00a9VincentLeroux.png',
    category: 'dining',
    altFr: 'Terrasse du restaurant La Table de La Bastide, Airelles Gordes, Gordes',
    altEn: 'Terrace of La Table de La Bastide restaurant, Airelles Gordes, Gordes',
    captionFr: 'La terrasse de La Table de La Bastide sert une cuisine de terroir face à la vallée du Luberon.',
    captionEn: 'The terrace of La Table de La Bastide serves terroir-driven cuisine facing the Luberon valley.',
    credit: 'Vincent Leroux',
  },
  {
    file: 'Zemj8XUurf2G3L4c_BDG-CloverGordes-VueTerrasse.jpg',
    category: 'dining',
    altFr: 'Terrasse panoramique du Clover Gordes par Jean-François Piège, Airelles Gordes',
    altEn: 'Panoramic terrace of Clover Gordes by Jean-François Piège, Airelles Gordes',
    captionFr: 'La terrasse du Clover Gordes, table signée Jean-François Piège, surplombe les toits du village.',
    captionEn: 'The Clover Gordes terrace, a table by Jean-François Piège, overlooks the village rooftops.',
    credit: 'Airelles',
  },
  {
    file: 'ahWilLK9tuLqEJxS_BDG-Spa\u00a9VincentLeroux.png',
    category: 'spa',
    altFr: 'Spa voûté Airelles par Guerlain, Airelles Gordes, Gordes',
    altEn: 'Vaulted Airelles Spa by Guerlain, Airelles Gordes, Gordes',
    captionFr: 'Le Spa Airelles par Guerlain occupe des salles voûtées en pierre, inspirées de l’abbaye de Sénanque.',
    captionEn: 'The Airelles Spa by Guerlain unfolds across vaulted stone rooms inspired by Sénanque Abbey.',
    credit: 'Vincent Leroux',
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

function buildSourceUrl(file: string): string {
  return `${IMGIX_PREFIX}${encodeURIComponent(file)}${IMGIX_SUFFIX}`;
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[resource-airelles] hotel not found: ${SLUG}`);
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
      throw new Error('[resource-airelles] Cloudinary creds missing despite requirePhotoEnv check');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(`[resource-airelles] ${CURATED.length} curated images — dry-run: ${dryRun ? 'YES' : 'NO'}`);

  const gallery: GalleryRow[] = [];
  let heroPublicId: string | null = null;

  for (let i = 0; i < CURATED.length; i++) {
    const img = CURATED[i]!;
    const index = i + 1;
    const sourceUrl = buildSourceUrl(img.file);

    if (dryRun) {
      console.log(`  [${index}] (${img.category}) ${sourceUrl}`);
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

    const result = await uploadFromUrl({
      sourceUrl,
      hotelSlug: SLUG,
      source: 'press',
      index,
      altFr: img.altFr,
      altEn: img.altEn,
      category: img.category,
      extraTags: ['airelles-gordes-2026', `credit-${img.credit.replace(/\s+/gu, '-')}`],
    });

    if (!result.ok) {
      console.error(`  [${index}] UPLOAD FAILED (${img.category}): ${JSON.stringify(result.error)}`);
      throw new Error(`[resource-airelles] upload failed at index ${index}; aborting before DB patch`);
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

  if (heroPublicId === null) throw new Error('[resource-airelles] no hero flagged in CURATED');

  console.log('\n[resource-airelles] hero_image =', heroPublicId);
  console.log('[resource-airelles] gallery_images =\n', JSON.stringify(gallery, null, 2));

  if (dryRun) {
    console.log('\n[resource-airelles] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: heroPublicId,
    gallery_images: gallery,
  });
  console.log(`\n[resource-airelles] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
