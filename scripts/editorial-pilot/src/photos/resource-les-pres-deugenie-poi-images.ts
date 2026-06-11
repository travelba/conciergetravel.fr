/**
 * POI card images for `les-pres-deugenie` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: AI editorial
 * (Landes / Béarn / côte basque — venue-specific Commons unreliable from Cloudinary).
 *
 *   pnpm --filter @mch/editorial-pilot lpde:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot lpde:photos:poi
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

const SLUG = 'les-pres-deugenie';

interface PoiImageSource {
  readonly slug: string;
  readonly source: 'commons' | 'ai';
  readonly sourceUrl?: string;
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
  readonly openAiPrompt?: string;
}

const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'village-eugenie',
    source: 'ai',
    altFr: 'Village thermal d’Eugénie-les-Bains, Landes',
    altEn: 'Eugénie-les-Bains thermal village, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Eugénie-les-Bains thermal village in Landes France: colonial-style spa buildings, manicured gardens, soft mist, golden hour, no people, travel magazine style.',
  },
  {
    slug: 'dax-thermes',
    source: 'ai',
    altFr: 'Dax, Fontaine Chaude et thermes romains, Landes',
    altEn: 'Dax, Fontaine Chaude and Roman baths, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Dax Roman Fontaine Chaude thermal fountain in Landes: stone basin, steam, historic spa town square, daylight, no readable text, travel magazine style.',
  },
  {
    slug: 'bayonne',
    source: 'ai',
    altFr: 'Cathédrale Sainte-Marie de Bayonne, Pays basque',
    altEn: 'Bayonne Sainte-Marie Cathedral, Basque Country',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Bayonne Sainte-Marie Gothic cathedral and half-timbered Basque old town: stone spires, colombage façades, southwestern France, daylight, no people, travel magazine style.',
  },
  {
    slug: 'foret-des-landes',
    source: 'ai',
    altFr: 'Forêt des Landes, pins maritimes et pistes cyclables',
    altEn: 'Landes forest, maritime pines and cycle paths',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Landes pine forest cycle path: tall maritime pines, sandy track, morning mist, southwestern France, no people, travel magazine style.',
  },
  {
    slug: 'chateau-de-bachen',
    source: 'ai',
    altFr: 'Château de Bachen, domaine viticole et Armagnac, Landes',
    altEn: 'Château de Bachen, wine estate and Armagnac, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a Landes wine château with vineyard rows in foreground: stone manor, Armagnac country, late afternoon sun, no readable text, travel magazine style.',
  },
  {
    slug: 'ecole-de-cuisine',
    source: 'ai',
    altFr: 'École de Cuisine, Les Prés d’Eugénie, atelier gastronomique',
    altEn: 'Cookery School, Les Prés d’Eugénie, gastronomy workshop',
    licenseNote: 'AI illustrative — on-property workshop',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a luxury French gastronomy cooking school kitchen: copper pans, garden produce on marble counter, professional stoves, warm natural light, no people, travel magazine style.',
  },
  {
    slug: 'pau-chateau',
    source: 'ai',
    altFr: 'Château de Pau et boulevard des Pyrénées, Béarn',
    altEn: 'Pau castle and Pyrenees boulevard, Béarn',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Pau castle in Béarn with Pyrenees mountain backdrop: medieval fortress, boulevard viewpoint, clear sky, no people, travel magazine style.',
  },
  {
    slug: 'golf-greens-eugenie',
    source: 'ai',
    altFr: 'Golf Les Greens d’Eugénie, parcours 9 trous, Landes',
    altEn: 'Golf Les Greens d’Eugénie, 9-hole course, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a nine-hole golf course in Landes countryside: rolling greens, pine trees, soft morning light, no players, travel magazine style.',
  },
  {
    slug: 'lac-de-leon',
    source: 'ai',
    altFr: 'Lac de Léon, plus grand lac naturel des Landes',
    altEn: 'Lac de Léon, Landes’ largest natural lake',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Lac de Léon freshwater beach in Landes: pine-fringed lake, sand, paddleboards on shore, summer daylight, no readable text, travel magazine style.',
  },
  {
    slug: 'biarritz-plage',
    source: 'ai',
    altFr: 'Biarritz Grande Plage et Rocher de la Vierge, côte basque',
    altEn: 'Biarritz Grande Plage and Rock of the Virgin, Basque Coast',
    licenseNote: 'AI illustrative — Commons thumbnail unreachable from Cloudinary',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Biarritz Grande Plage and Rock of the Virgin on the Basque coast: sandy beach, Atlantic waves, cliff rock formation, summer light, no people, travel magazine style.',
  },
  {
    slug: 'hossegor-surf',
    source: 'ai',
    altFr: 'Hossegor, spot de surf et étangs landais',
    altEn: 'Hossegor, surf spot and Landes lagoons',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Hossegor Atlantic beach surf scene: long rolling wave, sandy shore, pine forest behind dunes, golden afternoon light, tiny surfer silhouette, travel magazine style.',
  },
  {
    slug: 'vignobles-tursan',
    source: 'ai',
    altFr: 'Vignobles du Tursan et distilleries d’Armagnac, Landes',
    altEn: 'Tursan vineyards and Armagnac distilleries, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Tursan vineyard hills in southwestern France: vine rows, oak barrels outside a stone chai, warm sunset, no readable text, travel magazine style.',
  },
  {
    slug: 'boutique-eugenie',
    source: 'ai',
    altFr: 'Boutique Eugénie, Café Mère Poule, art de vivre Maison Guérard',
    altEn: 'Eugénie boutique, Café Mère Poule, Guérard house lifestyle',
    licenseNote: 'AI illustrative — on-property boutique',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a luxury French country house lifestyle boutique: jams, linens, wine bottles on wooden shelves, warm interior light, no readable logos, travel magazine style.',
  },
  {
    slug: 'marche-dax',
    source: 'ai',
    altFr: 'Marché de Dax, produits landais et foie gras',
    altEn: 'Dax market, Landes produce and foie gras',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a traditional French southwestern market stall: foie gras, confits, cheeses, Saturday morning light under market hall, no readable vendor names, travel magazine style.',
  },
  {
    slug: 'fermes-chalosse',
    source: 'ai',
    altFr: 'Fermes de Chalosse, producteurs Hontang et Tauzin, Landes',
    altEn: 'Chalosse farms, Hontang and Tauzin producers, Landes',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a Landes farm in Chalosse countryside: pasture, cattle, half-timbered farmhouse, soft morning mist, southwestern France, travel magazine style.',
  },
  {
    slug: 'mont-de-marsan-musee',
    source: 'ai',
    altFr: 'Musée Despiau-Wlérick, Mont-de-Marsan, sculpture XXe siècle',
    altEn: 'Despiau-Wlérick Museum, Mont-de-Marsan, 20th-century sculpture',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a small French regional sculpture museum interior: marble busts on pedestals, natural skylight, quiet gallery, no readable text, travel magazine style.',
  },
  {
    slug: 'abbaye-sorde',
    source: 'ai',
    altFr: 'Abbaye de Sorde, cloître roman, Landes et Pays basque',
    altEn: 'Sorde Abbey, Roman cloister, Landes and Basque Country',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Sorde Abbey Romanesque cloister in southwestern France: stone arches, courtyard garden, soft daylight, no people, travel magazine style.',
  },
  {
    slug: 'salies-de-bearn',
    source: 'ai',
    altFr: 'Salies-de-Béarn, ville du sel et architecture à pans de bois',
    altEn: 'Salies-de-Béarn, salt town and half-timbered architecture',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Salies-de-Béarn half-timbered spa town: salt river, timber-framed façades, Béarn village street, afternoon light, no readable text, travel magazine style.',
  },
];

function publicIdFor(slug: string): string {
  return `cct/hotels/${SLUG}/poi-${slug}`;
}

function parseOnlyFilter(): Set<string> | null {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  if (arg === undefined) return null;
  return new Set(
    arg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function generateOpenAiPoiImage(prompt: string): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error('[poi-images] OPENAI_API_KEY required for AI-generated POI images');
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
    throw new Error(
      `[poi-images] OpenAI Images ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json !== undefined) {
    const path = join(mkdtempSync(join(tmpdir(), 'mch-poi-ai-')), 'poi-ai.png');
    writeFileSync(path, Buffer.from(item.b64_json, 'base64'));
    return path;
  }
  if (item?.url !== undefined) return item.url;
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

  let failed = 0;
  for (let i = 0; i < sources.length; i++) {
    const poi = sources[i]!;
    const publicId = publicIdFor(poi.slug);

    if (dryRun) {
      console.log(`[dry-run] ${poi.slug} → ${publicId} (${poi.source})`);
      continue;
    }

    let uploaded;
    if (poi.source === 'ai') {
      if (poi.openAiPrompt === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: AI source missing openAiPrompt`);
      }
      const generated = await generateOpenAiPoiImage(poi.openAiPrompt);
      uploaded = generated.startsWith('http')
        ? await uploadFromUrl({
            sourceUrl: generated,
            hotelSlug: SLUG,
            source: 'manual',
            index: i + 1,
            publicIdShort: `poi-${poi.slug}`,
            altFr: poi.altFr,
            altEn: poi.altEn,
            category: 'poi',
            extraTags: ['poi', poi.slug, 'ai-generated'],
          })
        : await uploadFromLocalFile({
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
    } else {
      if (poi.sourceUrl === undefined) {
        throw new Error(`[poi-images] ${poi.slug}: missing sourceUrl`);
      }
      uploaded = await uploadFromUrl({
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
    }

    if (!uploaded.ok) {
      console.error(`[FAIL] ${poi.slug}:`, uploaded.error);
      failed += 1;
      continue;
    }
    console.log(`[OK] ${poi.slug} → ${uploaded.value.public_id}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} upload(s) failed.`);
  } else {
    console.log(`\nAll ${sources.length} POI images ${dryRun ? 'planned' : 'uploaded'}.`);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
