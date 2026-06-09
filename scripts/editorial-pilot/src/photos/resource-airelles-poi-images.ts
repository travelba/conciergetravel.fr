/**
 * POI card images for `les-airelles-gordes` kit pilot page.
 *
 * Sources discovered via Tavily (official sites + Commons) with OpenAI fallback
 * when no licensable venue photo is found. Uploads to
 * `cct/hotels/les-airelles-gordes/poi-{slug}` with overwrite.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/resource-airelles-poi-images.ts --dry-run
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/resource-airelles-poi-images.ts
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/resource-airelles-poi-images.ts --only=le-phebus,les-bories
 *
 * Skill: photo-pipeline
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  configureCloudinary,
  uploadFromLocalFile,
  uploadFromUrl,
} from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';

const SLUG = 'les-airelles-gordes';

interface PoiImageSource {
  readonly slug: string;
  readonly sourceUrl?: string;
  readonly source: 'commons' | 'manual' | 'press' | 'ai';
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
  /** When set, generates via OpenAI Images instead of fetching `sourceUrl`. */
  readonly openAiPrompt?: string;
}

/** Tavily-curated URLs — verified licensing per photo-pipeline skill (2026-06-09 audit). */
const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'chateau-de-gordes',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gordes_-_Chateau_2.jpg/1280px-Gordes_-_Chateau_2.jpg',
    source: 'commons',
    altFr: 'Château Renaissance de Gordes dominant la place du village',
    altEn: 'Renaissance Château de Gordes overlooking the village square',
    licenseNote: 'Wikimedia Commons CC-BY-SA 3.0 — Jean-Marc Rosier',
  },
  {
    slug: 'caves-saint-firmin',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/7/78/Cave_Saint_Firmain_Gordes_by_JM_Rosier_1.jpg',
    source: 'commons',
    altFr: 'Caves troglodytes du Palais Saint-Firmin sous Gordes',
    altEn: 'Troglodyte caves of the Palais Saint-Firmin beneath Gordes',
    licenseNote: 'Wikimedia Commons CC-BY-SA 3.0 — Jean-Marc Rosier',
  },
  {
    slug: 'village-des-bories',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Village_des_Bories%2C_Gordes%2C_France_%28470003301%29.jpg/1280px-Village_des_Bories%2C_Gordes%2C_France_%28470003301%29.jpg',
    source: 'commons',
    altFr: 'Cabanes en pierre sèche du Village des Bories près de Gordes',
    altEn: 'Dry-stone huts at the Village des Bories near Gordes',
    licenseNote: 'Wikimedia Commons CC-BY-SA 2.0 — Fulvio Spada',
  },
  {
    slug: 'abbaye-senanque',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Abbaye_de_senanque_lavande.jpg/1280px-Abbaye_de_senanque_lavande.jpg',
    source: 'commons',
    altFr: 'Abbaye de Sénanque entourée de champs de lavande en fleur',
    altEn: 'Sénanque Abbey surrounded by lavender fields in bloom',
    licenseNote: 'Wikimedia Commons CC-BY-SA 3.0 — Brice',
  },
  {
    slug: 'moulin-des-bouillons',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Gordes_-_Moulin.JPG/1280px-Gordes_-_Moulin.JPG',
    source: 'commons',
    altFr: 'Moulin des Bouillons, ancien moulin à huile près de Gordes',
    altEn: 'Moulin des Bouillons, former oil mill near Gordes',
    licenseNote: 'Wikimedia Commons Public Domain — Véronique PAGNIER',
  },
  {
    slug: 'carcarille',
    sourceUrl: 'https://www.carcarille.com/imagecache/fullwidth/cine-hotel-carcarille-2-2.jpg',
    source: 'manual',
    altFr: 'Terrasse ombragée du restaurant Le C à l’Hôtel Carcarille',
    altEn: 'Shaded terrace of Le C restaurant at Hôtel Carcarille',
    licenseNote: 'Official site carcarille.com — hotel-owned imagery',
  },
  {
    slug: 'mas-senancole',
    sourceUrl:
      'https://www.mas-de-la-senancole.com/media/cache/jadro_resize/rc/9pZa655a1778680872/jadroRoot/medias/65afd0ed532f8/bp-senancole-l-estellan-terrasse-009.jpg',
    source: 'manual',
    altFr: 'Terrasse ombragée du restaurant L’Estellan au Mas de la Sénancole',
    altEn: 'Shaded terrace of L’Estellan restaurant at Mas de la Sénancole',
    licenseNote: 'Official site mas-de-la-senancole.com (Tavily discovery)',
  },
  {
    slug: 'marche-gordes',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Place_Genty_Pentaly_%C3%A0_Gordes.jpg/1280px-Place_Genty_Pentaly_%C3%A0_Gordes.jpg',
    source: 'commons',
    altFr: 'Place du marché de Gordes avec étals sous les arbres',
    altEn: 'Gordes market square with stalls under the trees',
    licenseNote: 'Wikimedia Commons — Place Genty Pentaly à Gordes (Tavily discovery)',
  },
  {
    slug: 'randonnee-col-de-gordes',
    sourceUrl: 'https://www.destinationluberon.com/image/64839-normal.jpg',
    source: 'manual',
    altFr: 'Panorama depuis le Col de Gordes sur le village perché',
    altEn: 'Panorama from Col de Gordes over the hilltop village',
    licenseNote: 'Official tourism board destinationluberon.com',
  },
  {
    slug: 'montgolfiere-luberon',
    sourceUrl:
      'https://www.montgolfiere-luberon.com/images/vol-montgolfiere/village-roussillon.jpg',
    source: 'manual',
    altFr: 'Montgolfière au-dessus des ocres de Roussillon dans le Luberon',
    altEn: 'Hot-air balloon over the ochre cliffs of Roussillon in the Luberon',
    licenseNote: 'Official operator montgolfiere-luberon.com',
  },
  {
    slug: 'electric-move',
    sourceUrl:
      'https://electricmove.fr/wp-content/uploads/2026/05/location-velo-electrique-luberon.png',
    source: 'manual',
    altFr: 'Vélos électriques Electric Move pour explorer le Luberon',
    altEn: 'Electric Move e-bikes for exploring the Luberon',
    licenseNote: 'Official site electricmove.fr',
  },
  {
    slug: 'domaine-des-peyre',
    sourceUrl:
      'https://i0.wp.com/www.domainedespeyre.com/wp-content/uploads/2021/08/2S6A3718-1.jpg?fit=1000%2C667&ssl=1',
    source: 'manual',
    altFr: 'Dégustation de vins au Domaine des Peyre dans les vignes du Luberon',
    altEn: 'Wine tasting at Domaine des Peyre among Luberon vines',
    licenseNote: 'Official site domainedespeyre.com',
  },
  {
    slug: 'equitation-luberon',
    sourceUrl:
      'https://assets.airelles.com/images/airelles2023/Zo_xyh5LeNNTxCi9_LaBastide-Lifestyle-Balade%C3%A0cheval-Rousillon%C2%A9HiddenCliff-2024.jpg?auto=format%2Ccompress&rect=209%2C0%2C1382%2C1080&w=1920&h=1500',
    source: 'press',
    altFr: 'Balade à cheval dans les collines du Luberon près de Roussillon',
    altEn: 'Horse ride through the Luberon hills near Roussillon',
    licenseNote: 'Official Airelles press kit — HiddenCliff (Tavily 2026-06-09)',
  },
  {
    slug: 'canoe-sorgue',
    sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Cano%C3%AB_sur_la_Sorgue.jpg',
    source: 'commons',
    altFr: 'Descente en canoë sur la Sorgue depuis Fontaine-de-Vaucluse',
    altEn: 'Canoe descent on the Sorgue from Fontaine-de-Vaucluse',
    licenseNote: 'Wikimedia Commons CC-BY-SA 4.0 — gwladysarnd',
  },
  {
    slug: 'les-bories',
    source: 'ai',
    altFr: 'Terrasse du restaurant étoilé Les Bories face au Luberon, Gordes',
    altEn: 'Terrace of MICHELIN-starred Les Bories restaurant facing the Luberon, Gordes',
    licenseNote:
      'AI-generated illustrative — official site serves WebP as binary/octet-stream (Tavily 2026-06-09)',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a MICHELIN-starred restaurant terrace in the Luberon, Provence: elegant outdoor tables with white linens, lavender in stone planters, dry-stone bastide and green valley hills in the background, warm late-afternoon light, no people, no readable text or logos, photojournalistic travel magazine style.',
  },
  {
    slug: 'le-phebus',
    sourceUrl:
      'https://hapi.mmcreation.com/hapidam/aefe202a-6e8b-462e-a520-5b90863497d9/phebus-spa-m-txm-salle-007.jpg?size=lg',
    source: 'manual',
    altFr: 'Terrasse du restaurant La Table de Xavier Mathieu au Phébus, Joucas',
    altEn: 'Terrace of La Table de Xavier Mathieu at Le Phébus, Joucas',
    licenseNote: 'Official site lephebus.com DAM (Tavily 2026-06-09)',
  },
  {
    slug: 'la-bartavelle',
    sourceUrl: 'https://static2.menufyy.com/restaurant-la-bartavelle-albums-1.jpg',
    source: 'manual',
    altFr: 'Terrasse ombragée du bistrot La Bartavelle à Goult',
    altEn: 'Shaded terrace of La Bartavelle bistro in Goult',
    licenseNote: 'Restaurant album menufyy.com / labartavellegoult.com (Tavily 2026-06-09)',
  },
  {
    slug: 'fournil-mamie-jeanne',
    source: 'ai',
    altFr: 'Vitrine artisanale du Fournil de Mamie Jeanne à Gordes, fougasses et pains au levain',
    altEn:
      'Artisan window display at Le Fournil de Mamie Jeanne bakery in Gordes, fougasse and sourdough',
    licenseNote:
      'AI-generated illustrative — editorial placeholder (no official photo found, Tavily 2026-06-09)',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a small artisan bakery window in a Provençal hilltop village (Gordes style): golden fougasse bread, croissants and rustic sourdough loaves on wooden shelves behind glass, warm morning light, limestone stone wall, no readable text or logos, no people, photojournalistic style, shallow depth of field.',
  },
  {
    slug: 'maison-bremond',
    sourceUrl: 'https://www.mb-1830.com/media/wysiwyg/gordes-interne.jpg',
    source: 'manual',
    altFr: 'Intérieur de l’épicerie fine Maison Brémond 1830 sur la place du Château à Gordes',
    altEn: 'Interior of Maison Brémond 1830 fine-food shop on Gordes Château square',
    licenseNote: 'Official site mb-1830.com (Tavily 2026-06-09)',
  },
  {
    slug: 'moulin-jeannons',
    sourceUrl:
      'https://media.cdnws.com/_i/408221/RAW-42/3840/42/photo-panoramique-moulin-du-clos-des-jeannons.jpeg',
    source: 'manual',
    altFr: 'Moulin du Clos des Jeannons parmi les oliviers, Gordes',
    altEn: 'Moulin du Clos des Jeannons among olive trees, Gordes',
    licenseNote: 'Official site moulinjeannons.com (Tavily 2026-06-09)',
  },
  {
    slug: 'pharmacie-gordes',
    sourceUrl:
      'https://www.pagesjaunes.fr/media/newdam/a3/7a/5b/00/00/3a/4b/5d/54/cf/6356a37a5b00003a4b5d54cf/6356a37a5b00003a4b5d54d0.jpg',
    source: 'manual',
    altFr: 'Façade de la Pharmacie de Gordes, rue de l’Église',
    altEn: 'Facade of the Gordes pharmacy on Rue de l’Église',
    licenseNote: 'Pages Jaunes listing photo — Pharmacie de Gordes (Tavily 2026-06-09)',
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

function cloudinarySourceTag(source: PoiImageSource['source']): 'commons' | 'manual' | 'press' {
  if (source === 'commons') return 'commons';
  if (source === 'press') return 'press';
  return 'manual';
}

async function generateOpenAiPoiImage(prompt: string): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error('[poi-images] OPENAI_API_KEY required for AI-generated POI images');
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1536x1024',
      quality: 'high',
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[poi-images] OpenAI Images ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = json.data?.[0];
  if (item?.b64_json !== undefined) {
    const dir = mkdtempSync(join(tmpdir(), 'mch-poi-ai-'));
    const path = join(dir, 'poi-ai.png');
    writeFileSync(path, Buffer.from(item.b64_json, 'base64'));
    return path;
  }
  if (item?.url !== undefined) {
    return item.url;
  }
  throw new Error('[poi-images] OpenAI Images returned no image payload');
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
      if (poi.source === 'ai') {
        console.log(`  ← OpenAI: ${poi.openAiPrompt?.slice(0, 80)}…`);
      } else {
        console.log(`  ← ${poi.sourceUrl}`);
      }
      console.log(`  (${poi.licenseNote})`);
      results.push({ slug: poi.slug, publicId, ok: true });
      continue;
    }

    let uploaded;
    if (poi.source === 'ai') {
      if (poi.openAiPrompt === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: AI source missing openAiPrompt`);
      }
      const generated = await generateOpenAiPoiImage(poi.openAiPrompt);
      if (generated.startsWith('http')) {
        uploaded = await uploadFromUrl({
          sourceUrl: generated,
          hotelSlug: SLUG,
          source: 'manual',
          index: i + 1,
          publicIdShort: `poi-${poi.slug}`,
          altFr: poi.altFr,
          altEn: poi.altEn,
          category: 'poi',
          extraTags: ['poi', poi.slug, 'ai-generated'],
        });
      } else {
        uploaded = await uploadFromLocalFile({
          localPath: generated,
          hotelSlug: SLUG,
          source: 'manual',
          index: i + 1,
          publicIdShort: `poi-${poi.slug}`,
          altFr: poi.altFr,
          altEn: poi.altEn,
          category: 'poi',
          extraTags: ['poi', poi.slug, 'ai-generated'],
        });
      }
    } else {
      if (poi.sourceUrl === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: missing sourceUrl`);
      }
      uploaded = await uploadFromUrl({
        sourceUrl: poi.sourceUrl,
        hotelSlug: SLUG,
        source: cloudinarySourceTag(poi.source),
        index: i + 1,
        publicIdShort: `poi-${poi.slug}`,
        altFr: poi.altFr,
        altEn: poi.altEn,
        category: 'poi',
        extraTags: ['poi', poi.slug],
      });
    }

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
