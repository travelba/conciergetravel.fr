/**
 * Phase 3 — full 30-image gallery for `les-pres-deugenie`.
 *
 * CDC §2.2-aligned batch (10 categories × 3 images). Metadata lives in
 * `@mch/domain` (`LES_PRES_DEUGENIE_GALLERY_IMAGES`); this script maps each
 * `press-N` slot to an official lespresdeugenie.com source URL.
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
  LES_PRES_DEUGENIE_HERO_IMAGE,
} from '@mch/domain/editorial';
import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'les-pres-deugenie';

const GALLERY_SOURCES: readonly Readonly<{ readonly url: string }>[] = [
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/02/LPDE_nouvelle-reception_2024.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/2501-01_13_lpde_heurebleue_bd-edited.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2018/10/EUG-FERME-THERMALE-VUE-EXT-059-YOAN-CHEVOJON-BD.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/02/LPDE_nouvelle-reception_2024-768x1356.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/02/imperatrice-eugenie_romantique.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/01/IMG2-edited.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/10/LPDE_vignette_chambre_couvent.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/08/eugenie_chambre_boutondor-600x600.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/86.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/72.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/76.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/07/tarte-tomate_lpde.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/61.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2018/10/2106-02_01_lpde_yoga_bd.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG9.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/07/70-1-2048x1152.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/07/IMG2-2048x1152.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG2.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG23.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2018/10/chateau-de-bachen-1.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/2501-01_13_lpde_heurebleue_bd-edited-1536x1536.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/07/boucherie_lpde.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2024/07/IMG2-1536x864.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/IMG23-1536x864.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/01/IMG2-edited-2048x2048.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/86-1536x864.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/72-1536x864.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2026/05/Barbagoa-2026-Logo.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/76-1536x864.jpg',
  },
  {
    url: 'https://lespresdeugenie.com/wp-content/uploads/2025/02/61-1536x864.jpg',
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
  if (GALLERY_SOURCES.length !== LES_PRES_DEUGENIE_GALLERY_IMAGES.length) {
    throw new Error(
      `[lpde-gallery] GALLERY_SOURCES (${GALLERY_SOURCES.length}) !== LES_PRES_DEUGENIE_GALLERY_IMAGES (${LES_PRES_DEUGENIE_GALLERY_IMAGES.length})`,
    );
  }
  for (let i = 0; i < LES_PRES_DEUGENIE_GALLERY_IMAGES.length; i++) {
    const meta = LES_PRES_DEUGENIE_GALLERY_IMAGES[i]!;
    const expected = `cct/hotels/${SLUG}/press-${i + 1}`;
    if (meta.public_id !== expected) {
      throw new Error(`[lpde-gallery] public_id mismatch at index ${i + 1}: ${meta.public_id}`);
    }
  }
  if (LES_PRES_DEUGENIE_HERO_IMAGE !== `cct/hotels/${SLUG}/press-1`) {
    throw new Error(`[lpde-gallery] hero mismatch: ${LES_PRES_DEUGENIE_HERO_IMAGE}`);
  }
}

function printCategoryReport(): void {
  const counts = new Map<string, number>();
  for (const meta of LES_PRES_DEUGENIE_GALLERY_IMAGES) {
    counts.set(meta.category, (counts.get(meta.category) ?? 0) + 1);
  }
  console.log('\n[lpde-gallery] category coverage:');
  for (const cat of LES_PRES_DEUGENIE_GALLERY_CDC_CATEGORIES) {
    console.log(`  ${cat}: ${counts.get(cat) ?? 0}`);
  }
  console.log(`\n[lpde-gallery] entries: ${LES_PRES_DEUGENIE_GALLERY_IMAGES.length}`);
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[lpde-gallery] hotel not found: ${SLUG}`);
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
      throw new Error('[lpde-gallery] Cloudinary creds missing despite requirePhotoEnv');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[lpde-gallery] ${LES_PRES_DEUGENIE_GALLERY_IMAGES.length} slots — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );
  console.log(`[lpde-gallery] hero_image = ${LES_PRES_DEUGENIE_HERO_IMAGE}`);

  const gallery: GalleryRow[] = [];

  for (let i = 0; i < LES_PRES_DEUGENIE_GALLERY_IMAGES.length; i++) {
    const meta = LES_PRES_DEUGENIE_GALLERY_IMAGES[i]!;
    const source = GALLERY_SOURCES[i]!;
    const index = i + 1;
    const sourceUrl = source.url;

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
      extraTags: ['les-pres-deugenie-gallery-2026', 'credit-Les-Pres-d-Eugenie'],
    });

    if (!result.ok) {
      console.error(`  [press-${index}] UPLOAD FAILED (${meta.category}):`, result.error);
      throw new Error(`[lpde-gallery] upload failed at press-${index}`);
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
    console.log('\n[lpde-gallery] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }

  const hotelId = await fetchHotelId(cfg);
  await patchHotelById(cfg, hotelId, {
    hero_image: LES_PRES_DEUGENIE_HERO_IMAGE,
    gallery_images: gallery,
  });
  console.log(`\n[lpde-gallery] DB patched (hotel ${hotelId}). Done.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
