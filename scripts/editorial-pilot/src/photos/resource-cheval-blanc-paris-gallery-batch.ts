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
  CHEVAL_BLANC_PARIS_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'cheval-blanc-paris';
const PRISMIC_W = 'auto=format,compress&w=2880';

/** One source URL per `press-N` row (same order as gallery manifest). */
const GALLERY_SOURCES: readonly Readonly<{ readonly url: string }>[] = [
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aEb52Lh8WN-LV5rR_ChevalBlancParis_Fa%C3%A7ade3_Oliver_Fly_Photography_32025.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aiKrfQeQX7-eW2iQ_Light-ChevalBlancParis_PontNeufJR_OliverFly2026-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aGUCC3fc4bHWi86A_Light-ChevalBlancParis_Fa%C3%A7ade_OliverFly.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z8_85hsAHJWomUB3_WebRGB-ChevalBlancParis_Salond%27Accueil_AlexandreTabaste.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-WJyndAxsiBwAPn_WebRGB-ChevalBlancParis-LeToutParis-salle-EdouardFran%C3%A7ois-2021.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z9wuHDiBA97Giuw3_WebRGB-ChevalBlancParis-Shootingphotosenfants-Lobby-Chlo%C3%A9Gassian-5avril2023-02.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aUKCeHNYClf9oV2O_Light-ChevalBlancParis_ChambreDeluxe_VincentLeroux.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aUPKtnNYClf9oYj-_Light-ChevalBlancParis_ChambreDeluxeBalcon_2025_VincentLeroux-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z9AApRsAHJWomUFu_WebRGB-ChevalBlancParis_SuiteSeine_Jardind%27Hiver_511_VincentLeroux.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-1uLHdAxsiBwPQC_WebRGB-ChevalBlancParis_Pl%C3%A9nitude_AmbianceCuisine_Ilyafoodstories.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aQzQT7pReVYa4I6K_Z-WI03dAxsiBwAOx_WebRGB-ChevalBlancParis_LeTout-Paris_Terrasse_VincentLeroux-3--1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/ah2JdgeQX7-eWfRM_Light-ChevalBlancParis_Langosteria_Terrasse_OliverFly-5-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z9AAjRsAHJWomUFh_WebRGB-ChevalBlancParis_DiorSpa_SuiteSauvage_MathieuSalvaing.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-0HyndAxsiBwNsN_WebRGB-ChevalBlancParis-DiorSpa-OliverFly-1.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/ahVcebK9tuLqEI3b_ChevalBlancParis_MassageVisage_DiorSpa_2026_VisuelDior-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-0KendAxsiBwNuW_WebRGB-ChevalBlancParis_Piscineinfinie_AlexandreTabaste-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-0KhndAxsiBwNua_WebRGB-ChevalBlancParis_Piscine_OliverFly.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-0KaXdAxsiBwNuR_WebRGB-ChevalBlancParis_Piscineinfinie_AlexandreTabaste-2-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z_kS8evxEdbNO6gd_WebRGB-ChevalBlancParis_SuiteEiffel_Salon_VincentLeroux-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/ad3-xp1ZCF7ETKac_Light-ChevalBlancParis_LeJardin_VueEiffel_VincentLeroux-2-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/agRTtaYofJOwHLYf_Light-ChevalBlancParis_LeTout-Paris_Balcon_Ilyafoodstories-8-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aTlGTHNYClf9oARl_Light-ChevalBlancParis_Pl%C3%A9nitude_Grousec%C3%A9leripassion_2025_Ilyafoodstories-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aTk673NYClf9oAFB_Light-ChevalBlancParis_Hakuba_Salle_Carolinedutrey-2-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z_d33uvxEdbNO1Ed_WebRGB-ChevalBlancParis_L%27Appartement_SuiteQuintessence_VincentLeroux.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z-0MmHdAxsiBwNwL_WebRGB-ChevalBlancParis_AmbassadriceDiorSpa_KiaraBaratta_AdrienVigreux-2-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aP-H6bpReVYa3tgg_Beauty%26bodymamanb%C3%A9b%C3%A9_DiorSpaChevalBlanc-1-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z_d3quvxEdbNO1EV_WebRGB-ChevalBlancParis_L%27Appartement_SuiteRavel-AlexandreTabaste-3-_0535.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/aftDdsBOoF08xrK3_ChevalBlancParis_Salle_LeTout-Paris_2026_IlyaFoodStories-3-.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z_d44OvxEdbNO1Fv_WebRGB-ChevalBlancParis_L%27Appartement_SuiteQuintessence_VincentLeroux-2.jpg?${PRISMIC_W}`,
  },
  {
    url: `https://images.prismic.io/lvmh-chevalblanc/Z_kXyuvxEdbNO6v-_WebRGB-ChevalBlancParis_LeTout-Paris_D%C3%A9jeunerDominical_ilyafoodstories-1-.jpg?${PRISMIC_W}`,
  },
];

