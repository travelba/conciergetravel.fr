/**
 * POI card images for `cheval-blanc-paris` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: Wikimedia
 * Commons + official venue sites (Tavily discovery 2026-06-11).
 *
 *   pnpm --filter @mch/editorial-pilot cbp:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot cbp:photos:poi
 *
 * Skill: photo-pipeline, hotel-kit-rollout §Rule POI images
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

const SLUG = 'cheval-blanc-paris';

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

/** Commons + official URLs — must depict the named venue (not hotel gallery). */
const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'musee-du-louvre',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Louvre_Museum_Wikimedia_Commons.jpg/1280px-Louvre_Museum_Wikimedia_Commons.jpg',
    source: 'commons',
    altFr: 'Pyramide du Louvre et cour Napoléon, Paris 1er',
    altEn: 'Louvre Pyramid and Cour Napoléon, Paris 1st',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'pont-neuf',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Pont_Neuf_-_Paris_-_France.jpg/1280px-Pont_Neuf_-_Paris_-_France.jpg',
    source: 'commons',
    altFr: 'Pont Neuf, plus ancien pont de Paris, vue sur l’Île de la Cité',
    altEn: 'Pont Neuf, oldest bridge in Paris, view over Île de la Cité',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'sainte-chapelle',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sainte_Chapelle_Interior_Stained_Glass.jpg/1280px-Sainte_Chapelle_Interior_Stained_Glass.jpg',
    source: 'commons',
    altFr: 'Vitraux gothiques de la Sainte-Chapelle, Île de la Cité, Paris',
    altEn: 'Gothic stained glass of Sainte-Chapelle, Île de la Cité, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'musee-orsay',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Mus%C3%A9e_D_Orsay_At_Sunset_%28134278411%29.jpeg/1280px-Mus%C3%A9e_D_Orsay_At_Sunset_%28134278411%29.jpeg',
    source: 'commons',
    altFr: 'Musée d’Orsay, ancienne gare Belle Époque, rive gauche, Paris',
    altEn: 'Musée d’Orsay, former Belle Époque station, Left Bank, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'jardin-tuileries',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Grand_bassin_octogonal_Jardin_des_Tuileries_003.jpg/1280px-Grand_bassin_octogonal_Jardin_des_Tuileries_003.jpg',
    source: 'commons',
    altFr: 'Grand bassin octogonal, Jardin des Tuileries, entre Louvre et Concorde',
    altEn: 'Grand octagonal basin, Tuileries Garden, between Louvre and Concorde',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'bourse-de-commerce',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Bourse_de_commerce_de_Paris.jpg/1280px-Bourse_de_commerce_de_Paris.jpg',
    source: 'commons',
    altFr: 'Bourse de Commerce — Pinault Collection, dôme du XIXe siècle, Paris 1er',
    altEn: 'Bourse de Commerce — Pinault Collection, 19th-century dome, Paris 1st',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'croisiere-seine',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg/1280px-View_up_the_Seine_from_Pont_d%27I%C3%A9na%2C_Paris%2C_2016.jpg',
    source: 'commons',
    altFr: 'Croisière sur la Seine avec la tour Eiffel, Paris',
    altEn: 'Seine river cruise with the Eiffel Tower, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'palais-royal',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Palais_Royal_et_les_Colonnes_de_Buren.jpg/1280px-Palais_Royal_et_les_Colonnes_de_Buren.jpg',
    source: 'commons',
    altFr: 'Palais-Royal et colonnes de Buren, jardin à la française, Paris 1er',
    altEn: 'Palais-Royal and Buren columns, formal garden, Paris 1st',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'marche-fleurs-cite',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/March%C3%A9_aux_fleurs_Reine-Elizabeth-II%2C_Paris_13_August_2013.jpg/1280px-March%C3%A9_aux_fleurs_Reine-Elizabeth-II%2C_Paris_13_August_2013.jpg',
    source: 'commons',
    altFr: 'Marché aux fleurs Reine-Elizabeth-II, Île de la Cité, Paris',
    altEn: 'Reine-Elizabeth-II Flower Market, Île de la Cité, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'la-samaritaine',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Samaritaine_Paris.jpg/1280px-Samaritaine_Paris.jpg',
    source: 'commons',
    altFr: 'Façade Art déco de La Samaritaine, quai du Louvre, Paris 1er',
    altEn: 'Art Deco facade of La Samaritaine, Quai du Louvre, Paris 1st',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'place-vendome',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Place-Vendome-Paris.jpg/1280px-Place-Vendome-Paris.jpg',
    source: 'commons',
    altFr: 'Place Vendôme et colonne Vendôme, joailliers et maisons de luxe, Paris 1er',
    altEn: 'Place Vendôme and Vendôme column, jewellers and luxury houses, Paris 1st',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'le-bon-marche',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Le_Bon_March%C3%A9%2C_Paris_27_May_2012.jpg/1280px-Le_Bon_March%C3%A9%2C_Paris_27_May_2012.jpg',
    source: 'commons',
    altFr: 'Le Bon Marché, premier grand magasin du monde, Rive Gauche, Paris',
    altEn: 'Le Bon Marché, world’s first department store, Left Bank, Paris',
    licenseNote: 'Wikimedia Commons',
  },
  {
    slug: 'galerie-vivienne',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Galerie_Vivienne%2C_12_March_2015.jpg/1280px-Galerie_Vivienne%2C_12_March_2015.jpg',
    source: 'commons',
    altFr: 'Galerie Vivienne, passage couvert et mosaïques, Paris 2e',
    altEn: 'Galerie Vivienne, covered passage and floor mosaics, Paris 2nd',
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
