/**
 * POI card images for `conrad-los-angeles` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources:
 * Wikimedia Commons (Special:FilePath, verified 200 image/jpeg 2026-06-16).
 *
 *   pnpm --filter @mch/editorial-pilot conrad:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot conrad:photos:poi
 *
 * Skill: photo-pipeline, hotel-kit-rollout §Rule POI images
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';

const SLUG = 'conrad-los-angeles';

interface PoiImageSource {
  readonly slug: string;
  readonly sourceUrl: string;
  readonly source: 'commons';
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
}

/** Commons Special:FilePath URLs — resolve to the named Downtown LA landmark. */
function commonsFilePath(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1280`;
}

/** Downtown LA / Grand Avenue cultural corridor — matches golden points_of_interest. */
const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'walt-disney-concert-hall',
    sourceUrl: commonsFilePath('Disney Concert Hall by Carol Highsmith.jpg'),
    source: 'commons',
    altFr: 'Walt Disney Concert Hall, courbes d’acier signées Frank Gehry, Downtown Los Angeles',
    altEn: 'Walt Disney Concert Hall, Frank Gehry’s steel curves, Downtown Los Angeles',
    licenseNote: 'Wikimedia Commons (Carol Highsmith, public domain)',
  },
  {
    slug: 'the-broad',
    sourceUrl: commonsFilePath('The Broad (Los Angeles) July 2023.jpg'),
    source: 'commons',
    altFr:
      'The Broad, musée d’art contemporain à la façade en nid d’abeille, Grand Avenue, Los Angeles',
    altEn: 'The Broad, contemporary art museum with its honeycomb veil, Grand Avenue, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'moca-grand-avenue',
    sourceUrl: commonsFilePath('Moca-exterior.jpg'),
    source: 'commons',
    altFr: 'MOCA Grand Avenue, Museum of Contemporary Art, Downtown Los Angeles',
    altEn: 'MOCA Grand Avenue, Museum of Contemporary Art, Downtown Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'music-center',
    sourceUrl: commonsFilePath('Dorothy Chandler Pavilion.jpg'),
    source: 'commons',
    altFr: 'Dorothy Chandler Pavilion du Music Center, opéra et arts de la scène, Los Angeles',
    altEn: 'Dorothy Chandler Pavilion at the Music Center, opera and performing arts, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'grand-park',
    sourceUrl: commonsFilePath('Los Angeles Grand Park Fountain 4.jpg'),
    source: 'commons',
    altFr: 'Grand Park et sa fontaine rose entre l’hôtel de ville et Grand Avenue, Los Angeles',
    altEn: 'Grand Park and its pink fountain between City Hall and Grand Avenue, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'cathedral-our-lady-angels',
    sourceUrl: commonsFilePath('Exterior of Cathedral of Our Lady of the Angels dllu.jpg'),
    source: 'commons',
    altFr:
      'Cathédrale Notre-Dame-des-Anges (Cathedral of Our Lady of the Angels), Rafael Moneo, Los Angeles',
    altEn: 'Cathedral of Our Lady of the Angels by Rafael Moneo, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'grand-central-market',
    sourceUrl: commonsFilePath('Grand Central Market, Los Angeles.jpg'),
    source: 'commons',
    altFr: 'Grand Central Market, marché alimentaire historique de 1917, Downtown Los Angeles',
    altEn: 'Grand Central Market, the 1917 historic food hall, Downtown Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'angels-flight',
    sourceUrl: commonsFilePath('Angels Flight 2020.jpg'),
    source: 'commons',
    altFr: 'Angels Flight, funiculaire historique de Bunker Hill depuis 1901, Los Angeles',
    altEn: 'Angels Flight, the historic Bunker Hill funicular since 1901, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'the-last-bookstore',
    sourceUrl: commonsFilePath('The Last Bookstore (Los Angeles) Exterior (July 2022).JPG'),
    source: 'commons',
    altFr: 'The Last Bookstore, librairie indépendante iconique de Downtown Los Angeles',
    altEn: 'The Last Bookstore, iconic independent bookstore in Downtown Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'crypto-arena-la-live',
    sourceUrl: commonsFilePath('Crypto.com Arena exterior 2023.jpg'),
    source: 'commons',
    altFr: 'Crypto.com Arena à L.A. Live, salle des Lakers et des grands concerts, Los Angeles',
    altEn: 'Crypto.com Arena at L.A. Live, home of the Lakers and major concerts, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'little-tokyo',
    sourceUrl: commonsFilePath('Little Tokyo, Downtown Los Angeles 02.jpg'),
    source: 'commons',
    altFr: 'Little Tokyo, quartier historique japonais de Downtown Los Angeles',
    altEn: 'Little Tokyo, the historic Japanese district of Downtown Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'rodeo-drive',
    sourceUrl: commonsFilePath(
      'Rodeo Drive & Via Rodeo, Beverly Hills, LA, CA, jjron 21.03.2012.jpg',
    ),
    source: 'commons',
    altFr: 'Rodeo Drive et Via Rodeo, artère du luxe de Beverly Hills, Los Angeles',
    altEn: 'Rodeo Drive and Via Rodeo, the luxury shopping street of Beverly Hills, Los Angeles',
    licenseNote: 'Wikimedia Commons',
  },
];

function publicIdFor(slug: string): string {
  return `cct/hotels/${SLUG}/poi-${slug}`;
}

function parseOnlyFilter(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  if (arg === undefined) return null;
  const slugs = arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(slugs);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const only = parseOnlyFilter();
  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    configureCloudinary({
      cloudName: env.CLOUDINARY_CLOUD_NAME!,
      apiKey: env.CLOUDINARY_API_KEY!,
      apiSecret: env.CLOUDINARY_API_SECRET!,
    });
  }

  const sources = only === null ? POI_SOURCES : POI_SOURCES.filter((p) => only.has(p.slug));

  if (sources.length === 0) {
    console.error('[poi-images] No POI slugs matched --only filter.');
    process.exitCode = 1;
    return;
  }

  const results: Array<{ slug: string; publicId: string; ok: boolean; detail?: string }> = [];

  for (let i = 0; i < sources.length; i++) {
    const poi = sources[i]!;
    const publicId = publicIdFor(poi.slug);

    if (dryRun) {
      console.log(`[dry-run] ${poi.slug}`);
      console.log(`  → ${publicId}`);
      console.log(`  ← ${poi.sourceUrl}`);
      console.log(`  (${poi.licenseNote})`);
      results.push({ slug: poi.slug, publicId, ok: true });
      continue;
    }

    const uploaded = await uploadFromUrl({
      sourceUrl: poi.sourceUrl,
      hotelSlug: SLUG,
      source: 'commons',
      index: i + 1,
      publicIdShort: `poi-${poi.slug}`,
      altFr: poi.altFr,
      altEn: poi.altEn,
      category: 'poi',
      extraTags: ['poi', poi.slug],
    });

    if (!uploaded.ok) {
      console.error(`[FAIL] ${poi.slug}:`, uploaded.error);
      results.push({ slug: poi.slug, publicId, ok: false, detail: JSON.stringify(uploaded.error) });
      continue;
    }

    console.log(`[OK] ${poi.slug} → ${uploaded.value.public_id}`);
    results.push({ slug: poi.slug, publicId: uploaded.value.public_id, ok: true });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    console.error(`\n${failed.length} upload(s) failed.`);
  } else {
    console.log(`\nAll ${results.length} POI images ${dryRun ? 'planned' : 'uploaded'}.`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