interface GalleryRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly caption_fr: string;
  readonly caption_en: string;
  readonly category: string;
  readonly credit?: string;
  readonly width?: number;
  readonly height?: number;
}

function assertManifestShape(): void {
  if (GALLERY_SOURCES.length !== CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length) {
    throw new Error(
      `[cbp-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== manifest (${CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = CHEVAL_BLANC_PARIS_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[cbp-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (CHEVAL_BLANC_PARIS_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[cbp-gallery] hero mismatch: ${CHEVAL_BLANC_PARIS_HERO_IMAGE}`);
  }
}

function printCategoryReport(): void {
  const counts = new Map<string, number>();
  for (const meta of CHEVAL_BLANC_PARIS_GALLERY_IMAGES) {
    counts.set(meta.category, (counts.get(meta.category) ?? 0) + 1);
  }
  console.log('\n[cbp-gallery] category coverage:');
  for (const cat of CHEVAL_BLANC_PARIS_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[cbp-gallery] entries: ${CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length}`);
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[cbp-gallery] hotel not found: ${SLUG}`);
  return id;
}

async function main(): Promise<void> {
  assertManifestShape();

  const dryRun = process.argv.slice(2).includes('--dry-run');

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[cbp-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[cbp-gallery] ${CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[cbp-gallery] hero_image = ${CHEVAL_BLANC_PARIS_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];

  for (let i = 0; i < CHEVAL_BLANC_PARIS_GALLERY_IMAGES.length; i++) {
    const meta = CHEVAL_BLANC_PARIS_GALLERY_IMAGES[i]!;
    const sourceUrl = GALLERY_SOURCES[i]!.url;
    const index = i + 1;

    if (dryRun) {
      console.log(`  [press-${index}] (${meta.category}) ${sourceUrl}`);
      gallery.push({
        public_id: meta.public_id,
        alt_fr: meta.alt_fr,
        alt_en: meta.alt_en,
        caption_fr: meta.caption_fr,
        caption_en: meta.caption_en,
        category: meta.category,
        credit: meta.credit,
      });
      continue;
    }

    const result = await uploadFromUrl({
      sourceUrl,
      hotelSlug: SLUG,
      source: 'press',
      index,
      altFr: meta.alt_fr,
      altEn: meta.alt_en,
      category: meta.category,
      extraTags: ['cheval-blanc-paris-gallery-2026', 'credit-Cheval-Blanc-LVMH'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[cbp-gallery] upload failed at press-${index}`);
    }

    console.log(
      `  [press-${index}] OK ${result.value.public_id} — ${result.value.width}×${result.value.height} (${meta.category})`,
    );
    gallery.push({
      public_id: result.value.public_id,
      alt_fr: meta.alt_fr,
      alt_en: meta.alt_en,
      caption_fr: meta.caption_fr,
      caption_en: meta.caption_en,
      category: meta.category,
      credit: meta.credit,
      width: result.value.width,
      height: result.value.height,
    });
  }

  printCategoryReport();

  if (dryRun) {
    console.log('\n[cbp-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: CHEVAL_BLANC_PARIS_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[cbp-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
