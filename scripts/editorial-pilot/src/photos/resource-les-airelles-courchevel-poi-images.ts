/**
 * POI card images for `les-airelles-courchevel` — venue-specific assets (`poi-{slug}`).
 *
 * Never reuse hotel gallery `press-*` for POI cards (CDC D9bis). Sources: AI editorial
 * (alpine venues — no stable Commons hotlink path from Cloudinary).
 *
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:poi:dry
 *   pnpm --filter @mch/editorial-pilot arl-cv:photos:poi
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

const SLUG = 'les-airelles-courchevel';

interface PoiImageSource {
  readonly slug: string;
  readonly source: 'ai';
  readonly altFr: string;
  readonly altEn: string;
  readonly licenseNote: string;
  readonly openAiPrompt: string;
}

const POI_SOURCES: readonly PoiImageSource[] = [
  {
    slug: 'altiport-courchevel',
    source: 'ai',
    altFr: 'Altiport de Courchevel, altiport le plus haut d’Europe, Savoie',
    altEn: 'Courchevel Altiport, Europe’s highest altiport, Savoie',
    licenseNote: 'AI illustrative — restricted aviation perimeter photography',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Courchevel altiport in the French Alps at 2007m: short sloped runway, snow-covered mountains, small aircraft, crisp winter daylight, no readable text, travel magazine style.',
  },
  {
    slug: 'piste-olympique',
    source: 'ai',
    altFr: 'Tremplin olympique de Courchevel, patrimoine sportif, Savoie',
    altEn: 'Courchevel Olympic ski jump, sporting heritage, Savoie',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of the Courchevel Olympic ski jump tower in winter: iconic ski jumping structure above snowy valley, Courchevel 1850 in background, blue sky, no people, travel magazine style.',
  },
  {
    slug: 'eglise-saint-bon',
    source: 'ai',
    altFr: 'Église baroque Saint-Bon-Tarentaise, patrimoine savoyard',
    altEn: 'Baroque Saint-Bon-Tarentaise church, Savoyard heritage',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a baroque Savoyard church in Saint-Bon-Tarentaise village: stone facade, bell tower, snow-dusted alpine village street, winter light, no people, travel magazine style.',
  },
  {
    slug: 'trois-vallees',
    source: 'ai',
    altFr: 'Domaine skiable des 3 Vallées, Courchevel, plus grand domaine relié au monde',
    altEn: 'Three Valleys ski area, Courchevel, world’s largest linked ski domain',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Three Valleys ski slopes above Courchevel: groomed pistes, pine trees, distant peaks, skiers as tiny silhouettes, bright alpine sun, travel magazine style.',
  },
  {
    slug: 'le-1947',
    source: 'ai',
    altFr: 'Le 1947, restaurant deux étoiles MICHELIN, Cheval Blanc Courchevel',
    altEn: 'Le 1947, two-MICHELIN-star restaurant, Cheval Blanc Courchevel',
    licenseNote: 'AI illustrative — chevalblanc.com blocks hotlink',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a two-MICHELIN-star alpine fine dining salon: white tablecloths, crystal, mountain view through tall windows, warm evening light, no people, no logos, travel magazine style.',
  },
  {
    slug: 'heli-ski',
    source: 'ai',
    altFr: 'Héli-ski Tarentaise, départ altiport Courchevel',
    altEn: 'Tarentaise heli-ski, departure from Courchevel altiport',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a helicopter on snow at an alpine altiport with powder slopes behind: heli-ski preparation scene, Courchevel Alps, crisp morning light, no readable text, travel magazine style.',
  },
  {
    slug: 'patinoire-olympique',
    source: 'ai',
    altFr: 'Patinoire olympique Courchevel 1850, centre de la station',
    altEn: 'Courchevel 1850 Olympic ice rink, resort centre',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of an outdoor Olympic ice rink in Courchevel 1850 village centre: ice surface, alpine chalets around, evening lights, no readable signage, travel magazine style.',
  },
  {
    slug: 'chiens-traineau',
    source: 'ai',
    altFr: 'Balade en chiens de traîneau, vallée de la Tarentaise',
    altEn: 'Dog-sled excursion, Tarentaise valley',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a dog-sled team on a snowy forest trail in the French Alps: huskies, musher silhouette, raking morning light, no readable text, travel magazine style.',
  },
  {
    slug: 'village-1850',
    source: 'ai',
    altFr: 'Village de Courchevel 1850, artères piétonnes et boutiques de luxe',
    altEn: 'Courchevel 1850 village, pedestrian streets and luxury boutiques',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of Courchevel 1850 pedestrian village street in winter: luxury alpine storefronts, snow, wooden chalet architecture, soft afternoon light, no readable brand logos, travel magazine style.',
  },
  {
    slug: 'boutique-vanille-lilas',
    source: 'ai',
    altFr: 'Boutique Vanille & Lilas, Airelles Courchevel',
    altEn: 'Vanille & Lilas boutique, Airelles Courchevel',
    licenseNote: 'AI illustrative — palace boutique interior',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a luxury alpine palace boutique interior: curated fashion, soft lighting, wood and velvet decor, no readable logos, travel magazine style.',
  },
  {
    slug: 'ski-valet',
    source: 'ai',
    altFr: 'Ski valet Bernard Orcel, Les Airelles Courchevel',
    altEn: 'Bernard Orcel ski valet, Les Airelles Courchevel',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a luxury hotel ski room: rows of polished skis and boots on racks, warm wood panelling, alpine palace atmosphere, no readable text, travel magazine style.',
  },
  {
    slug: 'la-mangeoire',
    source: 'ai',
    altFr: 'La Mangeoire, bistrot festif de Courchevel 1850',
    altEn: 'La Mangeoire, festive bistro in Courchevel 1850',
    licenseNote: 'AI illustrative',
    openAiPrompt:
      'Hyper-realistic editorial photograph of a festive Savoyard mountain bistro interior: wooden beams, checked tablecloths, warm brasserie lighting, alpine decor, no people, no readable text, travel magazine style.',
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
      console.log(`[dry-run] ${poi.slug} → ${publicId}`);
      continue;
    }

    const generated = await generateOpenAiPoiImage(poi.openAiPrompt);
    const uploaded = generated.startsWith('http')
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
